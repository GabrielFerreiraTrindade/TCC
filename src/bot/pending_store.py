"""Persistência dos eventos aguardando aprovação humana (Human-in-the-Loop).

O Notifier Lambda grava aqui ao enviar o alerta; o Webhook Lambda lê aqui
quando o operador aprova/rejeita no Telegram. Em produção isso é uma tabela
DynamoDB (chave = event_id, TTL de alguns dias) para sobreviver entre
invocações de Lambdas diferentes; localmente/nos testes, um dicionário em
memória é suficiente.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from src.shared.models import AnomalyEvent


@dataclass
class PendingApproval:
    event: AnomalyEvent
    chat_id: str
    message_id: int


class PendingEventStore(Protocol):
    def save(self, pending: PendingApproval) -> None: ...
    def get(self, event_id: str) -> PendingApproval | None: ...
    def delete(self, event_id: str) -> None: ...


class InMemoryPendingEventStore:
    def __init__(self) -> None:
        self._data: dict[str, PendingApproval] = {}

    def save(self, pending: PendingApproval) -> None:
        self._data[pending.event.event_id] = pending

    def get(self, event_id: str) -> PendingApproval | None:
        return self._data.get(event_id)

    def delete(self, event_id: str) -> None:
        self._data.pop(event_id, None)
