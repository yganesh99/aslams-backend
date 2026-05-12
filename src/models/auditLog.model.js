import mongoose from 'mongoose';


const auditLogSchema = new mongoose.Schema(
	{
		userId: { type: String, default: null },
		action: { type: String, required: true },
		entity: { type: String, required: true },
		entityId: { type: mongoose.Schema.Types.ObjectId },
		changes: { type: mongoose.Schema.Types.Mixed },
		ipAddress: { type: String },
	},
	{ timestamps: true },
);

auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
