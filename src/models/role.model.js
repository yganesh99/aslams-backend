import mongoose from 'mongoose';


const roleSchema = new mongoose.Schema(
	{
		slug: {
			type: String,
			unique: true,
			required: true,
			lowercase: true,
			trim: true,
			match: /^[a-z][a-z0-9_]*$/,
		},
		label: { type: String, required: true, trim: true },
		isSystem: { type: Boolean, default: false },
		isStaff: { type: Boolean, default: true },
	},
	{ timestamps: true },
);

export default mongoose.model('Role', roleSchema);
