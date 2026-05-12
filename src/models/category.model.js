import mongoose from 'mongoose';
import softDeletePlugin from '../plugins/softDelete.plugin.js';


const categorySchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		description: { type: String, trim: true },
		image: { type: String, trim: true },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true },
);

categorySchema.plugin(softDeletePlugin);

categorySchema.index(
	{ name: 1 },
	{ unique: true, partialFilterExpression: { deletedAt: null } },
);

// Index for text search
categorySchema.index({ name: 'text' });

export default mongoose.model('Category', categorySchema);
