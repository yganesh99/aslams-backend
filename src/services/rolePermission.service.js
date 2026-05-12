import RolePermission from '../models/rolePermission.model.js';
import { ALL_SECTION_KEYS } from '../models/rolePermission.model.js';


const DEFAULT_PERMISSIONS = {
	admin: [...ALL_SECTION_KEYS],
	store_manager: [
		'dashboard',
		'inventory.products',
		'inventory.categories',
		'inventory.purchase-orders',
		'inventory.transfers',
		'inventory.supplier-invoices',
		'stores',
		'reports',
		'sales',
	],
	inventory_manager: [
		'dashboard',
		'inventory.products',
		'inventory.categories',
		'inventory.purchase-orders',
		'inventory.transfers',
	],
	accountant: [
		'dashboard',
		'inventory.supplier-invoices',
		'sales',
		'accounts.customers',
		'accounts.suppliers',
		'reports',
	],
	cashier: ['pos', 'pos.orders', 'pos.customers'],
};

export const getAll = async () => {
	return RolePermission.find().lean();
};

export const getByRole = async (role) => {
	return RolePermission.findOne({ role }).lean();
};

export const upsert = async (role, sections) => {
	return RolePermission.findOneAndUpdate(
		{ role },
		{ sections },
		{ upsert: true, new: true, runValidators: true },
	).lean();
};

export const getSectionsForRole = async (role) => {
	if (role === 'admin') return [...ALL_SECTION_KEYS];
	const doc = await RolePermission.findOne({ role }).lean();
	return doc ? doc.sections : [];
};

export const seedDefaults = async () => {
	const existing = await RolePermission.find().lean();
	const existingRoles = new Set(existing.map((d) => d.role));

	const toInsert = Object.entries(DEFAULT_PERMISSIONS)
		.filter(([role]) => !existingRoles.has(role))
		.map(([role, sections]) => ({ role, sections }));

	if (toInsert.length > 0) {
		await RolePermission.insertMany(toInsert);
		console.log(
			`[RolePermission] Seeded defaults for: ${toInsert.map((d) => d.role).join(', ')}`,
		);
	}
};
