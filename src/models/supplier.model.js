import mongoose from 'mongoose';
import softDeletePlugin from '../plugins/softDelete.plugin.js';


const supplierSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		contactPerson: { type: String, trim: true },
		email: { type: String, lowercase: true, trim: true },
		phone: { type: String },
		address: {
			street: String,
			city: String,
			state: String,
			zip: String,
			country: String,
		},
		leadTimeDays: { type: Number, default: 0, min: 0 },
		currentBalance: { type: Number, default: 0, min: 0 },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true },
);

supplierSchema.plugin(softDeletePlugin);

export default mongoose.model('Supplier', supplierSchema);
