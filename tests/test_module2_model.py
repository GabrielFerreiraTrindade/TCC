import pandas as pd

from src.module2_threats.feature_engineering import build_features
from src.mocks.traffic_generator import generate_flows
from src.module2_threats.model import AnomalyDetector


def test_build_features_shapes_and_columns():
    flows = generate_flows(rows=2000, seed=1)
    features = build_features(flows)

    assert {"window_start", "src_ip", "unique_dst_ports", "bytes_per_second"}.issubset(features.columns)
    assert len(features) > 0
    # cada linha das features corresponde a um par (window, host) único
    assert not features.duplicated(subset=["window_start", "src_ip"]).any()


def test_detector_flags_the_synthetic_anomalies():
    flows = generate_flows(rows=6000, seed=2, anomaly_ratio=0.05)
    features = build_features(flows)

    ground_truth = flows.groupby(["window_start", "src_ip"], as_index=False)["is_anomaly"].max()
    dataset = features.merge(ground_truth, on=["window_start", "src_ip"], how="left")
    dataset["is_anomaly"] = dataset["is_anomaly"].fillna(0).astype(int)

    detector = AnomalyDetector(contamination=0.1).fit(dataset)
    predicted = detector.predict(dataset)

    true_positive_rate = predicted[dataset["is_anomaly"] == 1].mean()
    # o Isolation Forest não precisa ser perfeito, mas deve capturar a maioria
    # das anomalias sintéticas (que são bem separadas do tráfego normal)
    assert true_positive_rate > 0.7


def test_classify_anomaly_distinguishes_scan_from_spike():
    flows = generate_flows(rows=6000, seed=3, anomaly_ratio=0.05)
    features = build_features(flows)
    detector = AnomalyDetector(contamination=0.1).fit(features)

    scan_row = pd.Series(
        {"unique_dst_ports": 500, "unique_dst_hosts": 500, "total_bytes": 1000,
         "total_packets": 100, "avg_packet_size": 10, "syn_ratio": 1.0,
         "bytes_per_second": 10, "flow_count": 500}
    )
    spike_row = pd.Series(
        {"unique_dst_ports": 1, "unique_dst_hosts": 1, "total_bytes": 50_000_000,
         "total_packets": 50_000, "avg_packet_size": 1000, "syn_ratio": 0.0,
         "bytes_per_second": 5_000_000, "flow_count": 50}
    )

    assert detector.classify_anomaly(scan_row) == "port_scan"
    assert detector.classify_anomaly(spike_row) == "traffic_spike"


def test_save_and_load_roundtrip(tmp_path):
    flows = generate_flows(rows=1500, seed=4)
    features = build_features(flows)
    detector = AnomalyDetector(contamination=0.05).fit(features)

    model_path = tmp_path / "model.joblib"
    detector.save(model_path)
    loaded = AnomalyDetector.load(model_path)

    assert (detector.predict(features) == loaded.predict(features)).all()
