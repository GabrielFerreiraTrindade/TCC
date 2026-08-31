from src.bot.actions import RemediationExecutor, _split_interface
from src.shared.models import ActionType, ProposedAction


class FakeRestconfClient:
    """Duplo de teste: registra chamadas em vez de falar HTTP de verdade."""

    def __init__(self, get_return=None):
        self.get_calls: list[str] = []
        self.patch_calls: list[tuple[str, dict]] = []
        self._get_return = get_return or {}

    def get(self, xpath: str):
        self.get_calls.append(xpath)
        return self._get_return

    def patch(self, xpath: str, payload: dict):
        self.patch_calls.append((xpath, payload))


def test_split_interface():
    assert _split_interface("GigabitEthernet1/0/2") == ("GigabitEthernet", "1/0/2")


def test_apply_enable_port_security_builds_expected_xpath():
    client = FakeRestconfClient(get_return={"enable": []})
    executor = RemediationExecutor(client)
    action = ProposedAction(type=ActionType.ENABLE_PORT_SECURITY, device_id="sw1", interface="GigabitEthernet1/0/3")

    result = executor.apply(action)

    assert result.applied is True
    assert result.xpath == "Cisco-IOS-XE-native:native/interface/GigabitEthernet=1/0/3"
    assert client.patch_calls[0][0] == result.xpath
    assert "port-security" in str(client.patch_calls[0][1])


def test_apply_isolate_host_uses_acl_xpath():
    client = FakeRestconfClient()
    executor = RemediationExecutor(client)
    action = ProposedAction(type=ActionType.ISOLATE_HOST, device_id="sw1", params={"src_ip": "10.0.0.42"})

    result = executor.apply(action)

    assert result.applied is True
    assert "access-list" in result.xpath
    assert "10.0.0.42" in str(client.patch_calls[0][1])


def test_apply_unsupported_action_type_reports_error():
    client = FakeRestconfClient()
    executor = RemediationExecutor(client)
    action = ProposedAction(type=ActionType.NONE, device_id="sw1")

    result = executor.apply(action)

    assert result.applied is False
    assert result.error is not None
    assert not client.patch_calls


def test_rollback_replays_previous_state():
    client = FakeRestconfClient(get_return={"shutdown": []})
    executor = RemediationExecutor(client)
    action = ProposedAction(type=ActionType.SHUTDOWN_INTERFACE, device_id="sw1", interface="GigabitEthernet1/0/3")

    result = executor.apply(action)
    executor.rollback(result)

    assert client.patch_calls[-1] == (result.xpath, {"shutdown": []})


def test_apply_action_missing_interface_reports_error_not_exception():
    client = FakeRestconfClient()
    executor = RemediationExecutor(client)
    action = ProposedAction(type=ActionType.SHUTDOWN_INTERFACE, device_id="sw1")  # sem interface

    result = executor.apply(action)

    assert result.applied is False
    assert result.error is not None
