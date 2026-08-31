"""Gerador de tráfego de rede sintético para treinar/avaliar o Módulo 2.

Produz um CSV com o schema de `feature_engineering.RAW_FLOW_COLUMNS`, mais
duas colunas ocultas usadas *apenas* para avaliação (`is_anomaly`,
`attack_type`) — nunca entram no vetor de features do modelo.

Duas assinaturas de ataque são simuladas:
- **port_scan**: um host varre dezenas/centenas de portas distintas com
  poucos bytes por conexão (SYN scan).
- **traffic_spike**: um host gera um volume de bytes muito acima da linha de
  base (exfiltração de dados ou DoS de origem única).

Uso: python -m src.mocks.traffic_generator --out data/flows.csv --rows 20000
"""
from __future__ import annotations

import argparse
import random
from datetime import datetime, timedelta, timezone

import pandas as pd

WINDOW_SECONDS = 60
COMMON_PORTS = [80, 443, 53, 22, 123, 3389, 8080]


def _random_ip(rng: random.Random, subnet: str) -> str:
    return f"{subnet}.{rng.randint(2, 250)}"


def _normal_flow(rng: random.Random, window_start: str, src_ip: str) -> dict:
    return {
        "window_start": window_start,
        "window_seconds": WINDOW_SECONDS,
        "src_ip": src_ip,
        "dst_ip": _random_ip(rng, "172.16.0"),
        "dst_port": rng.choice(COMMON_PORTS),
        "protocol": "tcp",
        "bytes": rng.randint(200, 15_000),
        "packets": rng.randint(2, 40),
        "syn_flag": 0,
        "is_anomaly": 0,
        "attack_type": None,
    }


def _port_scan_flows(rng: random.Random, window_start: str, src_ip: str, n_ports: int) -> list[dict]:
    return [
        {
            "window_start": window_start,
            "window_seconds": WINDOW_SECONDS,
            "src_ip": src_ip,
            "dst_ip": _random_ip(rng, "172.16.0"),
            "dst_port": port,
            "protocol": "tcp",
            "bytes": rng.randint(40, 120),
            "packets": rng.randint(1, 3),
            "syn_flag": 1,
            "is_anomaly": 1,
            "attack_type": "port_scan",
        }
        for port in rng.sample(range(1, 65535), n_ports)
    ]


def _traffic_spike_flows(rng: random.Random, window_start: str, src_ip: str, n_flows: int) -> list[dict]:
    return [
        {
            "window_start": window_start,
            "window_seconds": WINDOW_SECONDS,
            "src_ip": src_ip,
            "dst_ip": _random_ip(rng, "172.16.0"),
            "dst_port": rng.choice(COMMON_PORTS),
            "protocol": "tcp",
            "bytes": rng.randint(500_000, 2_000_000),
            "packets": rng.randint(500, 2_000),
            "syn_flag": 0,
            "is_anomaly": 1,
            "attack_type": "traffic_spike",
        }
        for _ in range(n_flows)
    ]


def generate_flows(rows: int = 20_000, seed: int = 0, anomaly_ratio: float = 0.03) -> pd.DataFrame:
    rng = random.Random(seed)
    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    n_windows = max(10, rows // 200)
    windows = [
        (base_time + timedelta(seconds=WINDOW_SECONDS * i)).isoformat() for i in range(n_windows)
    ]
    hosts = [_random_ip(rng, "10.0.0") for _ in range(30)]

    all_slots = [(w, h) for w in windows for h in hosts]
    n_anomalous = max(1, min(len(all_slots), int(len(all_slots) * anomaly_ratio)))
    anomalous_slots = set(rng.sample(all_slots, k=n_anomalous))

    records: list[dict] = []
    for window in windows:
        for host in hosts:
            if (window, host) in anomalous_slots:
                if rng.random() < 0.5:
                    records.extend(_port_scan_flows(rng, window, host, rng.randint(30, 200)))
                else:
                    records.extend(_traffic_spike_flows(rng, window, host, rng.randint(20, 60)))
            else:
                for _ in range(rng.randint(1, 8)):
                    records.append(_normal_flow(rng, window, host))

    df = pd.DataFrame(records)
    if len(df) > rows:
        anomalous = df[df["is_anomaly"] == 1]
        normal = df[df["is_anomaly"] == 0]
        n_normal_keep = max(0, rows - len(anomalous))
        normal = normal.sample(n=min(n_normal_keep, len(normal)), random_state=seed)
        df = pd.concat([anomalous, normal]).sample(frac=1, random_state=seed).reset_index(drop=True)
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    parser.add_argument("--rows", type=int, default=20_000)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--anomaly-ratio", type=float, default=0.03)
    args = parser.parse_args()

    df = generate_flows(rows=args.rows, seed=args.seed, anomaly_ratio=args.anomaly_ratio)
    df.to_csv(args.out, index=False)
    print(f"{len(df)} registros de fluxo escritos em {args.out} ({int(df['is_anomaly'].sum())} anômalos)")


if __name__ == "__main__":
    main()
