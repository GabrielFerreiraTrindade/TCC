"""Configuração centralizada, lida a partir de variáveis de ambiente.

Mantido separado para que nenhum módulo precise saber *de onde* vem a
configuração (env vars locais, variáveis de ambiente de Lambda, ou --em uma
extensão futura-- AWS Secrets Manager).
"""
from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise RuntimeError(f"Variável de ambiente obrigatória não definida: {name}")
    return value or ""


@dataclass(frozen=True)
class SwitchConfig:
    host: str
    username: str
    password: str
    verify_tls: bool

    @classmethod
    def from_env(cls) -> "SwitchConfig":
        return cls(
            host=_env("SWITCH_HOST", "http://localhost:8443"),
            username=_env("SWITCH_USER", "admin"),
            password=_env("SWITCH_PASSWORD", "admin"),
            verify_tls=_env("SWITCH_VERIFY_TLS", "false").lower() == "true",
        )


@dataclass(frozen=True)
class TelegramConfig:
    bot_token: str
    chat_id: str
    webhook_secret: str

    @classmethod
    def from_env(cls) -> "TelegramConfig":
        return cls(
            bot_token=_env("TELEGRAM_BOT_TOKEN"),
            chat_id=_env("TELEGRAM_CHAT_ID"),
            webhook_secret=_env("TELEGRAM_WEBHOOK_SECRET"),
        )


@dataclass(frozen=True)
class AwsConfig:
    event_bus_name: str
    region: str

    @classmethod
    def from_env(cls) -> "AwsConfig":
        return cls(
            event_bus_name=_env("EVENT_BUS_NAME", "netguardian-bus"),
            region=_env("AWS_REGION", "us-east-1"),
        )
