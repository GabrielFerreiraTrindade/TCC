import pytest
import responses

from src.shared.config import SwitchConfig
from src.shared.restconf_client import RestconfClient, RestconfError

_CONFIG = SwitchConfig(host="http://switch.local", username="admin", password="admin", verify_tls=False)


@responses.activate
def test_get_returns_json():
    responses.add(
        responses.GET,
        "http://switch.local/restconf/data/ietf-interfaces:interfaces",
        json={"ietf-interfaces:interfaces": {"interface": []}},
        status=200,
    )
    client = RestconfClient(_CONFIG)
    data = client.get("ietf-interfaces:interfaces")
    assert data == {"ietf-interfaces:interfaces": {"interface": []}}


@responses.activate
def test_get_raises_restconf_error_on_http_failure():
    responses.add(
        responses.GET,
        "http://switch.local/restconf/data/bad-xpath",
        status=404,
    )
    client = RestconfClient(_CONFIG)
    with pytest.raises(RestconfError):
        client.get("bad-xpath")


@responses.activate
def test_patch_sends_payload():
    responses.add(
        responses.PATCH,
        "http://switch.local/restconf/data/ietf-interfaces:interfaces/interface=Gi1",
        status=204,
    )
    client = RestconfClient(_CONFIG)
    client.patch("ietf-interfaces:interfaces/interface=Gi1", {"enabled": False})

    assert len(responses.calls) == 1
    assert responses.calls[0].request.body is not None
