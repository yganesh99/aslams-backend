import * as supplierService from '../services/supplier.service.js';
import { logAudit } from '../middlewares/auditLog.js';


export const create = async (req, res, next) => {
	try {
		const supplier = await supplierService.create({
			...req.body,
		});
		res.status(201).json(supplier);
	} catch (err) {
		next(err);
	}
};

export const getAll = async (req, res, next) => {
	try {
		const result = await supplierService.getAll(req.query);
		res.json(result);
	} catch (err) {
		next(err);
	}
};

export const getById = async (req, res, next) => {
	try {
		const supplier = await supplierService.getById(req.params.id);
		if (!supplier) return res.status(404).json({ message: 'Not found' });
		res.json(supplier);
	} catch (err) {
		next(err);
	}
};

export const update = async (req, res, next) => {
	try {
		const supplier = await supplierService.update(req.params.id, req.body);
		if (!supplier) return res.status(404).json({ message: 'Not found' });
		res.json(supplier);
	} catch (err) {
		next(err);
	}
};

export const remove = async (req, res, next) => {
	try {
		const supplier = await supplierService.remove(req.params.id);
		if (!supplier) return res.status(404).json({ message: 'Not found' });

		logAudit({
			userId: req.user.id,
			action: 'delete',
			entity: 'Supplier',
			entityId: supplier._id,
			changes: { deletedAt: supplier.deletedAt },
		});
		res.status(204).send();
	} catch (err) {
		next(err);
	}
};
