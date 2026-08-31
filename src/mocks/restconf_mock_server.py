"""Simulador local de um switch Cisco IOS-XE falando RESTCONF/YANG.

Não é uma implementação RFC 8040 completa — implementa só o suficiente
(GET/PATCH com merge best-effort) para desenvolver e demonstrar os 3 módulos
sem depender de hardware Cisco real ou de um DevNet Sandbox. A interface
GigabitEthernet1/0/3 fica "oscilando" (flapping) e a GigabitEthernet1/0/4
acumula erros de CRC a cada chamada, para exercitar o Módulo 3 fim a fim.

Uso: python -m src.mocks.restconf_mock_server
"""
from __future__ import annotations

import json
import logging
import random
import time
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request

logger = logging.getLogger(__name__)
app = Flask(__name__)

_FIXTURES_DIR = Path(__file__).resolve().parent.parent / "module1_compliance" / "yang_payloads"


def _load_fixture(name: str) -> dict[str, Any]:
    with open(_FIXTURES_DIR / name, encoding="utf-8") as f:
        data = json.load(f)
    data.pop("_comment", None)
    return data


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value
    return base


_STATE: dict[str, Any] = {}
_deep_merge(_STATE, _load_fixture("interfaces_config.json"))
_deep_merge(_STATE, _load_fixture("services_config.json"))

_START_TIME = time.time()
_CRC_COUNTER = {"GigabitEthernet1/0/4": 0}
_FLAP_STATE = {"GigabitEthernet1/0/3": "up"}


def _interfaces_state() -> dict[str, Any]:
    if random.random() < 0.3:
        _FLAP_STATE["GigabitEthernet1/0/3"] = (
            "down" if _FLAP_STATE["GigabitEthernet1/0/3"] == "up" else "up"
        )
    _CRC_COUNTER["GigabitEthernet1/0/4"] += random.randint(20, 60)

    return {
        "ietf-interfaces:interfaces-state": {
            "interface": [
                {
                    "name": "GigabitEthernet1/0/1",
                    "oper-status": "up",
                    "statistics": {"in-crc-errors": 0},
                },
                {
                    "name": "GigabitEthernet1/0/2",
                    "oper-status": "up",
                    "statistics": {"in-crc-errors": 0},
                },
                {
                    "name": "GigabitEthernet1/0/3",
                    "oper-status": _FLAP_STATE["GigabitEthernet1/0/3"],
                    "statistics": {"in-crc-errors": 0},
                },
                {
                    "name": "GigabitEthernet1/0/4",
                    "oper-status": "up",
                    "statistics": {"in-crc-errors": _CRC_COUNTER["GigabitEthernet1/0/4"]},
                },
            ]
        }
    }


def _navigate_for_write(xpath: str) -> Any:
    """Anda pelo xpath criando/entrando em containers e, quando encontra um
    seletor de lista (ex.: 'interface=1/0/2'), localiza (ou cria) o item da
    lista com `name` == seletor. Best-effort: suficiente para o mock, não
    implementa toda a semântica de chave composta do YANG."""
    node: Any = _STATE
    for segment in xpath.split("/"):
        if "=" in segment:
            key, selector = segment.split("=", 1)
            container = node.setdefault(key, []) if isinstance(node, dict) else node
            if not isinstance(container, list):
                node = container
                continue
            match = next((item for item in container if item.get("name") == selector), None)
            if match is None:
                match = {"name": selector}
                container.append(match)
            node = match
        else:
            if isinstance(node, dict):
                node = node.setdefault(segment, {})
    return node


@app.route("/restconf/data/<path:xpath>", methods=["GET"])
def get_resource(xpath: str):
    if xpath.startswith("ietf-interfaces:interfaces-state"):
        return jsonify(_interfaces_state())

    node: Any = _STATE
    for segment in xpath.split("/"):
        key = segment.split("=")[0]
        if isinstance(node, dict) and key in node:
            node = node[key]
        else:
            return jsonify({})

    last_key = xpath.split("/")[-1].split("=")[0]
    return jsonify({last_key: node})


@app.route("/restconf/data/<path:xpath>", methods=["PATCH"])
def patch_resource(xpath: str):
    payload = request.get_json(force=True) or {}
    try:
        target = _navigate_for_write(xpath)
        for value in payload.values():
            if isinstance(value, dict) and isinstance(target, dict):
                _deep_merge(target, value)
    except Exception:  # mock best-effort: nunca falhar a demo por um xpath incomum
        logger.warning("PATCH em %s não pôde ser aplicado ao estado simulado", xpath, exc_info=True)
    logger.info("PATCH %s <- %s", xpath, json.dumps(payload, ensure_ascii=False))
    return "", 204


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "uptime_s": round(time.time() - _START_TIME, 1)})


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(host="0.0.0.0", port=8443, debug=True)
