import * as supplierInvoiceService from '../services/supplierInvoice.service.js';


export const create = async (req, res, next) => {
	try {
		const invoice = await supplierInvoiceService.create(
			req.body,
			req.user.id,
		);
		res.status(201).json(invoice);
	} catch (err) {
		next(err);
	}
};

export const getAll = async (req, res, next) => {
	try {
		const result = await supplierInvoiceService.getAll(req.query);
		res.json(result);
	} catch (err) {
		next(err);
	}
};

export const getById = async (req, res, next) => {
	try {
		const invoice = await supplierInvoiceService.getById(req.params.id);
		if (!invoice) return res.status(404).json({ message: 'Not found' });
		res.json(invoice);
	} catch (err) {
		next(err);
	}
};

export const recordPayment = async (req, res, next) => {
	try {
		const invoice = await supplierInvoiceService.recordPayment(
			req.params.id,
			req.body.amount,
			req.user.id,
			{
				method: req.body.method,
				reference: req.body.reference,
			},
		);
		res.json(invoice);
	} catch (err) {
		next(err);
	}
};

export const uploadAttachments = async (req, res, next) => {
	try {
		if (!req.files || req.files.length === 0) {
			return res.status(400).json({ message: 'No files uploaded' });
		}
		const invoice = await supplierInvoiceService.addAttachments(
			req.params.id,
			req.files,
		);
		res.json(invoice);
	} catch (err) {
		next(err);
	}
};

export const removeAttachment = async (req, res, next) => {
	try {
		const invoice = await supplierInvoiceService.removeAttachment(
			req.params.id,
			req.params.filename,
		);
		res.json(invoice);
	} catch (err) {
		next(err);
	}
};
