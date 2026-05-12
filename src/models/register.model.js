import mongoose from 'mongoose';


const registerSchema = new mongoose.Schema(
	{
		storeId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Store',
			required: true,
		},
		name: { type: String, required: true, trim: true },
		status: {
			type: String,
			enum: ['open', 'closed'],
			default: 'closed',
		},
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true },
);

// A store can't have multiple registers with the same name
registerSchema.index({ storeId: 1, name: 1 }, { unique: true });

export default mongoose.model('Register', registerSchema);
