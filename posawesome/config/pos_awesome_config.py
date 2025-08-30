from __future__ import unicode_literals
from frappe import _


def get_data():
    return [
        {
            "label": _("Settings"),
            "items": [
                {
                    "type": "doctype",
                    "name": "POS Awesome User Profile Settings",
                    "description": _("Configure POS Awesome options"),
                },
            ],
        }
    ]
