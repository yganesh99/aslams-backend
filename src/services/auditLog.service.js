import AuditLog from '../models/auditLog.model.js';
import { attachUsersToLeanDocs } from '../utils/betterAuthUsers.util.js';


async function getAll(
	{
		entity,
		entityId,
		action,
		userId,
		startDate,
		endDate,
		page = 1,
		limit = 50,
	} = {},
) {
	const query = {};
	if (entity) query.entity = entity;
	if (entityId) query.entityId = entityId;
	if (action) query.action = action;
	if (userId) query.userId = userId;
	if (startDate || endDate) {
		query.createdAt = {};
		if (startDate) query.createdAt.$gte = new Date(startDate);
		if (endDate) query.createdAt.$lte = new Date(endDate);
	}

	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		AuditLog.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),
		AuditLog.countDocuments(query),
	]);
	await attachUsersToLeanDocs(items, ['userId']);
	return { items, total, page, limit };
}

async function getByEntity(entity, entityId) {
	const items = await AuditLog.find({ entity, entityId })
		.sort({ createdAt: -1 })
		.lean();
	await attachUsersToLeanDocs(items, ['userId']);
	return items;
}

export { getAll, getByEntity };
