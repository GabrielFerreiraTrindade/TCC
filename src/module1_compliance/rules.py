"""Regras de compliance/hardening (Módulo 1) — análise estática de configuração.

Funções puras: recebem dicts já obtidos via RESTCONF (ver `lambda_handler.py`)
e devolvem `Finding`s. Nenhuma função aqui faz I/O — o que torna a lógica de
negócio 100% testável sem mock de rede (ver `tests/test_module1_rules.py`).

Os XPaths/estruturas usados são baseados no modelo `Cisco-IOS-XE-native` real
(interface > switchport-config > port-security, interface > service-policy,
native > ip > http, native > line > transport) mas simplificados; validar os
nomes exatos de leaf/container contra um DevNet Sandbox antes de ir a produção
(ver docs/architecture.md#próximos-passos).
"""
from __future__ import annotations

from typing import Any

from src.shared.models import Finding, Severity

_UPLINK_HINTS = ("uplink", "trunk", "core", "backbone")


def _is_access_port(interface: dict[str, Any]) -> bool:
    """Heurística: portas de acesso a usuário final devem ter port security;
    uplinks/trunks entre equipamentos de infraestrutura são tratados como
    confiáveis e ficam fora dessa checagem."""
    description = (interface.get("description") or "").lower()
    return "switchport" in interface and not any(hint in description for hint in _UPLINK_HINTS)


def check_port_security(interfaces: list[dict[str, Any]]) -> list[Finding]:
    findings: list[Finding] = []
    for iface in interfaces:
        if not _is_access_port(iface):
            continue
        name = iface.get("name", "?")
        port_security = iface.get("switchport-config", {}).get("port-security")
        enabled = bool(port_security and "enable" in port_security)
        if not enabled:
            findings.append(
                Finding(
                    rule="port_security",
                    message=f"Interface {name} é uma porta de acesso sem Port Security habilitado",
                    severity=Severity.HIGH,
                    evidence={"interface": name, "description": iface.get("description")},
                )
            )
    return findings


def check_qos_policy(interfaces: list[dict[str, Any]]) -> list[Finding]:
    findings: list[Finding] = []
    for iface in interfaces:
        if not _is_access_port(iface):
            continue
        name = iface.get("name", "?")
        service_policy = iface.get("service-policy", {})
        if not service_policy.get("input") and not service_policy.get("output"):
            findings.append(
                Finding(
                    rule="qos_policy",
                    message=f"Interface {name} não possui nenhuma política de QoS aplicada",
                    severity=Severity.MEDIUM,
                    evidence={"interface": name},
                )
            )
    return findings


def check_insecure_services(native_config: dict[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    native = native_config.get("Cisco-IOS-XE-native:native", native_config)

    http = native.get("ip", {}).get("http", {})
    if http.get("server"):
        findings.append(
            Finding(
                rule="insecure_service_http",
                message="Servidor HTTP (não criptografado) está habilitado no dispositivo",
                severity=Severity.HIGH,
                evidence={"ip.http.server": True},
            )
        )

    for line in native.get("line", []):
        transport_input = line.get("transport", {}).get("input", [])
        if "telnet" in transport_input:
            findings.append(
                Finding(
                    rule="insecure_service_telnet",
                    message=(
                        f"Linha {line.get('name', '?')} aceita Telnet "
                        "(tráfego de gerência em texto claro)"
                    ),
                    severity=Severity.CRITICAL,
                    evidence={"line": line.get("name"), "transport_input": transport_input},
                )
            )
    return findings


def run_all_rules(
    interfaces: list[dict[str, Any]], native_config: dict[str, Any]
) -> list[Finding]:
    return [
        *check_port_security(interfaces),
        *check_qos_policy(interfaces),
        *check_insecure_services(native_config),
    ]
