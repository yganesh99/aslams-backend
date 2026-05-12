import mongoose from 'mongoose';


const sourceSchema = new mongoose.Schema(
	{
		type: {
			type: String,
			enum: ['purchase_order', 'transfer_in', 'return', 'adjustment'],
			required: true,
		},
		purchaseOrderId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'PurchaseOrder',
		},
		poLineIndex: { type: Number },
		inventoryTransferId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'InventoryTransfer',
		},
		orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
		note: { type: String, trim: true },
	},
	{ _id: false },
);

const inventoryCostLayerSchema = new mongoose.Schema(
	{
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Product',
			required: true,
		},
		storeId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Store',
			required: true,
		},
		quantityRemaining: { type: Number, required: true, min: 0 },
		unitCost: { type: Number, required: true, min: 0 },
		/** FIFO ordering: oldest received first. */
		receivedAt: { type: Date, required: true },
		source: { type: sourceSchema, required: true },
	},
	{ timestamps: true },
);

inventoryCostLayerSchema.index({ productId: 1, storeId: 1, receivedAt: 1, _id: 1 });
inventoryCostLayerSchema.index({ storeId: 1, productId: 1 });

export default mongoose.model('InventoryCostLayer', inventoryCostLayerSchema);
