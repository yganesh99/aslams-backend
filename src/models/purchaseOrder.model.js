import mongoose from 'mongoose';
import softDeletePlugin from '../plugins/softDelete.plugin.js';


const poItemSchema = new mongoose.Schema(
	{
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Product',
			required: true,
		},
		sku: { type: String, required: true },
		name: { type: String, required: true },
		orderedQty: { type: Number, required: true, min: 1 },
		receivedQty: { type: Number, default: 0, min: 0 },
		unitPrice: { type: Number, required: true, min: 0 },
		lineTotal: { type: Number, required: true, min: 0 },
	},
	{ _id: false },
);

const purchaseOrderSchema = new mongoose.Schema(
	{
		supplierId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Supplier',
			required: true,
		},
		poNumber: { type: String, required: true },
		status: {
			type: String,
			enum: [
				'draft',
				'approved',
				'sent',
				'partial_received',
				'closed',
				'cancelled',
			],
			default: 'draft',
		},
		items: { type: [poItemSchema], required: true },
		totalAmount: { type: Number, required: true, min: 0 },
		notes: { type: String },
		createdBy: { type: String, required: true },
		approvedBy: { type: String, default: null },
	},
	{ timestamps: true },
);

purchaseOrderSchema.plugin(softDeletePlugin);

purchaseOrderSchema.index({ poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ supplierId: 1 });
purchaseOrderSchema.index({ status: 1 });

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
