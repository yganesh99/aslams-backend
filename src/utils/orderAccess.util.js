import mongoose from 'mongoose';
import RegisterSession from '../models/registerSession.model.js';

function sessionIdFromOrder(order) {
	if (!order?.sessionId) return null;
	const s = order.sessionId;
	if (typeof s === 'object' && s !== null && '_id' in s) {
		return String(s._id);
	}
	return String(s);
}

/**
 * Cashier may only read POS orders tied to a register session they opened.
 * @param {import('express').Request} req
 * @param {object | null} order — lean or doc with sessionId
 */
export async function assertCashierCanReadOrder(req, order) {
	if (req.user.role !== 'cashier') return;

	const sid = sessionIdFromOrder(order);
	if (!sid || !mongoose.Types.ObjectId.isValid(sid)) {
		const err = new Error('Forbidden');
		err.status = 403;
		throw err;
	}

	const session = await RegisterSession.findById(sid)
		.select('openedBy')
		.lean();
	if (!session || String(session.openedBy) !== String(req.user.id)) {
		const err = new Error('Forbidden');
		err.status = 403;
		throw err;
	}
}

/**
 * Cashier list: require sessionId query and ownership via RegisterSession.openedBy.
 * @param {import('express').Request} req
 */
export async function assertCashierOrderListQuery(req) {
	if (req.user.role !== 'cashier') return;

	const sessionId = req.query.sessionId;
	if (
		!sessionId ||
		typeof sessionId !== 'string' ||
		!mongoose.Types.ObjectId.isValid(sessionId)
	) {
		const err = new Error(
			'Query parameter sessionId is required to list orders for this role.',
		);
		err.status = 400;
		throw err;
	}

	const session = await RegisterSession.findById(sessionId)
		.select('openedBy')
		.lean();
	if (!session || String(session.openedBy) !== String(req.user.id)) {
		const err = new Error('Forbidden');
		err.status = 403;
		throw err;
	}
}
