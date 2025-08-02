# Copyright (c) 2024, POS Awesome and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import strip


class POSProfileSettings(Document):
	def autoname(self):
		if self.pos_profile:
			self.name = self.pos_profile

	def validate(self):
		self.validate_pos_profile()
		self.validate_company_warehouse()
		self.validate_active_profile()
		self.validate_discount_settings()
		self.validate_search_settings()
		self.validate_cache_settings()
		self.validate_payment_settings()

	def validate_pos_profile(self):
		"""Validate that POS Profile is provided and unique"""
		if not self.pos_profile:
			frappe.throw(_("POS Profile is required"))
		
		# Check for duplicate POS Profile Settings
		existing = frappe.db.exists("POS Profile Settings", {
			"pos_profile": self.pos_profile,
			"name": ["!=", self.name]
		})
		if existing:
			frappe.throw(_("Settings for POS Profile '{0}' already exists").format(self.pos_profile))

	def onload(self):
		"""Load company and warehouse from POS Profile when document is loaded"""
		if self.pos_profile and not self.company:
			self.load_from_pos_profile()

	def load_from_pos_profile(self):
		"""Load company and warehouse from the selected POS Profile"""
		if self.pos_profile:
			pos_profile = frappe.get_doc("POS Profile", self.pos_profile)
			self.company = pos_profile.company
			self.warehouse = pos_profile.warehouse
			self.refresh_field("company")
			self.refresh_field("warehouse")

	def validate_company_warehouse(self):
		"""Validate that the warehouse belongs to the selected company"""
		if self.warehouse and self.company:
			warehouse_company = frappe.db.get_value("Warehouse", self.warehouse, "company")
			if warehouse_company and warehouse_company != self.company:
				frappe.throw(_("Warehouse {0} does not belong to company {1}").format(
					self.warehouse, self.company
				))

	def validate_active_profile(self):
		"""Ensure only one active profile per company"""
		if self.is_active and self.company:
			existing_active = frappe.db.exists("POS Profile Settings", {
				"company": self.company,
				"is_active": 1,
				"name": ["!=", self.name]
			})
			if existing_active:
				frappe.throw(_("Only one active POS Profile Settings is allowed per company"))

	def validate_discount_settings(self):
		"""Validate discount-related settings"""
		if self.posa_use_percentage_discount and self.posa_max_discount_allowed:
			if self.posa_max_discount_allowed < 0 or self.posa_max_discount_allowed > 100:
				frappe.throw(_("Max Discount Percentage must be between 0 and 100"))

	def validate_search_settings(self):
		"""Validate search-related settings"""
		if self.pose_use_limit_search and self.posa_search_limit:
			if self.posa_search_limit <= 0:
				frappe.throw(_("Search Limit Number must be greater than 0"))
			if self.posa_search_limit > 1500:
				frappe.msgprint(_("Search limit is set to {0}. For best performance, keep this under 1500.").format(
					self.posa_search_limit
				), indicator="orange")

	def validate_cache_settings(self):
		"""Validate cache-related settings"""
		if self.posa_use_server_cache and self.posa_server_cache_duration:
			if self.posa_server_cache_duration <= 0:
				frappe.throw(_("Server Cache Duration must be greater than 0"))
			if self.posa_server_cache_duration > 1440:  # 24 hours
				frappe.msgprint(_("Cache duration is set to {0} minutes. Consider using a shorter duration for better performance.").format(
					self.posa_server_cache_duration
				), indicator="orange")

	def validate_payment_settings(self):
		"""Validate payment-related settings"""
		if self.posa_use_pos_awesome_payments:
			if not self.posa_allow_make_new_payments and not self.posa_allow_reconcile_payments:
				frappe.msgprint(_("POS Awesome Payments is enabled but no payment actions are allowed. Consider enabling at least one payment action."), 
					indicator="orange")

	def on_update(self):
		"""Clear cache when profile settings are updated"""
		frappe.clear_cache(doctype="POS Profile Settings")
		# Clear POS Awesome cache if server cache is enabled
		if self.posa_use_server_cache:
			frappe.clear_cache(doctype="POS Profile")

	def on_trash(self):
		"""Validate before deletion"""
		if self.is_active:
			frappe.throw(_("Cannot delete active POS Profile Settings. Please deactivate first."))


@frappe.whitelist()
def get_active_profile_settings(company=None):
	"""Get active POS Profile Settings for a company"""
	if not company:
		company = frappe.defaults.get_user_default("Company")
	
	if not company:
		return None
	
	profile_settings = frappe.db.get_value("POS Profile Settings", {
		"company": company,
		"is_active": 1
	}, "name")
	
	if profile_settings:
		return frappe.get_doc("POS Profile Settings", profile_settings)
	
	return None


@frappe.whitelist()
def get_profile_settings_by_name(profile_name):
	"""Get POS Profile Settings by name"""
	if frappe.db.exists("POS Profile Settings", profile_name):
		return frappe.get_doc("POS Profile Settings", profile_name)
	return None


@frappe.whitelist()
def get_profile_settings_by_pos_profile(pos_profile):
	"""Get POS Profile Settings by POS Profile"""
	if frappe.db.exists("POS Profile Settings", {"pos_profile": pos_profile}):
		return frappe.get_doc("POS Profile Settings", {"pos_profile": pos_profile})
	return None


@frappe.whitelist()
def apply_profile_settings_to_pos_profile(profile_settings_name, pos_profile_name):
	"""Apply POS Profile Settings to an existing POS Profile"""
	if not frappe.db.exists("POS Profile Settings", profile_settings_name):
		frappe.throw(_("POS Profile Settings not found"))
	
	if not frappe.db.exists("POS Profile", pos_profile_name):
		frappe.throw(_("POS Profile not found"))
	
	settings = frappe.get_doc("POS Profile Settings", profile_settings_name)
	pos_profile = frappe.get_doc("POS Profile", pos_profile_name)
	
	# Apply all the settings to the POS Profile
	for field in settings.meta.fields:
		if field.fieldname.startswith('posa_') and field.fieldtype in ['Check', 'Int', 'Float', 'Data', 'Select', 'Link']:
			if hasattr(settings, field.fieldname) and getattr(settings, field.fieldname) is not None:
				setattr(pos_profile, field.fieldname, getattr(settings, field.fieldname))
	
	pos_profile.save()
	frappe.msgprint(_("POS Profile Settings applied successfully to {0}").format(pos_profile_name))


@frappe.whitelist()
def create_pos_profile_from_settings(profile_settings_name, new_pos_profile_name):
	"""Create a new POS Profile from POS Profile Settings"""
	if not frappe.db.exists("POS Profile Settings", profile_settings_name):
		frappe.throw(_("POS Profile Settings not found"))
	
	settings = frappe.get_doc("POS Profile Settings", profile_settings_name)
	
	# Create new POS Profile
	pos_profile = frappe.new_doc("POS Profile")
	pos_profile.name = new_pos_profile_name
	pos_profile.company = settings.company
	pos_profile.warehouse = settings.warehouse
	
	# Apply all the settings
	for field in settings.meta.fields:
		if field.fieldname.startswith('posa_') and field.fieldtype in ['Check', 'Int', 'Float', 'Data', 'Select', 'Link']:
			if hasattr(settings, field.fieldname) and getattr(settings, field.fieldname) is not None:
				setattr(pos_profile, field.fieldname, getattr(settings, field.fieldname))
	
	pos_profile.insert()
	frappe.msgprint(_("New POS Profile '{0}' created successfully from settings").format(new_pos_profile_name))
	
	return pos_profile.name 