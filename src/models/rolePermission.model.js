import mongoose from 'mongoose';


const ALL_SECTION_KEYS = [
	'dashboard',
	'inventory.products',
	'inventory.categories',
	'inventory.purchase-orders',
	'inventory.transfers',
	'inventory.supplier-invoices',
	'sales',
	'accounts.customers',
	'accounts.suppliers',
	'stores',
	'reports',
	'users',
	'settings',
	'pos',
	'pos.orders',
	'pos.customers',
];

const rolePermissionSchema = new mongoose.Schema(
	{
		role: {
			type: String,
			unique: true,
			required: true,
		},
		sections: [
			{
				type: String,
				enum: ALL_SECTION_KEYS,
			},
		],
	},
	{ timestamps: true },
);

export default mongoose.model('RolePermission', rolePermissionSchema);
export { ALL_SECTION_KEYS };
