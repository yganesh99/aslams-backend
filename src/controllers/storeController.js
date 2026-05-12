import * as storeService from '../services/store.service.js';
import { logAudit } from '../middlewares/auditLog.js';


export const create = async (req, res, next) => {
	try {
		const store = await storeService.create({
			...req.body,
		});
		res.status(201).json(store);
	} catch (err) {
		next(err);
	}
};

export const getAll = async (req, res, next) => {
	try {
		const list = await storeService.getAll();
		res.json(list);
	} catch (err) {
		next(err);
	}
};

export const getById = async (req, res, next) => {
	try {
		const store = await storeService.getById(req.params.id);
		if (!store) return res.status(404).json({ message: 'Not found' });
		res.json(store);
	} catch (err) {
		next(err);
	}
};

export const update = async (req, res, next) => {
	try {
		const store = await storeService.update(req.params.id, req.body);
		if (!store) return res.status(404).json({ message: 'Not found' });
		res.json(store);
	} catch (err) {
		next(err);
	}
};

export const toggleActive = async (req, res, next) => {
	try {
		const store = await storeService.toggleActive(req.params.id);
		if (!store) return res.status(404).json({ message: 'Not found' });
		res.json(store);
	} catch (err) {
		next(err);
	}
};

export const remove = async (req, res, next) => {
	try {
		const store = await storeService.remove(req.params.id);
		if (!store) return res.status(404).json({ message: 'Not found' });

		logAudit({
			userId: req.user.id,
			action: 'delete',
			entity: 'Store',
			entityId: store._id,
			changes: { deletedAt: store.deletedAt },
		});
		res.status(204).send();
	} catch (err) {
		next(err);
	}
};
