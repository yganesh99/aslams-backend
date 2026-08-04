import mongoose from 'mongoose';


const invoiceItemSchema = new mongoose.Schema(
	{
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Product',
			required: true,
		},
		sku: { type: String, required: true },
		name: { type: String, required: true },
		quantity: { type: Number, required: true, min: 1 },
		unitPrice: { type: Number, required: true, min: 0 },
		lineTotal: { type: Number, required: true, min: 0 },
	},
	{ _id: false },
);

const supplierInvoiceSchema = new mongoose.Schema(
	{
		supplierId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Supplier',
			required: true,
		},
		purchaseOrderId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'PurchaseOrder',
			required: true,
		},
		invoiceNumber: { type: String, required: true },
		items: { type: [invoiceItemSchema], required: true },
		totalAmount: { type: Number, required: true, min: 0 },
		paymentTerms: {
			type: String,
			enum: ['DUE_ON_RECEIPT', 'NET_15', 'NET_30', 'NET_60'],
			default: 'DUE_ON_RECEIPT',
		},
		paidAmount: { type: Number, default: 0, min: 0 },
		status: {
			type: String,
			enum: ['pending', 'partial_paid', 'paid'],
			default: 'pending',
		},
		attachments: [
			{
				filename: String,
				originalName: String,
				mimeType: String,
				size: Number,
				path: String,
				uploadedAt: { type: Date, default: Date.now },
			},
		],
	},
	{ timestamps: true },
);

supplierInvoiceSchema.index(
	{ invoiceNumber: 1 },
	{ unique: true },
);
supplierInvoiceSchema.index({ supplierId: 1 });

export default mongoose.model('SupplierInvoice', supplierInvoiceSchema);
