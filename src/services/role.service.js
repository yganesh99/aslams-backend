import Role from '../models/role.model.js';
import { getDb } from '../betterAuth.js';


const DEFAULT_ROLES = [
	{ slug: 'admin', label: 'Admin', isSystem: true, isStaff: true },
	{ slug: 'store_manager', label: 'Store Manager', isSystem: false, isStaff: true },
	{ slug: 'inventory_manager', label: 'Inventory Manager', isSystem: false, isStaff: true },
	{ slug: 'accountant', label: 'Accountant', isSystem: false, isStaff: true },
	{ slug: 'cashier', label: 'Cashier', isSystem: false, isStaff: true },
	{ slug: 'customer', label: 'Customer', isSystem: true, isStaff: false },
];

export const getAll = async () => {
	return Role.find().sort({ isSystem: -1, label: 1 }).lean();
};

export const getStaffRoles = async () => {
	return Role.find({ isStaff: true }).sort({ isSystem: -1, label: 1 }).lean();
};

export const getConfigurableRoles = async () => {
	return Role.find({ isStaff: true, isSystem: false }).sort({ label: 1 }).lean();
};

export const getBySlug = async (slug) => {
	return Role.findOne({ slug }).lean();
};

export const isValidRole = async (slug) => {
	return !!(await Role.exists({ slug }));
};

export const create = async ({ slug, label }) => {
	return Role.create({ slug, label, isSystem: false, isStaff: true });
};

export const update = async (slug, { label }) => {
	const role = await Role.findOne({ slug });
	if (!role) return null;
	if (role.isSystem) {
		throw Object.assign(new Error('System roles cannot be modified'), {
			status: 403,
		});
	}
	role.label = label;
	await role.save();
	return role.toObject();
};

export const remove = async (slug) => {
	const role = await Role.findOne({ slug });
	if (!role) return null;
	if (role.isSystem) {
		throw Object.assign(new Error('System roles cannot be deleted'), {
			status: 403,
		});
	}
	const usersWithRole = await getDb().collection('user').countDocuments({ role: slug });
	if (usersWithRole > 0) {
		throw Object.assign(
			new Error(
				`Cannot delete role "${slug}": ${usersWithRole} user(s) still assigned to it`,
			),
			{ status: 409 },
		);
	}
	await Role.deleteOne({ slug });
	return role.toObject();
};

export const seedDefaults = async () => {
	const existing = await Role.find().lean();
	const existingSlugs = new Set(existing.map((r) => r.slug));

	const toInsert = DEFAULT_ROLES.filter((r) => !existingSlugs.has(r.slug));
	if (toInsert.length > 0) {
		await Role.insertMany(toInsert);
		console.log(
			`[Role] Seeded defaults: ${toInsert.map((r) => r.slug).join(', ')}`,
		);
	}
};

export const getStaffSlugs = async () => {
	const roles = await Role.find({ isStaff: true }).select('slug').lean();
	return roles.map((r) => r.slug);
};
