"""Entry point Lambda "Notifier" — assina o barramento de eventos e notifica.

É o único consumidor do EventBridge no MVP: recebe qualquer `AnomalyEvent`
(dos 3 módulos, indistintamente — é isso que garante a experiência unificada
no bot), formata e envia via Telegram, e registra o evento como pendente de
aprovação para o webhook conseguir localizá-lo depois.
"""
from __future__ import annotations

import logging
from typing import Any

from src.bot.pending_store import InMemoryPendingEventStore, PendingApproval, PendingEventStore
from src.shared.config import TelegramConfig
from src.shared.models import AnomalyEvent
from src.shared.notifier.telegram_bot import TelegramNotifier

logger = logging.getLogger(__name__)

# Fallback local/teste — em produção, trocar por um PendingEventStore sobre DynamoDB.
_default_store = InMemoryPendingEventStore()


def notify(event: AnomalyEvent, notifier: TelegramNotifier, store: PendingEventStore) -> None:
    message_id = notifier.send_alert(event)
    if event.requires_approval and event.proposed_action.type.value != "none":
        store.save(
            PendingApproval(event=event, chat_id=notifier.chat_id, message_id=message_id)
        )
    logger.info("Evento %s notificado (message_id=%s)", event.event_id, message_id)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    anomaly_event = AnomalyEvent.from_dict(event["detail"])
    notifier = TelegramNotifier(TelegramConfig.from_env())
    notify(anomaly_event, notifier, _default_store)
    return {"statusCode": 200}
