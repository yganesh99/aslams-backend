import Order from '../models/order.model.js';
import * as auditLogService from './auditLog.service.js';
import Return from '../models/return.model.js';
import {
	attachUsersToLeanDoc,
	attachUsersToLeanDocs,
} from '../utils/betterAuthUsers.util.js';


/** Only these may be soft-deleted (no fulfilled / paid POS sales). */
const ORDER_SOFT_DELETE_ALLOWED = ['pending', 'cancelled'];

async function getAll({
	channel,
	status,
	customerId,
	sessionId,
	paymentMethod,
	search,
	startDate,
	endDate,
	page = 1,
	limit = 50,
} = {}) {
	const query = {};
	if (channel) query.channel = channel;
	if (status) query.status = status;
	if (customerId) query.customerId = customerId;
	if (sessionId) query.sessionId = sessionId;
	if (paymentMethod) query.paymentMethod = paymentMethod;
	if (search && search.trim()) {
		query.orderNumber = { $regex: search.trim(), $options: 'i' };
	}
	if (startDate || endDate) {
		query.createdAt = {};
		if (startDate) query.createdAt.$gte = new Date(startDate);
		if (endDate) query.createdAt.$lte = new Date(endDate);
	}

	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		Order.find(query)
			.populate('customerId', 'name email')
			.populate('storeId', 'name code isActive')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit),
		Order.countDocuments(query),
	]);
	return { items, total, page, limit };
}

async function getById(id) {
	const order = await Order.findById(id)
		.populate('customerId', 'name email phone')
		.populate('storeId', 'name code address isActive')
		.lean();
	if (!order) return null;
	await attachUsersToLeanDoc(order, ['createdBy']);
	return order;
}

async function updateStatus(id, status) {
	const order = await Order.findById(id).select('channel status');
	if (!order) return null;

	if (order.channel === 'pos') {
		const err = new Error(
			'POS order status cannot be updated here. Use Refund / Return to set partially_returned or refunded.',
		);
		err.status = 400;
		throw err;
	}

	return Order.findByIdAndUpdate(id, { status }, { new: true });
}

/**
 * Get order history for audit: audit log entries and customer returns/refunds.
 */
async function getOrderHistory(orderId) {
	const order = await Order.findById(orderId).select('_id');
	if (!order) return null;

	const [auditLogs, returns] = await Promise.all([
		auditLogService.getByEntity('Order', orderId),
		Return.find({ orderId, type: 'customer' })
			.sort({ createdAt: -1 })
			.lean(),
	]);
	await attachUsersToLeanDocs(returns, ['createdBy']);

	return { auditLogs, returns };
}

async function remove(id) {
	const order = await Order.findById(id);
	if (!order) return null;

	if (!ORDER_SOFT_DELETE_ALLOWED.includes(order.status)) {
		const err = new Error(
			`Only orders with status ${ORDER_SOFT_DELETE_ALLOWED.join(' or ')} can be removed`,
		);
		err.status = 400;
		throw err;
	}

	order.deletedAt = new Date();
	await order.save();
	return order;
}

export { getAll, getById, updateStatus, getOrderHistory, remove };
