import frappe
import pytest

from posawesome.pos_profile.api import cache, get_profile, resolve_profile
from posawesome.posawesome.api.utils import get_active_pos_profile


def test_get_active_pos_profile_permission():
    frappe.set_user("Guest")
    with pytest.raises(frappe.PermissionError):
        get_active_pos_profile(user="Guest")


def test_resolve_profile_fallback():
    doc = resolve_profile("POS Profile")
    assert doc.doctype in {"POS Profile Awesome", "POS Profile"}


def test_get_profile_cache():
    cache.clear()
    get_profile("POS Profile")
    assert cache
