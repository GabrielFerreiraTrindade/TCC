"""Executor de remediação — traduz uma `ProposedAction` genérica em uma
chamada RESTCONF concreta.

Este é o único lugar do sistema que sabe "como consertar" cada tipo de
problema. Os 3 módulos não sabem nada sobre RESTCONF de escrita — eles só
descrevem *o que* deveria acontecer (`ActionType`). Isso mantém a promessa de
"framework escalável": adicionar uma ação nova é adicionar um handler aqui,
sem tocar nos detectores.

Antes de aplicar qualquer PATCH, o estado atual do recurso é lido e guardado
em `ExecutionResult.previous_state`, permitindo `rollback()` — requisito de
Gestão de Mudanças (ITIL v4): toda mudança precisa de um plano de reversão.

Os XPaths/nomes de leaf usados são representativos do modelo `Cisco-IOS-XE-
native` real, mas simplificados para fins didáticos; validar contra um
DevNet Sandbox antes de aplicar em um dispositivo real (docs/architecture.md
#próximos-passos).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Callable

from src.shared.models import ActionType, ProposedAction
from src.shared.restconf_client import RestconfClient

logger = logging.getLogger(__name__)

_IFACE_RE = re.compile(r"^([A-Za-z\-]+)([\d/.:]+)$")


def _split_interface(interface: str) -> tuple[str, str]:
    """'GigabitEthernet1/0/2' -> ('GigabitEthernet', '1/0/2')."""
    match = _IFACE_RE.match(interface)
    if not match:
        raise ValueError(f"Nome de interface inesperado: {interface!r}")
    return match.group(1), match.group(2)


@dataclass
class ExecutionResult:
    action: ProposedAction
    applied: bool
    xpath: str | None
    previous_state: dict[str, Any] | None
    error: str | None = None


class RemediationExecutor:
    def __init__(self, client: RestconfClient) -> None:
        self._client = client
        self._handlers: dict[ActionType, Callable[[ProposedAction], tuple[str, dict[str, Any]]]] = {
            ActionType.ENABLE_PORT_SECURITY: self._enable_port_security,
            ActionType.APPLY_QOS_POLICY: self._apply_qos_policy,
            ActionType.DISABLE_INSECURE_SERVICE: self._disable_insecure_service,
            ActionType.ISOLATE_HOST: self._isolate_host,
            ActionType.APPLY_RATE_LIMIT: self._apply_rate_limit,
            ActionType.ENABLE_DAMPENING: self._enable_dampening,
            ActionType.SHUTDOWN_INTERFACE: self._shutdown_interface,
            ActionType.REDIRECT_TO_BACKUP_LINK: self._redirect_to_backup_link,
        }

    def apply(self, action: ProposedAction) -> ExecutionResult:
        handler = self._handlers.get(action.type)
        if handler is None:
            return ExecutionResult(
                action=action, applied=False, xpath=None, previous_state=None,
                error=f"Ação não suportada: {action.type}",
            )
        try:
            xpath, payload = handler(action)
            previous_state = self._client.get(xpath)
            self._client.patch(xpath, payload)
            logger.info(
                "Ação %s aplicada (device=%s, interface=%s)",
                action.type.value, action.device_id, action.interface,
            )
            return ExecutionResult(action=action, applied=True, xpath=xpath, previous_state=previous_state)
        except Exception as exc:  # reportar qualquer falha ao operador via bot, não silenciar
            logger.exception("Falha ao aplicar ação %s", action.type.value)
            return ExecutionResult(action=action, applied=False, xpath=None, previous_state=None, error=str(exc))

    def rollback(self, result: ExecutionResult) -> None:
        if not result.applied or result.xpath is None or result.previous_state is None:
            raise ValueError("Nada para reverter: a ação não foi aplicada com sucesso")
        self._client.patch(result.xpath, result.previous_state)
        logger.info("Rollback aplicado em %s (device=%s)", result.xpath, result.action.device_id)

    # -- handlers: cada um devolve (xpath, payload) RESTCONF -------------------

    def _interface_xpath(self, action: ProposedAction) -> tuple[str, str, str]:
        if not action.interface:
            raise ValueError(f"Ação {action.type} requer 'interface'")
        if_type, if_num = _split_interface(action.interface)
        return f"Cisco-IOS-XE-native:native/interface/{if_type}={if_num}", if_type, if_num

    def _enable_port_security(self, action: ProposedAction) -> tuple[str, dict[str, Any]]:
        xpath, if_type, _ = self._interface_xpath(action)
        payload = {
            f"Cisco-IOS-XE-native:{if_type}": {
                "switchport-config": {
                    "port-security": {
                        "enable": [None],
                        "maximum": {"max-value": action.params.get("max_mac", 1)},
                        "violation": {"protocol": "restrict"},
                    }
                }
            }
        }
        return xpath, payload

    def _apply_qos_policy(self, action: ProposedAction) -> tuple[str, dict[str, Any]]:
        xpath, if_type, _ = self._interface_xpath(action)
        policy_name = action.params.get("policy_name", "QOS-USER-IN")
        payload = {f"Cisco-IOS-XE-native:{if_type}": {"service-policy": {"input": policy_name}}}
        return xpath, payload

    def _disable_insecure_service(self, action: ProposedAction) -> tuple[str, dict[str, Any]]:
        service = action.params.get("service")
        if service == "http":
            xpath = "Cisco-IOS-XE-native:native/ip/http"
            payload = {"Cisco-IOS-XE-native:http": {"server": False}}
        elif service == "telnet":
            line = action.params.get("line", "vty 0 4")
            xpath = f"Cisco-IOS-XE-native:native/line={line.replace(' ', ',')}"
            payload = {"Cisco-IOS-XE-native:line": {"transport": {"input": ["ssh"]}}}
        else:
            raise ValueError(f"Serviço inseguro desconhecido: {service!r}")
        return xpath, payload

    def _isolate_host(self, action: ProposedAction) -> tuple[str, dict[str, Any]]:
        src_ip = action.params["src_ip"]
        xpath = "Cisco-IOS-XE-native:native/ip/access-list/extended=NETGUARDIAN-BLOCK"
        payload = {
            "Cisco-IOS-XE-native:extended": {
                "name": "NETGUARDIAN-BLOCK",
                "access-list-seq-rule": [
                    {"sequence": 10, "ace-rule": {"action": "deny", "protocol": "ip", "source": src_ip}}
                ],
            }
        }
        return xpath, payload

    def _apply_rate_limit(self, action: ProposedAction) -> tuple[str, dict[str, Any]]:
        src_ip = action.params["src_ip"]
        rate_kbps = action.params.get("rate_kbps", 1000)
        xpath = "Cisco-IOS-XE-native:native/policy-map=NETGUARDIAN-RATE-LIMIT"
        payload = {
            "Cisco-IOS-XE-native:policy-map": {
                "name": "NETGUARDIAN-RATE-LIMIT",
                "class": [{"name": src_ip, "police": {"rate-bps": rate_kbps * 1000}}],
            }
        }
        return xpath, payload

    def _enable_dampening(self, action: ProposedAction) -> tuple[str, dict[str, Any]]:
        xpath, if_type, _ = self._interface_xpath(action)
        payload = {f"Cisco-IOS-XE-native:{if_type}": {"dampening": [None]}}
        return xpath, payload

    def _shutdown_interface(self, action: ProposedAction) -> tuple[str, dict[str, Any]]:
        xpath, if_type, _ = self._interface_xpath(action)
        payload = {f"Cisco-IOS-XE-native:{if_type}": {"shutdown": [None]}}
        return xpath, payload

    def _redirect_to_backup_link(self, action: ProposedAction) -> tuple[str, dict[str, Any]]:
        xpath, if_type, _ = self._interface_xpath(action)
        backup = action.params.get("backup_interface", "Port-channel1")
        payload = {
            f"Cisco-IOS-XE-native:{if_type}": {
                "shutdown": [None],
            },
            "Cisco-IOS-XE-native:backup-interface": backup,
        }
        return xpath, payload
