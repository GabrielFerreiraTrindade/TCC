from datetime import datetime, timedelta, timezone

from src.module3_health.telemetry_analysis import detect_crc_errors, detect_flapping

_T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _ts(seconds_offset: int) -> str:
    return (_T0 + timedelta(seconds=seconds_offset)).isoformat()


def test_detect_flapping_below_threshold_is_none():
    history = [
        {"timestamp": _ts(0), "oper_status": "up"},
        {"timestamp": _ts(60), "oper_status": "down"},
        {"timestamp": _ts(120), "oper_status": "up"},
    ]
    assert detect_flapping("Gi1/0/3", history, max_transitions=4) is None


def test_detect_flapping_above_threshold_flags():
    # 5 transições dentro da janela de 300s
    history = [
        {"timestamp": _ts(i * 30), "oper_status": "up" if i % 2 == 0 else "down"}
        for i in range(6)
    ]
    finding = detect_flapping("Gi1/0/3", history, max_transitions=4, window_seconds=300)
    assert finding is not None
    assert finding.rule == "interface_flapping"
    assert finding.evidence["transitions"] >= 5


def test_detect_flapping_ignores_old_transitions_outside_window():
    old = [{"timestamp": _ts(i * 10), "oper_status": "up" if i % 2 == 0 else "down"} for i in range(10)]
    recent_stable = [{"timestamp": _ts(1000 + i * 60), "oper_status": "up"} for i in range(3)]
    finding = detect_flapping("Gi1/0/3", old + recent_stable, max_transitions=4, window_seconds=120)
    assert finding is None


def test_detect_crc_errors_below_threshold_is_none():
    history = [
        {"timestamp": _ts(0), "in_crc_errors": 100},
        {"timestamp": _ts(60), "in_crc_errors": 110},  # ~0.17/s
    ]
    assert detect_crc_errors("Gi1/0/4", history, max_errors_per_second=5.0) is None


def test_detect_crc_errors_above_threshold_flags():
    history = [
        {"timestamp": _ts(0), "in_crc_errors": 100},
        {"timestamp": _ts(10), "in_crc_errors": 300},  # 20/s
    ]
    finding = detect_crc_errors("Gi1/0/4", history, max_errors_per_second=5.0)
    assert finding is not None
    assert finding.rule == "crc_errors"
    assert finding.evidence["errors_per_second"] == 20.0


def test_detect_crc_errors_ignores_counter_reset():
    history = [
        {"timestamp": _ts(0), "in_crc_errors": 5000},
        {"timestamp": _ts(10), "in_crc_errors": 3},  # contador resetado (ex.: interface reload)
    ]
    assert detect_crc_errors("Gi1/0/4", history) is None


def test_needs_at_least_two_samples():
    assert detect_flapping("Gi1/0/3", [{"timestamp": _ts(0), "oper_status": "up"}]) is None
    assert detect_crc_errors("Gi1/0/4", [{"timestamp": _ts(0), "in_crc_errors": 5}]) is None
