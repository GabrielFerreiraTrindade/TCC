"""Contrato de dados compartilhado por todos os módulos.

`AnomalyEvent` é a única coisa que um detector precisa saber produzir para se
integrar ao resto do sistema (barramento de eventos, notificação, remediação).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class Module(str, Enum):
    COMPLIANCE = "compliance"   # Módulo 1
    THREAT = "threat"           # Módulo 2
    HEALTH = "health"           # Módulo 3


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ActionType(str, Enum):
    """Ações de remediação suportadas pelo executor genérico (src/bot/actions.py)."""

    ENABLE_PORT_SECURITY = "enable_port_security"
    APPLY_QOS_POLICY = "apply_qos_policy"
    DISABLE_INSECURE_SERVICE = "disable_insecure_service"
    ISOLATE_HOST = "isolate_host"
    APPLY_RATE_LIMIT = "apply_rate_limit"
    ENABLE_DAMPENING = "enable_dampening"
    SHUTDOWN_INTERFACE = "shutdown_interface"
    REDIRECT_TO_BACKUP_LINK = "redirect_to_backup_link"
    NONE = "none"


@dataclass(frozen=True)
class ProposedAction:
    type: ActionType
    device_id: str
    interface: Optional[str] = None
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Finding:
    """Uma violação/observação bruta produzida por uma regra ou modelo."""

    rule: str
    message: str
    severity: Severity
    evidence: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AnomalyEvent:
    """Evento normalizado publicado no barramento (EventBridge)."""

    module: Module
    severity: Severity
    device_id: str
    finding: str
    evidence: dict[str, Any]
    proposed_action: ProposedAction
    interface: Optional[str] = None
    requires_approval: bool = True
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    source: str = "netguardian"

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "source": self.source,
            "module": self.module.value,
            "severity": self.severity.value,
            "device_id": self.device_id,
            "interface": self.interface,
            "finding": self.finding,
            "evidence": self.evidence,
            "requires_approval": self.requires_approval,
            "proposed_action": {
                "type": self.proposed_action.type.value,
                "device_id": self.proposed_action.device_id,
                "interface": self.proposed_action.interface,
                "params": self.proposed_action.params,
            },
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AnomalyEvent":
        """Reconstrói um AnomalyEvent a partir do `detail` de um evento do
        EventBridge (o dict produzido por `to_dict`)."""
        action_data = data["proposed_action"]
        return cls(
            module=Module(data["module"]),
            severity=Severity(data["severity"]),
            device_id=data["device_id"],
            interface=data.get("interface"),
            finding=data["finding"],
            evidence=data.get("evidence", {}),
            requires_approval=data.get("requires_approval", True),
            proposed_action=ProposedAction(
                type=ActionType(action_data["type"]),
                device_id=action_data["device_id"],
                interface=action_data.get("interface"),
                params=action_data.get("params", {}),
            ),
            event_id=data["event_id"],
            timestamp=data["timestamp"],
            source=data.get("source", "netguardian"),
        )
