"""Análise de telemetria (Módulo 3) — funções puras sobre séries temporais.

Assim como `module1_compliance/rules.py`, estas funções não fazem I/O: recebem
um histórico de amostras (já coletado via RESTCONF em `lambda_handler.py`) e
devolvem um `Finding` opcional. Isso as torna testáveis com listas Python
simples, sem precisar de um dispositivo (real ou mock) no meio.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

from src.shared.models import Finding, Severity


def _parse_ts(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


def detect_flapping(
    interface: str,
    history: list[dict[str, Any]],
    max_transitions: int = 4,
    window_seconds: int = 300,
) -> Optional[Finding]:
    """`history`: lista de {"timestamp": ISO8601, "oper_status": "up"|"down"},
    tipicamente amostrada do container `ietf-interfaces:interfaces-state` a
    cada poucos segundos/minutos por um polling agendado."""
    if len(history) < 2:
        return None

    ordered = sorted(history, key=lambda h: h["timestamp"])
    window_end = _parse_ts(ordered[-1]["timestamp"])
    window_start = window_end - timedelta(seconds=window_seconds)
    windowed = [h for h in ordered if _parse_ts(h["timestamp"]) >= window_start]

    transitions = sum(
        1 for prev, curr in zip(windowed, windowed[1:]) if prev["oper_status"] != curr["oper_status"]
    )

    if transitions >= max_transitions:
        severity = Severity.CRITICAL if transitions >= max_transitions * 2 else Severity.HIGH
        return Finding(
            rule="interface_flapping",
            message=(
                f"Interface {interface} oscilou {transitions} vezes "
                f"nos últimos {window_seconds}s"
            ),
            severity=severity,
            evidence={
                "interface": interface,
                "transitions": transitions,
                "window_seconds": window_seconds,
            },
        )
    return None


def detect_crc_errors(
    interface: str,
    history: list[dict[str, Any]],
    max_errors_per_second: float = 5.0,
) -> Optional[Finding]:
    """`history`: lista de {"timestamp": ISO8601, "in_crc_errors": int}, onde
    `in_crc_errors` é o contador cumulativo exposto pelo dispositivo
    (estatísticas de interface). Compara as duas amostras mais recentes."""
    if len(history) < 2:
        return None

    ordered = sorted(history, key=lambda h: h["timestamp"])
    prev, curr = ordered[-2], ordered[-1]

    delta_errors = curr["in_crc_errors"] - prev["in_crc_errors"]
    delta_seconds = (_parse_ts(curr["timestamp"]) - _parse_ts(prev["timestamp"])).total_seconds()

    if delta_errors < 0 or delta_seconds <= 0:
        # Contador foi reiniciado (ex.: interface reload) — taxa não pode ser calculada.
        return None

    rate = delta_errors / delta_seconds
    if rate >= max_errors_per_second:
        severity = Severity.CRITICAL if rate >= max_errors_per_second * 3 else Severity.HIGH
        return Finding(
            rule="crc_errors",
            message=f"Interface {interface} acumulando erros de CRC a {rate:.1f}/s",
            severity=severity,
            evidence={
                "interface": interface,
                "errors_per_second": round(rate, 2),
                "delta_errors": delta_errors,
                "delta_seconds": delta_seconds,
            },
        )
    return None
