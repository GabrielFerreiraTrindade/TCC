"""Cliente RESTCONF genérico para dispositivos Cisco IOS-XE.

RESTCONF (RFC 8040) expõe módulos YANG como recursos HTTP em JSON, o que
substitui o parsing frágil de saída de CLI usado por soluções legadas. Este
cliente é deliberadamente fino: só sabe fazer GET/PATCH/PUT autenticados contra
`/restconf/data/<xpath>` e traduzir erros de transporte em exceções de domínio,
para que `rules.py` / `telemetry_analysis.py` fiquem livres de detalhes HTTP.
"""
from __future__ import annotations

from typing import Any

import requests

from src.shared.config import SwitchConfig

RESTCONF_HEADERS = {
    "Content-Type": "application/yang-data+json",
    "Accept": "application/yang-data+json",
}


class RestconfError(RuntimeError):
    """Erro de transporte/protocolo ao falar com o dispositivo via RESTCONF."""


class RestconfClient:
    def __init__(self, config: SwitchConfig, timeout: float = 10.0) -> None:
        self._config = config
        self._timeout = timeout
        self._base_url = f"{config.host.rstrip('/')}/restconf/data"

    def get(self, xpath: str) -> dict[str, Any]:
        """GET em um recurso YANG, ex.: 'ietf-interfaces:interfaces'."""
        url = f"{self._base_url}/{xpath}"
        try:
            resp = requests.get(
                url,
                auth=(self._config.username, self._config.password),
                headers=RESTCONF_HEADERS,
                timeout=self._timeout,
                verify=self._config.verify_tls,
            )
            resp.raise_for_status()
            return resp.json() if resp.content else {}
        except requests.exceptions.RequestException as exc:
            raise RestconfError(f"Falha ao consultar {xpath}: {exc}") from exc

    def patch(self, xpath: str, payload: dict[str, Any]) -> None:
        """PATCH parcial em um recurso YANG (usado para remediação)."""
        url = f"{self._base_url}/{xpath}"
        try:
            resp = requests.patch(
                url,
                auth=(self._config.username, self._config.password),
                headers=RESTCONF_HEADERS,
                json=payload,
                timeout=self._timeout,
                verify=self._config.verify_tls,
            )
            resp.raise_for_status()
        except requests.exceptions.RequestException as exc:
            raise RestconfError(f"Falha ao aplicar PATCH em {xpath}: {exc}") from exc
