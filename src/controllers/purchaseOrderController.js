import * as poService from '../services/purchaseOrder.service.js';
import { logAudit } from '../middlewares/auditLog.js';
import { generatePurchaseOrder } from '../utils/pdfGenerator.js';


export const create = async (req, res, next) => {
	try {
		const po = await poService.create(req.body, req.user.id);
		res.status(201).json(po);
	} catch (err) {
		next(err);
	}
};

export const getAll = async (req, res, next) => {
	try {
		const result = await poService.getAll(req.query);
		res.json(result);
	} catch (err) {
		next(err);
	}
};

export const getById = async (req, res, next) => {
	try {
		const po = await poService.getById(req.params.id);
		if (!po) return res.status(404).json({ message: 'Not found' });
		res.json(po);
	} catch (err) {
		next(err);
	}
};

export const approve = async (req, res, next) => {
	try {
		const po = await poService.approve(req.params.id, req.user.id);
		if (!po) return res.status(404).json({ message: 'Not found' });
		res.json(po);
	} catch (err) {
		next(err);
	}
};

export const markSent = async (req, res, next) => {
	try {
		const po = await poService.markSent(req.params.id);
		if (!po) return res.status(404).json({ message: 'Not found' });
		res.json(po);
	} catch (err) {
		next(err);
	}
};

export const receive = async (req, res, next) => {
	try {
		const po = await poService.receiveDelivery(
			req.params.id,
			req.body.items,
			req.user.id,
			req.body.storeId,
		);
		res.json(po);
	} catch (err) {
		next(err);
	}
};

export const cancel = async (req, res, next) => {
	try {
		const po = await poService.cancel(req.params.id);
		if (!po) return res.status(404).json({ message: 'Not found' });
		res.json(po);
	} catch (err) {
		next(err);
	}
};

export const remove = async (req, res, next) => {
	try {
		const po = await poService.remove(req.params.id);
		if (!po) return res.status(404).json({ message: 'Not found' });

		logAudit({
			userId: req.user.id,
			action: 'delete',
			entity: 'PurchaseOrder',
			entityId: po._id,
			changes: { deletedAt: po.deletedAt, poNumber: po.poNumber },
		});
		res.status(204).send();
	} catch (err) {
		next(err);
	}
};

export const generatePdf = async (req, res, next) => {
	try {
		const po = await poService.getById(req.params.id);
		if (!po) return res.status(404).json({ message: 'Purchase Order not found' });

		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader(
			'Content-Disposition',
			`inline; filename="PO-${po.poNumber}.pdf"`,
		);

		generatePurchaseOrder(po, res);
	} catch (err) {
		next(err);
	}
};
