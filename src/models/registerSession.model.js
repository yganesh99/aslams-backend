import mongoose from 'mongoose';


const registerSessionSchema = new mongoose.Schema(
	{
		registerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Register',
			required: true,
		},
		storeId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Store',
			required: true,
		},
		openedAt: { type: Date, required: true },
		closedAt: { type: Date, default: null },
		openingBalance: { type: Number, required: true, min: 0 },
		closingBalance: { type: Number, default: 0, min: 0 },
		totalBilled: { type: Number, default: 0, min: 0 },
		status: {
			type: String,
			enum: ['open', 'closed'],
			default: 'open',
		},
		openedBy: { type: String, required: true },
		closedBy: { type: String, default: null },
	},
	{ timestamps: true },
);

// Quick lookup for active session for a register
registerSessionSchema.index({ registerId: 1, status: 1 });

export default mongoose.model('RegisterSession', registerSessionSchema);
