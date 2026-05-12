import * as registerService from '../services/register.service.js';


export const createRegister = async (req, res, next) => {
	try {
		const register = await registerService.createRegister(
			req.body.storeId,
			req.body.name,
		);
		res.status(201).json(register);
	} catch (err) {
		next(err);
	}
};

export const getRegisters = async (req, res, next) => {
	try {
		const registers = await registerService.getRegisters(req.query.storeId);
		res.json(registers);
	} catch (err) {
		next(err);
	}
};

export const openSession = async (req, res, next) => {
	try {
		const session = await registerService.openSession(
			req.params.id,
			req.body.openingBalance,
			req.user.id,
		);
		res.status(200).json(session);
	} catch (err) {
		next(err);
	}
};

export const getCurrentSession = async (req, res, next) => {
	try {
		const session = await registerService.getCurrentSession(req.params.id);
		if (!session) {
			return res.status(404).json({ message: 'No active session found' });
		}
		res.json(session);
	} catch (err) {
		next(err);
	}
};

export const closeSession = async (req, res, next) => {
	try {
		const session = await registerService.closeSession(
			req.params.sessionId,
			req.body.closingBalance,
			req.user.id,
		);
		res.json(session);
	} catch (err) {
		next(err);
	}
};
