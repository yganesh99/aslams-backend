import Payment from '../models/payment.model.js';


async function create(data) {
	return Payment.create(data);
}

async function getByEntity( entityType, entityId) {
	return Payment.find({ entityType, entityId }).sort({
		createdAt: -1,
	});
}

async function getAll(
	{ entityType, page = 1, limit = 50 } = {},
) {
	const query = {};
	if (entityType) query.entityType = entityType;

	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		Payment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
		Payment.countDocuments(query),
	]);
	return { items, total, page, limit };
}

export { create, getByEntity, getAll };
