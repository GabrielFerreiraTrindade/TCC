from src.module1_compliance.lambda_handler import flatten_interfaces
from src.module1_compliance.rules import (
    check_insecure_services,
    check_port_security,
    check_qos_policy,
    run_all_rules,
)


def _interface(name="1/0/2", description="User workstation", switchport=True, port_security=None, service_policy=None):
    iface = {"name": name, "description": description}
    if switchport:
        iface["switchport"] = [None]
    iface["switchport-config"] = {"port-security": port_security} if port_security else {}
    iface["service-policy"] = service_policy or {}
    return iface


def test_check_port_security_flags_access_port_without_it():
    interfaces = [_interface()]
    findings = check_port_security(interfaces)
    assert len(findings) == 1
    assert findings[0].rule == "port_security"


def test_check_port_security_ignores_uplink():
    interfaces = [_interface(name="1/0/1", description="Uplink to Core Switch")]
    assert check_port_security(interfaces) == []


def test_check_port_security_passes_when_enabled():
    interfaces = [_interface(port_security={"enable": [None]})]
    assert check_port_security(interfaces) == []


def test_check_qos_policy_flags_missing_policy():
    interfaces = [_interface()]
    findings = check_qos_policy(interfaces)
    assert len(findings) == 1
    assert findings[0].rule == "qos_policy"


def test_check_qos_policy_passes_when_applied():
    interfaces = [_interface(service_policy={"input": "QOS-USER-IN"})]
    assert check_qos_policy(interfaces) == []


def test_check_insecure_services_flags_http_and_telnet():
    native_config = {
        "Cisco-IOS-XE-native:native": {
            "ip": {"http": {"server": True}},
            "line": [{"name": "vty 0 4", "transport": {"input": ["telnet", "ssh"]}}],
        }
    }
    findings = check_insecure_services(native_config)
    rules = {f.rule for f in findings}
    assert rules == {"insecure_service_http", "insecure_service_telnet"}


def test_check_insecure_services_clean_config():
    native_config = {
        "Cisco-IOS-XE-native:native": {
            "ip": {"http": {"server": False, "secure-server": True}},
            "line": [{"name": "vty 0 4", "transport": {"input": ["ssh"]}}],
        }
    }
    assert check_insecure_services(native_config) == []


def test_run_all_rules_against_real_fixtures():
    import json
    from pathlib import Path

    fixtures_dir = Path(__file__).resolve().parent.parent / "src" / "module1_compliance" / "yang_payloads"
    interfaces_config = json.loads((fixtures_dir / "interfaces_config.json").read_text())
    services_config = json.loads((fixtures_dir / "services_config.json").read_text())

    native_interfaces = interfaces_config["Cisco-IOS-XE-native:native"]["interface"]
    interfaces = flatten_interfaces(native_interfaces)

    findings = run_all_rules(interfaces, services_config)
    rules = {f.rule for f in findings}

    # Fixture tem: GigabitEthernet1/0/3 sem port-security nem QoS, HTTP habilitado
    # (ip http server) e Telnet habilitado na vty.
    assert "port_security" in rules
    assert "qos_policy" in rules
    assert "insecure_service_telnet" in rules
    assert "insecure_service_http" in rules
