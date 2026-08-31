"""CLI de treino/avaliação do detector do Módulo 2.

Uso:
    python -m src.module2_threats.train --data data/flows.csv --model-out data/model.joblib

O dataset sintético (`src.mocks.traffic_generator`) carrega, além das colunas
de fluxo, um rótulo oculto (`is_anomaly`, `attack_type`) usado *apenas* aqui,
para avaliação — nunca é passado ao modelo (que é não supervisionado). Isso
permite reportar precisão/recall/F1/matriz de confusão com números reais em
vez de inspeção manual, o que é o que a monografia precisa para discutir
falsos positivos/negativos.
"""
from __future__ import annotations

import argparse
import logging

import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from src.module2_threats.feature_engineering import build_features
from src.module2_threats.model import AnomalyDetector

logger = logging.getLogger(__name__)


def _build_ground_truth(raw_flows: pd.DataFrame) -> pd.DataFrame:
    """Rótulo por (window_start, src_ip): anômalo se QUALQUER fluxo do grupo
    for anômalo; attack_type = tipo predominante no grupo."""
    grouped = raw_flows.groupby(["window_start", "src_ip"], as_index=False)
    return grouped.agg(
        is_anomaly=("is_anomaly", "max"),
        attack_type=("attack_type", lambda s: s.dropna().mode().iloc[0] if s.notna().any() else None),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True, help="CSV gerado por src.mocks.traffic_generator")
    parser.add_argument("--model-out", required=True, help="Caminho de saída do modelo (joblib)")
    parser.add_argument("--test-size", type=float, default=0.3)
    parser.add_argument("--contamination", type=float, default=0.02)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    raw_flows = pd.read_csv(args.data)
    features = build_features(raw_flows)
    ground_truth = _build_ground_truth(raw_flows)

    dataset = features.merge(ground_truth, on=["window_start", "src_ip"], how="left")
    dataset["is_anomaly"] = dataset["is_anomaly"].fillna(0).astype(int)

    train_df, test_df = train_test_split(
        dataset, test_size=args.test_size, random_state=42, stratify=dataset["is_anomaly"]
    )

    detector = AnomalyDetector(contamination=args.contamination).fit(train_df)

    predicted_anomaly = detector.predict(test_df)
    y_true = test_df["is_anomaly"].to_numpy()

    logger.info("=== Módulo 2 — Avaliação do Isolation Forest ===")
    logger.info(
        "%s",
        classification_report(
            y_true, predicted_anomaly.astype(int), target_names=["normal", "anômalo"]
        ),
    )
    logger.info("Matriz de confusão [ [TN FP] [FN TP] ]:\n%s", confusion_matrix(y_true, predicted_anomaly.astype(int)))

    # Avaliação secundária: dado que o modelo acertou "é anômalo", o
    # classificador heurístico (port_scan vs traffic_spike) acerta o tipo?
    correctly_flagged = test_df[predicted_anomaly & (y_true == 1)]
    if len(correctly_flagged):
        matches = 0
        for _, row in correctly_flagged.iterrows():
            predicted_type = detector.classify_anomaly(row)
            true_type = row["attack_type"]
            matches += int(
                (predicted_type == "port_scan" and true_type == "port_scan")
                or (predicted_type == "traffic_spike" and true_type == "traffic_spike")
            )
        accuracy = matches / len(correctly_flagged)
        logger.info(
            "Classificação do tipo de ameaça (entre os %d verdadeiros positivos): %.1f%% de acerto",
            len(correctly_flagged),
            accuracy * 100,
        )

    detector.save(args.model_out)
    logger.info("Modelo salvo em %s", args.model_out)


if __name__ == "__main__":
    main()
