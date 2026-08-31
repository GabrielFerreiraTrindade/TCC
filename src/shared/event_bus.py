"""Publicação de AnomalyEvents no barramento de eventos (AWS EventBridge).

Isolado em um módulo próprio para que os handlers de cada módulo não
importem `boto3` diretamente — facilita testar os módulos com um bus falso
(veja `tests/`) e, se um dia trocarmos EventBridge por SNS/SQS, só este
arquivo muda.
"""
from __future__ import annotations

import json
import logging
from typing import Protocol

from src.shared.models import AnomalyEvent

logger = logging.getLogger(__name__)


class EventPublisher(Protocol):
    def publish(self, event: AnomalyEvent) -> None: ...


class EventBridgePublisher:
    """Publisher real, usado dentro do Lambda (requer boto3 + credenciais AWS)."""

    def __init__(self, bus_name: str, region: str) -> None:
        self._bus_name = bus_name
        self._region = region
        self._client = None  # lazy: evita exigir boto3 em ambiente de testes

    def _get_client(self):
        if self._client is None:
            import boto3  # import local: só é necessário em produção/Lambda

            self._client = boto3.client("events", region_name=self._region)
        return self._client

    def publish(self, event: AnomalyEvent) -> None:
        client = self._get_client()
        response = client.put_events(
            Entries=[
                {
                    "Source": event.source,
                    "DetailType": f"AnomalyEvent.{event.module.value}",
                    "Detail": json.dumps(event.to_dict()),
                    "EventBusName": self._bus_name,
                }
            ]
        )
        if response.get("FailedEntryCount", 0):
            logger.error("Falha ao publicar evento no EventBridge: %s", response)
            raise RuntimeError(f"EventBridge rejeitou o evento: {response}")


class InMemoryPublisher:
    """Publisher usado em testes e execução local (mocks/*)."""

    def __init__(self) -> None:
        self.published: list[AnomalyEvent] = []

    def publish(self, event: AnomalyEvent) -> None:
        logger.info("[mock-bus] %s", json.dumps(event.to_dict(), indent=2))
        self.published.append(event)
