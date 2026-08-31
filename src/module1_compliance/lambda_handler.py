"""Entry point Lambda do Módulo 1 — Compliance & Hardening.

Fluxo: RESTCONF GET (config) -> normaliza -> aplica regras -> publica um
AnomalyEvent por Finding no barramento de eventos.
"""
from __future__ import annotations

import logging
from typing import Any

from src.module1_compliance.rules import run_all_rules
from src.shared.config import AwsConfig, SwitchConfig
from src.shared.event_bus import EventBridgePublisher, EventPublisher, InMemoryPublisher
from src.shared.models import ActionType, AnomalyEvent, Module, ProposedAction
from src.shared.restconf_client import RestconfClient

logger = logging.getLogger(__name__)

_ACTION_BY_RULE = {
    "port_security": ActionType.ENABLE_PORT_SECURITY,
    "qos_policy": ActionType.APPLY_QOS_POLICY,
    "insecure_service_http": ActionType.DISABLE_INSECURE_SERVICE,
    "insecure_service_telnet": ActionType.DISABLE_INSECURE_SERVICE,
}


def flatten_interfaces(native_interfaces: dict[str, Any]) -> list[dict[str, Any]]:
    """Achata `native:interface` (agrupado por tipo, ex. GigabitEthernet) em uma
    lista plana com `name` totalmente qualificado (ex. 'GigabitEthernet1/0/1')."""
    flat: list[dict[str, Any]] = []
    for if_type, entries in native_interfaces.items():
        for entry in entries:
            flat.append({**entry, "name": f"{if_type}{entry['name']}"})
    return flat


def build_events(device_id: str, findings, native_config: dict[str, Any]) -> list[AnomalyEvent]:
    events = []
    for finding in findings:
        interface = finding.evidence.get("interface")
        action_type = _ACTION_BY_RULE.get(finding.rule, ActionType.NONE)
        params: dict[str, Any] = {}
        if finding.rule == "insecure_service_http":
            params = {"service": "http"}
        elif finding.rule == "insecure_service_telnet":
            params = {"service": "telnet", "line": finding.evidence.get("line")}

        events.append(
            AnomalyEvent(
                module=Module.COMPLIANCE,
                severity=finding.severity,
                device_id=device_id,
                interface=interface,
                finding=finding.message,
                evidence=finding.evidence,
                proposed_action=ProposedAction(
                    type=action_type, device_id=device_id, interface=interface, params=params
                ),
            )
        )
    return events


def run(device_id: str, client: RestconfClient, publisher: EventPublisher) -> list[AnomalyEvent]:
    interfaces_resp = client.get("Cisco-IOS-XE-native:native/interface")
    services_resp = client.get("Cisco-IOS-XE-native:native")

    native_interfaces = interfaces_resp.get("Cisco-IOS-XE-native:native", {}).get(
        "interface", interfaces_resp.get("interface", {})
    )
    interfaces = flatten_interfaces(native_interfaces)

    findings = run_all_rules(interfaces, services_resp)
    events = build_events(device_id, findings, services_resp)

    for event in events:
        publisher.publish(event)
    logger.info("Módulo 1: %d finding(s) publicados para %s", len(events), device_id)
    return events


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    device_id = event.get("device_id", "switch-01")
    switch_config = SwitchConfig.from_env()
    aws_config = AwsConfig.from_env()

    client = RestconfClient(switch_config)
    publisher = EventBridgePublisher(aws_config.event_bus_name, aws_config.region)

    events = run(device_id, client, publisher)
    return {"statusCode": 200, "findings_published": len(events)}


if __name__ == "__main__":
    # Execução manual local contra o mock (python -m src.module1_compliance.lambda_handler)
    logging.basicConfig(level=logging.INFO)
    switch_config = SwitchConfig.from_env()
    client = RestconfClient(switch_config)
    publisher = InMemoryPublisher()
    run("switch-01", client, publisher)
