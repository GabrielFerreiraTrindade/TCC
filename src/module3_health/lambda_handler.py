"""Entry point Lambda do Módulo 3 — Saúde da Infraestrutura.

Fluxo: dispara periodicamente (ex. a cada 1 min via EventBridge Scheduler) ->
GET RESTCONF no estado operacional das interfaces -> acrescenta a amostra ao
histórico recente (`history_store.py`) -> roda as detecções de flapping/CRC
-> publica AnomalyEvent para cada achado.

Nota: `statistics.in-crc-errors` aqui é uma simplificação didática do
contador granular de CRC exposto pelos modelos operacionais da Cisco (em um
IOS-XE real isso mapeia para algo como
`Cisco-IOS-XE-interfaces-oper:interfaces/interface/statistics/...`) — ver
docs/architecture.md#próximos-passos.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from src.module3_health.history_store import HistoryStore, InMemoryHistoryStore
from src.module3_health.telemetry_analysis import detect_crc_errors, detect_flapping
from src.shared.config import AwsConfig, SwitchConfig
from src.shared.event_bus import EventBridgePublisher, EventPublisher, InMemoryPublisher
from src.shared.models import ActionType, AnomalyEvent, Finding, Module, ProposedAction, Severity
from src.shared.restconf_client import RestconfClient

logger = logging.getLogger(__name__)

# Fallback para execução local / testes. Em produção, cada invocação de Lambda
# pode rodar em um container novo — o histórico real deve viver em DynamoDB
# (TTL curto), não na memória do processo.
_default_store = InMemoryHistoryStore()


def _finding_to_event(device_id: str, interface: str, finding: Finding) -> AnomalyEvent:
    if finding.rule == "interface_flapping":
        action_type = (
            ActionType.SHUTDOWN_INTERFACE
            if finding.severity == Severity.CRITICAL
            else ActionType.ENABLE_DAMPENING
        )
        params: dict[str, Any] = {}
    else:  # crc_errors
        action_type = ActionType.REDIRECT_TO_BACKUP_LINK
        params = {"backup_interface": "Port-channel1"}

    return AnomalyEvent(
        module=Module.HEALTH,
        severity=finding.severity,
        device_id=device_id,
        interface=interface,
        finding=finding.message,
        evidence=finding.evidence,
        proposed_action=ProposedAction(
            type=action_type, device_id=device_id, interface=interface, params=params
        ),
    )


def run(
    device_id: str,
    client: RestconfClient,
    store: HistoryStore,
    publisher: EventPublisher,
    now: str | None = None,
) -> list[AnomalyEvent]:
    timestamp = now or datetime.now(timezone.utc).isoformat()

    state = client.get("ietf-interfaces:interfaces-state")
    interfaces = state.get("ietf-interfaces:interfaces-state", {}).get(
        "interface", state.get("interface", [])
    )

    events: list[AnomalyEvent] = []
    for iface in interfaces:
        name = iface["name"]
        sample = {
            "timestamp": timestamp,
            "oper_status": iface.get("oper-status", "unknown"),
            "in_crc_errors": iface.get("statistics", {}).get("in-crc-errors", 0),
        }
        store.append(name, sample)
        history = store.get(name)

        for finding in filter(
            None, [detect_flapping(name, history), detect_crc_errors(name, history)]
        ):
            events.append(_finding_to_event(device_id, name, finding))

    for event in events:
        publisher.publish(event)
    logger.info("Módulo 3: %d achado(s) publicado(s) para %s", len(events), device_id)
    return events


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    device_id = event.get("device_id", "switch-01")
    switch_config = SwitchConfig.from_env()
    aws_config = AwsConfig.from_env()

    client = RestconfClient(switch_config)
    publisher = EventBridgePublisher(aws_config.event_bus_name, aws_config.region)

    events = run(device_id, client, _default_store, publisher)
    return {"statusCode": 200, "findings_published": len(events)}


if __name__ == "__main__":
    # Execução manual local contra o mock (python -m src.module3_health.lambda_handler)
    logging.basicConfig(level=logging.INFO)
    switch_config = SwitchConfig.from_env()
    client = RestconfClient(switch_config)
    publisher = InMemoryPublisher()
    run("switch-01", client, InMemoryHistoryStore(), publisher)
