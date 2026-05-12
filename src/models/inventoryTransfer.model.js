import mongoose from 'mongoose';


const transferItemSchema = new mongoose.Schema(
	{
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Product',
			required: true,
		},
		quantity: { type: Number, required: true, min: 1 },
	},
	{ _id: false },
);

const inventoryTransferSchema = new mongoose.Schema(
	{
		fromStoreId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Store',
			required: true,
		},
		toStoreId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Store',
			required: true,
		},
		items: { type: [transferItemSchema], required: true },
		status: {
			type: String,
			enum: ['pending', 'completed', 'cancelled'],
			default: 'pending',
		},
		createdBy: { type: String, required: true },
	},
	{ timestamps: true },
);

export default mongoose.model('InventoryTransfer', inventoryTransferSchema);
