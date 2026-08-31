"""Armazenamento do histórico recente de amostras de telemetria por interface.

RESTCONF só devolve um snapshot; detectar flapping/CRC drops exige comparar
amostras ao longo do tempo. Em produção isso seria uma tabela DynamoDB (TTL
curto, ex. 1h, é suficiente); localmente/nos testes usamos um dicionário em
memória. A interface (`get`/`append`) é o que os handlers usam, então trocar
o backend não exige tocar em `lambda_handler.py`.
"""
from __future__ import annotations

from typing import Any, Protocol


class HistoryStore(Protocol):
    def get(self, interface: str) -> list[dict[str, Any]]: ...
    def append(self, interface: str, sample: dict[str, Any], max_samples: int = 20) -> None: ...


class InMemoryHistoryStore:
    def __init__(self) -> None:
        self._data: dict[str, list[dict[str, Any]]] = {}

    def get(self, interface: str) -> list[dict[str, Any]]:
        return list(self._data.get(interface, []))

    def append(self, interface: str, sample: dict[str, Any], max_samples: int = 20) -> None:
        history = self._data.setdefault(interface, [])
        history.append(sample)
        del history[:-max_samples]  # mantém só as `max_samples` amostras mais recentes
