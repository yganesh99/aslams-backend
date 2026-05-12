import mongoose from 'mongoose';
import Register from '../models/register.model.js';
import RegisterSession from '../models/registerSession.model.js';
import Order from '../models/order.model.js';
import { logAudit } from '../middlewares/auditLog.js';
import * as storeService from './store.service.js';
import { attachUsersToLeanDoc } from '../utils/betterAuthUsers.util.js';


export const createRegister = async (storeId, name) => {
	await storeService.assertStoreActive(storeId);
	const register = await Register.create({ storeId, name });
	return register;
};

export const getRegisters = async (storeId) => {
	const query = storeId ? { storeId } : {};
	return await Register.find(query).sort({ createdAt: -1 });
};

export const getRegisterById = async (id) => {
	return await Register.findById(id);
};

export const openSession = async (registerId, openingBalance, userId) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const register = await Register.findById(registerId).session(session);
		if (!register) {
			throw Object.assign(new Error('Register not found'), {
				status: 404,
			});
		}
		await storeService.assertStoreActive(register.storeId);
		if (register.status === 'open') {
			throw Object.assign(new Error('Register is already open'), {
				status: 400,
			});
		}

		// Create session
		const registerSession = await RegisterSession.create(
			[
				{
					registerId,
					storeId: register.storeId,
					openedAt: new Date(),
					openingBalance,
					openedBy: userId,
					status: 'open',
				},
			],
			{ session },
		);

		// Update register status
		register.status = 'open';
		await register.save({ session });

		await session.commitTransaction();

		logAudit({
			userId,
			action: 'open_register',
			entity: 'Register',
			entityId: registerId,
			changes: { openingBalance },
		});

		return registerSession[0];
	} catch (err) {
		await session.abortTransaction();
		throw err;
	} finally {
		session.endSession();
	}
};

export const getCurrentSession = async (registerId) => {
	const doc = await RegisterSession.findOne({
		registerId,
		status: 'open',
	}).lean();
	if (!doc) return null;
	await attachUsersToLeanDoc(doc, ['openedBy', 'closedBy']);
	return doc;
};

export const closeSession = async (sessionId, closingBalance, userId) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const registerSession =
			await RegisterSession.findById(sessionId).session(session);
		if (!registerSession) {
			throw Object.assign(new Error('Session not found'), {
				status: 404,
			});
		}
		if (registerSession.status === 'closed') {
			throw Object.assign(new Error('Session is already closed'), {
				status: 400,
			});
		}

		// Calculate total billed from orders in this session
		const orders = await Order.find({ sessionId }).session(session);
		const totalBilled = orders.reduce(
			(sum, order) => sum + order.totalAmount,
			0,
		);

		registerSession.status = 'closed';
		registerSession.closedAt = new Date();
		registerSession.closingBalance = closingBalance;
		registerSession.totalBilled = totalBilled;
		registerSession.closedBy = userId;
		await registerSession.save({ session });

		const register = await Register.findById(
			registerSession.registerId,
		).session(session);
		register.status = 'closed';
		await register.save({ session });

		await session.commitTransaction();

		logAudit({
			userId,
			action: 'close_register',
			entity: 'Register',
			entityId: register._id,
			changes: { closingBalance, totalBilled },
		});

		return registerSession;
	} catch (err) {
		await session.abortTransaction();
		throw err;
	} finally {
		session.endSession();
	}
};
