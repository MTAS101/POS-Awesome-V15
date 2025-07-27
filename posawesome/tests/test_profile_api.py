import unittest
from unittest import mock

from posawesome.pos_profile.api import resolve_profile


class TestResolveProfile(unittest.TestCase):
    def test_resolves_new_doctype(self):
        with mock.patch('posawesome.pos_profile.api.frappe.db.exists', return_value=True):
            self.assertEqual(resolve_profile('Standard'), 'POS Profile (Awesome)')

    def test_fallback_to_legacy(self):
        with mock.patch('posawesome.pos_profile.api.frappe.db.exists', return_value=False):
            self.assertEqual(resolve_profile('Standard'), 'POS Profile')
