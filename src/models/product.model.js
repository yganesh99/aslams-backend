import mongoose from 'mongoose';
import softDeletePlugin from '../plugins/softDelete.plugin.js';


const productSchema = new mongoose.Schema(
	{
		sku: { type: String, required: true, trim: true },
		name: { type: String, required: true, trim: true },
		description: { type: String },
		categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
		unit: { type: String, default: 'pcs' },
		posPrice: { type: Number, required: true, min: 0 },
		taxRate: { type: Number, default: 0, min: 0 },
		isActive: { type: Boolean, default: true },
		reorderLevel: { type: Number, default: 0, min: 0 },
		image: { type: String, trim: true },
		images: [{ type: String, trim: true }],
	},
	{ timestamps: true },
);

productSchema.plugin(softDeletePlugin);

productSchema.index(
	{ sku: 1 },
	{ unique: true, partialFilterExpression: { deletedAt: null } },
);
productSchema.index(
	{ name: 1 },
	{ unique: true, partialFilterExpression: { deletedAt: null } },
);
productSchema.index({ name: 'text' });

export default mongoose.model('Product', productSchema);
