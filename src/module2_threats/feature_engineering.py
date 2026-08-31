"""Engenharia de recursos para o Módulo 2 — Segurança & Ameaças.

Transforma registros de fluxo brutos (um por conexão/pacote agregado — o que
NetFlow/IPFIX chamaria de flow record) em um vetor de features por
(janela de tempo × host de origem), que é a granularidade em que o Isolation
Forest opera.

Um port scan tende a ter `unique_dst_ports` alto e poucos bytes por conexão;
um pico de tráfego (exfiltração/DoS) tende a ter `bytes_per_second` muito
acima da linha de base, sem necessariamente tocar muitas portas distintas.
Essas duas assinaturas são o que permite, depois do modelo marcar uma
amostra como anômala, classificar heuristicamente o tipo de ameaça
(ver `model.py::classify_anomaly`).
"""
from __future__ import annotations

import pandas as pd

RAW_FLOW_COLUMNS = [
    "window_start",   # timestamp (início da janela de agregação, ex. 60s)
    "window_seconds",
    "src_ip",
    "dst_ip",
    "dst_port",
    "protocol",
    "bytes",
    "packets",
    "syn_flag",        # 1 se o fluxo começou com SYN sem ACK completo (heurística de scan)
]

FEATURE_COLUMNS = [
    "unique_dst_ports",
    "unique_dst_hosts",
    "total_bytes",
    "total_packets",
    "avg_packet_size",
    "syn_ratio",
    "bytes_per_second",
    "flow_count",
]


def build_features(raw_flows: pd.DataFrame) -> pd.DataFrame:
    """Agrega registros de fluxo por (window_start, src_ip) em um vetor de
    features. Preserva `window_start` e `src_ip` como identificadores (não
    são passados ao modelo, mas são necessários para saber "quem" isolar).
    """
    missing = set(RAW_FLOW_COLUMNS) - set(raw_flows.columns)
    if missing:
        raise ValueError(f"Colunas ausentes no dataset de fluxo: {sorted(missing)}")

    grouped = raw_flows.groupby(["window_start", "src_ip"], as_index=False)
    agg = grouped.agg(
        unique_dst_ports=("dst_port", "nunique"),
        unique_dst_hosts=("dst_ip", "nunique"),
        total_bytes=("bytes", "sum"),
        total_packets=("packets", "sum"),
        syn_count=("syn_flag", "sum"),
        flow_count=("dst_ip", "count"),
        window_seconds=("window_seconds", "first"),
    )

    agg["avg_packet_size"] = agg["total_bytes"] / agg["total_packets"].replace(0, 1)
    agg["syn_ratio"] = agg["syn_count"] / agg["flow_count"].replace(0, 1)
    agg["bytes_per_second"] = agg["total_bytes"] / agg["window_seconds"].replace(0, 1)

    return agg[["window_start", "src_ip", *FEATURE_COLUMNS]]
