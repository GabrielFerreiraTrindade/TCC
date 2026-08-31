"""Detector de anomalias de tráfego (Módulo 2) — Isolation Forest.

Isolation Forest foi escolhido porque tráfego anômalo é raro e não temos
rótulos confiáveis em produção (justificativa para aprendizado não
supervisionado): o algoritmo isola pontos anômalos com menos partições
aleatórias do que pontos normais, sem precisar de exemplos rotulados de
ataque para treinar.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from src.module2_threats.feature_engineering import FEATURE_COLUMNS

AnomalyType = Literal["port_scan", "traffic_spike", "unknown"]


@dataclass(frozen=True)
class ClassificationThresholds:
    """Limiares usados para dar um "rótulo" legível a uma amostra anômala,
    calculados a partir de percentis do próprio conjunto de treino (portanto
    adaptados à linha de base de cada rede, não valores mágicos fixos)."""

    port_scan_min_unique_ports: float
    traffic_spike_min_bytes_per_second: float

    @classmethod
    def from_training_data(cls, features: pd.DataFrame) -> "ClassificationThresholds":
        return cls(
            port_scan_min_unique_ports=float(features["unique_dst_ports"].quantile(0.95)),
            traffic_spike_min_bytes_per_second=float(
                features["bytes_per_second"].quantile(0.95)
            ),
        )


class AnomalyDetector:
    def __init__(
        self,
        contamination: float = 0.02,
        random_state: int = 42,
        thresholds: ClassificationThresholds | None = None,
    ) -> None:
        self._model = IsolationForest(
            contamination=contamination, random_state=random_state, n_estimators=200
        )
        self._thresholds = thresholds
        self._fitted = False

    def fit(self, features: pd.DataFrame) -> "AnomalyDetector":
        self._model.fit(features[FEATURE_COLUMNS])
        self._thresholds = ClassificationThresholds.from_training_data(features)
        self._fitted = True
        return self

    def predict(self, features: pd.DataFrame) -> np.ndarray:
        """Retorna um array booleano: True = amostra anômala."""
        self._require_fitted()
        raw = self._model.predict(features[FEATURE_COLUMNS])  # -1 anômalo, 1 normal
        return raw == -1

    def score(self, features: pd.DataFrame) -> np.ndarray:
        """Quanto menor (mais negativo), mais anômalo."""
        self._require_fitted()
        return self._model.decision_function(features[FEATURE_COLUMNS])

    def classify_anomaly(self, feature_row: pd.Series) -> AnomalyType:
        self._require_fitted()
        assert self._thresholds is not None
        is_scan = feature_row["unique_dst_ports"] >= self._thresholds.port_scan_min_unique_ports
        is_spike = (
            feature_row["bytes_per_second"] >= self._thresholds.traffic_spike_min_bytes_per_second
        )
        if is_scan and not is_spike:
            return "port_scan"
        if is_spike:
            return "traffic_spike"
        return "unknown"

    def _require_fitted(self) -> None:
        if not self._fitted:
            raise RuntimeError("Modelo ainda não foi treinado (chame fit() antes)")

    def save(self, path: str | Path) -> None:
        joblib.dump({"model": self._model, "thresholds": self._thresholds}, path)

    @classmethod
    def load(cls, path: str | Path) -> "AnomalyDetector":
        payload = joblib.load(path)
        detector = cls()
        detector._model = payload["model"]
        detector._thresholds = payload["thresholds"]
        detector._fitted = True
        return detector
