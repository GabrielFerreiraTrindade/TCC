"""Entry point Lambda do Módulo 2 — Segurança & Ameaças.

Fluxo: recebe um lote de registros de fluxo (do evento, ou em produção de um
objeto S3 apontado pelo evento) -> engenharia de features -> scoring pelo
Isolation Forest já treinado -> para cada amostra anômala, classifica o tipo
(port scan / pico de tráfego) e publica um AnomalyEvent com a ação sugerida.
"""
from __future__ import annotations

import logging
import os
from typing import Any

import pandas as pd

from src.module2_threats.feature_engineering import build_features
from src.module2_threats.model import AnomalyDetector
from src.shared.config import AwsConfig
from src.shared.event_bus import EventBridgePublisher, EventPublisher, InMemoryPublisher
from src.shared.models import ActionType, AnomalyEvent, Module, ProposedAction, Severity

logger = logging.getLogger(__name__)

_ACTION_BY_TYPE = {
    "port_scan": ActionType.ISOLATE_HOST,
    "traffic_spike": ActionType.APPLY_RATE_LIMIT,
}

_SEVERITY_BY_TYPE = {
    "port_scan": Severity.HIGH,
    "traffic_spike": Severity.HIGH,
    "unknown": Severity.MEDIUM,
}


def score_flows(
    device_id: str, raw_flows: pd.DataFrame, detector: AnomalyDetector
) -> list[AnomalyEvent]:
    features = build_features(raw_flows)
    if features.empty:
        return []

    is_anomaly = detector.predict(features)
    events: list[AnomalyEvent] = []

    for row, anomalous in zip(features.to_dict("records"), is_anomaly):
        if not anomalous:
            continue
        row_series = pd.Series(row)
        anomaly_type = detector.classify_anomaly(row_series)
        action_type = _ACTION_BY_TYPE.get(anomaly_type, ActionType.NONE)
        src_ip = row["src_ip"]

        finding = {
            "port_scan": f"Possível varredura de portas a partir de {src_ip}",
            "traffic_spike": f"Pico atípico de tráfego a partir de {src_ip}",
            "unknown": f"Padrão de tráfego anômalo detectado a partir de {src_ip}",
        }[anomaly_type]

        events.append(
            AnomalyEvent(
                module=Module.THREAT,
                severity=_SEVERITY_BY_TYPE.get(anomaly_type, Severity.MEDIUM),
                device_id=device_id,
                finding=finding,
                evidence={
                    "src_ip": src_ip,
                    "window_start": row["window_start"],
                    "unique_dst_ports": row["unique_dst_ports"],
                    "bytes_per_second": row["bytes_per_second"],
                    "anomaly_type": anomaly_type,
                },
                proposed_action=ProposedAction(
                    type=action_type, device_id=device_id, params={"src_ip": src_ip}
                ),
            )
        )
    return events


def run(
    device_id: str,
    raw_flows: pd.DataFrame,
    detector: AnomalyDetector,
    publisher: EventPublisher,
) -> list[AnomalyEvent]:
    events = score_flows(device_id, raw_flows, detector)
    for event in events:
        publisher.publish(event)
    logger.info("Módulo 2: %d anomalia(s) publicada(s) para %s", len(events), device_id)
    return events


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    device_id = event.get("device_id", "switch-01")
    raw_flows = pd.DataFrame(event["flows"])

    model_path = os.environ.get("MODEL_PATH", "data/model.joblib")
    detector = AnomalyDetector.load(model_path)

    aws_config = AwsConfig.from_env()
    publisher = EventBridgePublisher(aws_config.event_bus_name, aws_config.region)

    events = run(device_id, raw_flows, detector, publisher)
    return {"statusCode": 200, "anomalies_published": len(events)}


if __name__ == "__main__":
    # Execução manual local: gera tráfego sintético, treina rapidamente e roda o scoring.
    logging.basicConfig(level=logging.INFO)
    from src.mocks.traffic_generator import generate_flows

    flows = generate_flows(rows=5000, seed=1)
    detector = AnomalyDetector(contamination=0.05).fit(build_features(flows))
    run("switch-01", flows, detector, InMemoryPublisher())
