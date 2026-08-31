"""Entry point Lambda "Webhook" — recebe o clique em Aprovar/Rejeitar.

Fica atrás do único endpoint público do sistema (API Gateway, TLS em
trânsito). Valida o `secret_token` do Telegram, localiza o evento pendente,
e — se aprovado — delega ao `RemediationExecutor` a chamada RESTCONF real.
Tudo fica logado (CloudWatch) como trilha de auditoria: quem aprovou, quando,
qual ação foi de fato aplicada — mapeando para os requisitos de Registro e
Monitoramento da ISO 27001.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from src.bot.actions import RemediationExecutor
from src.bot.pending_store import InMemoryPendingEventStore, PendingEventStore
from src.shared.config import SwitchConfig, TelegramConfig
from src.shared.notifier.telegram_bot import TelegramNotifier
from src.shared.restconf_client import RestconfClient

logger = logging.getLogger(__name__)

_default_store = InMemoryPendingEventStore()


class WebhookAuthError(RuntimeError):
    pass


def parse_callback(body: dict[str, Any]) -> tuple[str, str, str, str, int]:
    """Extrai (decisão, event_id, callback_query_id, chat_id, message_id) do
    update do Telegram. Levanta ValueError se não for um callback_query
    reconhecido (ex.: outro tipo de update, que deve ser ignorado)."""
    callback = body.get("callback_query")
    if not callback:
        raise ValueError("Update sem callback_query — ignorado")

    data = callback.get("data", "")
    if ":" not in data:
        raise ValueError(f"callback_data inesperado: {data!r}")
    decision, event_id = data.split(":", 1)
    if decision not in ("approve", "reject"):
        raise ValueError(f"Decisão desconhecida: {decision!r}")

    message = callback["message"]
    return decision, event_id, callback["id"], str(message["chat"]["id"]), message["message_id"]


def handle_decision(
    decision: str,
    event_id: str,
    callback_query_id: str,
    chat_id: str,
    message_id: int,
    store: PendingEventStore,
    executor: RemediationExecutor,
    notifier: TelegramNotifier,
) -> None:
    pending = store.get(event_id)
    if pending is None:
        notifier.answer_callback(callback_query_id, "Evento não encontrado (já tratado ou expirado)")
        return

    if decision == "reject":
        notifier.answer_callback(callback_query_id, "Ação rejeitada")
        notifier.edit_message(chat_id, message_id, "❌ Ação *rejeitada* pelo operador\\.")
        logger.info("Evento %s rejeitado", event_id)
        store.delete(event_id)
        return

    result = executor.apply(pending.event.proposed_action)
    if result.applied:
        notifier.answer_callback(callback_query_id, "Ação aplicada com sucesso")
        notifier.edit_message(chat_id, message_id, "✅ Ação *aplicada com sucesso*\\.")
        logger.info("Evento %s aprovado e remediado: %s", event_id, result.action.type.value)
    else:
        notifier.answer_callback(callback_query_id, "Falha ao aplicar a ação")
        notifier.edit_message(chat_id, message_id, f"⚠️ Falha ao aplicar a ação: {result.error}")
        logger.error("Evento %s: falha na remediação: %s", event_id, result.error)

    store.delete(event_id)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    telegram_config = TelegramConfig.from_env()

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    if telegram_config.webhook_secret and headers.get(
        "x-telegram-bot-api-secret-token"
    ) != telegram_config.webhook_secret:
        raise WebhookAuthError("Token secreto do webhook inválido")

    body = json.loads(event.get("body") or "{}")
    try:
        decision, event_id, callback_query_id, chat_id, message_id = parse_callback(body)
    except ValueError as exc:
        logger.info("Update ignorado: %s", exc)
        return {"statusCode": 200}

    notifier = TelegramNotifier(telegram_config)
    executor = RemediationExecutor(RestconfClient(SwitchConfig.from_env()))

    handle_decision(
        decision, event_id, callback_query_id, chat_id, message_id, _default_store, executor, notifier
    )
    return {"statusCode": 200}
