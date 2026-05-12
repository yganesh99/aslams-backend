import mongoose from 'mongoose';


const returnItemSchema = new mongoose.Schema(
	{
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Product',
			required: true,
		},
		quantity: { type: Number, required: true, min: 1 },
		unitPrice: { type: Number, required: true, min: 0 },
		lineTotal: { type: Number, required: true, min: 0 },
	},
	{ _id: false },
);

const returnSchema = new mongoose.Schema(
	{
		type: {
			type: String,
			enum: ['customer', 'supplier'],
			required: true,
		},
		entityId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
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
		storeId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Store',
			required: true,
		},
		/** Original order store when stock was received elsewhere (e.g. closed location). */
		originalStoreId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Store',
			default: null,
		},
		items: { type: [returnItemSchema], required: true },
		totalAmount: { type: Number, required: true, min: 0 },
		reason: { type: String },
		status: {
			type: String,
			enum: ['pending', 'approved', 'completed'],
			default: 'pending',
		},
		createdBy: { type: String, required: true },
	},
	{ timestamps: true },
);

returnSchema.index({ type: 1 });
returnSchema.index({ orderId: 1 });

export default mongoose.model('Return', returnSchema);
