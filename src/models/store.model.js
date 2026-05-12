import mongoose from 'mongoose';
import softDeletePlugin from '../plugins/softDelete.plugin.js';


const storeSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		code: { type: String, required: true, trim: true },
		address: {
			street: String,
			city: String,
			state: String,
			zip: String,
			country: String,
		},
		phone: { type: String },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true },
);

storeSchema.plugin(softDeletePlugin);

storeSchema.index(
	{ code: 1 },
	{ unique: true, partialFilterExpression: { deletedAt: null } },
);

export default mongoose.model('Store', storeSchema);
