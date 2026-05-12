import * as creditService from '../services/credit.service.js';
import * as supplierInvoiceService from '../services/supplierInvoice.service.js';
import * as paymentService from '../services/payment.service.js';
import SupplierInvoice from '../models/supplierInvoice.model.js';


export const getCustomerLedger = async (req, res, next) => {
	try {
		const ledger = await creditService.getLedger('customer', req.params.id);
		res.json(ledger);
	} catch (err) {
		next(err);
	}
};

export const customerPayment = async (req, res, next) => {
	try {
		const entry = await creditService.recordCustomerPayment(
			req.body.customerId,
			req.body.amount,
			req.user.id,
		);
		res.status(201).json(entry);
	} catch (err) {
		next(err);
	}
};

export const getSupplierLedger = async (req, res, next) => {
	try {
		const ledger = await creditService.getLedger('supplier', req.params.id);
		res.json(ledger);
	} catch (err) {
		next(err);
	}
};

export const supplierPayment = async (req, res, next) => {
	try {
		const { supplierId, amount, supplierInvoiceId, method, reference } =
			req.body;

		const entry = await creditService.recordSupplierPayment(
			supplierId,
			amount,
			req.user.id,
		);

		if (supplierInvoiceId) {
			const invoice = await SupplierInvoice.findById(supplierInvoiceId);
			if (!invoice)
				return res.status(404).json({ message: 'Invoice not found' });
			if (String(invoice.supplierId) !== String(supplierId)) {
				return res.status(400).json({
					message: 'Invoice does not belong to this supplier',
				});
			}
			await supplierInvoiceService.recordPayment(
				supplierInvoiceId,
				amount,
				req.user.id,
				{
					updateCredit: false,
					method: method || 'other',
					reference,
				},
			);
			await paymentService.create({
				entityType: 'supplier',
				entityId: supplierId,
				purchaseOrderId: invoice.purchaseOrderId,
				supplierInvoiceId,
				amount,
				method: method || 'other',
				reference: reference || undefined,
				createdBy: req.user.id,
			});
		}

		res.status(201).json(entry);
	} catch (err) {
		next(err);
	}
};
