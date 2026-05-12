import mongoose from 'mongoose';


const taxSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		rate: { type: Number, required: true, min: 0 },
		isDefault: { type: Boolean, default: false },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true },
);

taxSchema.index({ name: 1 }, { unique: true });

export default mongoose.model('Tax', taxSchema);
