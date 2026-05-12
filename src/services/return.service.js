import Return from '../models/return.model.js';


async function create(data) {
	return Return.create(data);
}

async function getAll(
	{ type, status, page = 1, limit = 50 } = {},
) {
	const query = {};
	if (type) query.type = type;
	if (status) query.status = status;

	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		Return.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
		Return.countDocuments(query),
	]);
	return { items, total, page, limit };
}

async function getById(id) {
	return Return.findById(id);
}

async function updateStatus(id, status) {
	return Return.findByIdAndUpdate(id, { status }, { new: true });
}

export { create, getAll, getById, updateStatus };
