import * as customerService from '../services/customer.service.js';
import { logAudit } from '../middlewares/auditLog.js';


export const create = async (req, res, next) => {
	try {
		const cust = await customerService.create({
			...req.body,
		});
		res.status(201).json(cust);
	} catch (err) {
		next(err);
	}
};

export const getAll = async (req, res, next) => {
	try {
		if (req.user.role === 'cashier') {
			const q = req.query.search;
			const term =
				q == null ? '' : String(q).trim();
			if (term.length < 2) {
				return res.status(400).json({
					message:
						'Search query (min. 2 characters) is required to list customers for this role.',
				});
			}
		}
		const result = await customerService.getAll(req.query);
		res.json(result);
	} catch (err) {
		next(err);
	}
};

export const getById = async (req, res, next) => {
	try {
		const cust = await customerService.getById(req.params.id);
		if (!cust) return res.status(404).json({ message: 'Not found' });
		res.json(cust);
	} catch (err) {
		next(err);
	}
};

export const update = async (req, res, next) => {
	try {
		const cust = await customerService.update(req.params.id, req.body);
		if (!cust) return res.status(404).json({ message: 'Not found' });
		res.json(cust);
	} catch (err) {
		next(err);
	}
};

export const remove = async (req, res, next) => {
	try {
		const cust = await customerService.remove(req.params.id);
		if (!cust) return res.status(404).json({ message: 'Not found' });

		logAudit({
			userId: req.user.id,
			action: 'delete',
			entity: 'Customer',
			entityId: cust._id,
			changes: { deletedAt: cust.deletedAt },
		});
		res.status(204).send();
	} catch (err) {
		next(err);
	}
};
