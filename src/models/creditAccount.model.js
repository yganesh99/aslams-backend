import mongoose from 'mongoose';


const ENTITY_TYPES = ['customer', 'supplier'];
const ENTRY_TYPES = [
	'sale',
	'payment',
	'refund',
	'return',
	'purchase',
	'supplier_payment',
	'supplier_return',
];

const creditAccountSchema = new mongoose.Schema(
	{
		entityType: {
			type: String,
			enum: ENTITY_TYPES,
			required: true,
		},
		entityId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			refPath: 'entityModel',
		},
		entityModel: {
			type: String,
			enum: ['Customer', 'Supplier'],
			required: true,
		},
		type: {
			type: String,
			enum: ENTRY_TYPES,
			required: true,
		},
		amount: { type: Number, required: true },
		balance: { type: Number, required: true },
		orderId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Order',
			default: null,
		},
		purchaseOrderId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'PurchaseOrder',
			default: null,
		},
		description: { type: String },
		createdBy: { type: String, required: true },
	},
	{ timestamps: true },
);

creditAccountSchema.index({ entityType: 1, entityId: 1 });
creditAccountSchema.index({ createdAt: -1 });

export default mongoose.model('CreditAccount', creditAccountSchema);
