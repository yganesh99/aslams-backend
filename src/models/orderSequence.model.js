import mongoose from 'mongoose';


/**
 * Atomic per-period counters for sales order numbers (FH-POS-… / FH-ECOM-…).
 */
const orderSequenceSchema = new mongoose.Schema(
	{
		periodKey: { type: String, required: true },
		seq: { type: Number, required: true, default: 0 },
	},
	{ versionKey: false },
);

orderSequenceSchema.index({ periodKey: 1 }, { unique: true });

export default mongoose.model('OrderSequence', orderSequenceSchema);
