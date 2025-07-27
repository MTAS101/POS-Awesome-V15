import types
import sys

import pytest

try:
    import frappe  # noqa: F401
except ModuleNotFoundError:  # pragma: no cover - Frappe not installed in tests
    frappe = types.SimpleNamespace()
    sys.modules["frappe"] = frappe
    frappe.whitelist = lambda **kw: (lambda f: f)

import posawesome.pos_profile.api as api


class FakeFrappeModule(types.SimpleNamespace):
    pass


@pytest.fixture(autouse=True)
def fake_frappe(monkeypatch):
    fake = FakeFrappeModule(db=None)
    monkeypatch.setitem(sys.modules, "frappe", fake)
    api.frappe = fake
    yield fake


class FakeDB:
    def __init__(self, exists=False):
        self._exists = exists

    def exists(self, doctype, name):
        return self._exists


def test_resolve_profile_switches_doctype():
    api.frappe.db = FakeDB(True)
    assert api.resolve_profile("Retail") == "POS Profile (Awesome)"

    api.frappe.db = FakeDB(False)
    assert api.resolve_profile("Retail") == "POS Profile"
