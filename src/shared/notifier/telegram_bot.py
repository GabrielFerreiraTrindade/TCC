"""Notificação padronizada de AnomalyEvents via Telegram Bot API.

Um único template de mensagem para os 3 módulos é o que sustenta a
"experiência unificada": o engenheiro de plantão recebe o mesmo formato de
alerta (severidade, dispositivo, evidência, ação proposta, botões
Aprovar/Rejeitar) não importa se o problema veio de config, tráfego ou
telemetria.
"""
from __future__ import annotations

import json
import logging

import requests

from src.shared.config import TelegramConfig
from src.shared.models import AnomalyEvent, Severity

logger = logging.getLogger(__name__)

_SEVERITY_EMOJI = {
    Severity.LOW: "🔵",
    Severity.MEDIUM: "🟡",
    Severity.HIGH: "🟠",
    Severity.CRITICAL: "🔴",
}

_MODULE_LABEL = {
    "compliance": "Compliance & Hardening",
    "threat": "Segurança & Ameaças",
    "health": "Saúde da Infraestrutura",
}

TELEGRAM_API_BASE = "https://api.telegram.org"

_MDV2_SPECIAL_CHARS = r"_*[]()~`>#+-=|{}.!"


def _escape_md(text: str) -> str:
    """Escapa caracteres reservados do MarkdownV2 (texto livre, fora de `code`)."""
    return "".join(f"\\{c}" if c in _MDV2_SPECIAL_CHARS else c for c in text)


def format_message(event: AnomalyEvent) -> str:
    emoji = _SEVERITY_EMOJI.get(event.severity, "⚪")
    module_label = _escape_md(_MODULE_LABEL.get(event.module.value, event.module.value))
    lines = [
        f"{emoji} *[{event.severity.value.upper()}] {module_label}*",
        f"*Dispositivo:* `{event.device_id}`",
    ]
    if event.interface:
        lines.append(f"*Interface:* `{event.interface}`")
    lines.append(f"*Achado:* {_escape_md(event.finding)}")
    if event.evidence:
        evidence_str = json.dumps(event.evidence, ensure_ascii=False)
        lines.append(f"*Evidência:* `{evidence_str}`")
    lines.append(f"*Ação proposta:* `{event.proposed_action.type.value}`")
    lines.append(f"_event\\_id: {event.event_id}_")
    return "\n".join(lines)


def build_approval_keyboard(event: AnomalyEvent) -> dict:
    return {
        "inline_keyboard": [
            [
                {"text": "✅ Aprovar", "callback_data": f"approve:{event.event_id}"},
                {"text": "❌ Rejeitar", "callback_data": f"reject:{event.event_id}"},
            ]
        ]
    }


class TelegramNotifier:
    def __init__(self, config: TelegramConfig, timeout: float = 10.0) -> None:
        self._config = config
        self._timeout = timeout

    @property
    def chat_id(self) -> str:
        return self._config.chat_id

    def send_alert(self, event: AnomalyEvent) -> int:
        """Envia o alerta e devolve o `message_id` do Telegram (necessário
        para depois editar a mensagem quando o operador aprovar/rejeitar)."""
        url = f"{TELEGRAM_API_BASE}/bot{self._config.bot_token}/sendMessage"
        payload = {
            "chat_id": self._config.chat_id,
            "text": format_message(event),
            "parse_mode": "MarkdownV2",
        }
        if event.requires_approval and event.proposed_action.type.value != "none":
            payload["reply_markup"] = json.dumps(build_approval_keyboard(event))

        resp = requests.post(url, json=payload, timeout=self._timeout)
        if not resp.ok:
            logger.error("Falha ao enviar alerta ao Telegram: %s", resp.text)
            resp.raise_for_status()
        return resp.json()["result"]["message_id"]

    def answer_callback(self, callback_query_id: str, text: str) -> None:
        url = f"{TELEGRAM_API_BASE}/bot{self._config.bot_token}/answerCallbackQuery"
        requests.post(
            url,
            json={"callback_query_id": callback_query_id, "text": text},
            timeout=self._timeout,
        )

    def edit_message(self, chat_id: str, message_id: int, text: str) -> None:
        url = f"{TELEGRAM_API_BASE}/bot{self._config.bot_token}/editMessageText"
        requests.post(
            url,
            json={
                "chat_id": chat_id,
                "message_id": message_id,
                "text": text,
                "parse_mode": "MarkdownV2",
            },
            timeout=self._timeout,
        )
