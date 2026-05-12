import fs from 'fs';
import path from 'path';
import SupplierInvoice from '../models/supplierInvoice.model.js';
import PurchaseOrder from '../models/purchaseOrder.model.js';
import * as creditService from './credit.service.js';
import * as paymentService from './payment.service.js';


/**
 * Create a supplier invoice (validates pricing matches PO) and record AP (recordSupplierPurchase).
 */
async function create(data, userId) {
	const po = await PurchaseOrder.findById(data.purchaseOrderId);
	if (!po) {
		throw Object.assign(new Error('PO not found'), { status: 404 });
	}

	// Validate prices match PO
	for (const invoiceItem of data.items) {
		const poItem = po.items.find(
			(i) => String(i.productId) === String(invoiceItem.productId),
		);
		if (!poItem) {
			throw Object.assign(
				new Error(`Product ${invoiceItem.productId} not in PO`),
				{ status: 400 },
			);
		}
		if (poItem.unitPrice !== invoiceItem.unitPrice) {
			throw Object.assign(
				new Error(
					`Price mismatch for ${poItem.sku}: PO=${poItem.unitPrice}, Invoice=${invoiceItem.unitPrice}`,
				),
				{ status: 400 },
			);
		}
	}

	const invoice = await SupplierInvoice.create({
		supplierId: data.supplierId,
		purchaseOrderId: data.purchaseOrderId,
		invoiceNumber: data.invoiceNumber,
		items: data.items,
		totalAmount: data.totalAmount,
	});

	await creditService.recordSupplierPurchase(
		data.supplierId,
		data.totalAmount,
		data.purchaseOrderId,
		userId,
	);

	return invoice;
}

async function getAll({ supplierId, status, page = 1, limit = 50 } = {}) {
	const query = {};
	if (supplierId) query.supplierId = supplierId;
	if (status) query.status = status;

	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		SupplierInvoice.find(query)
			.populate('supplierId', 'name')
			.populate('purchaseOrderId', 'poNumber')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit),
		SupplierInvoice.countDocuments(query),
	]);
	return { items, total, page, limit };
}

async function getById(id) {
	return SupplierInvoice.findById(id)
		.populate('supplierId', 'name contactPerson')
		.populate('purchaseOrderId', 'poNumber');
}

/**
 * Record payment against a supplier invoice.
 * When updateCredit is true (default): reduces AP via recordSupplierPayment, creates a Payment record, then updates invoice.
 * When updateCredit is false: only updates invoice (used when payment was already recorded via credit endpoint).
 */
async function recordPayment(id, amount, userId, options = {}) {
	const { updateCredit = true, method = 'other', reference } = options;

	const invoice = await SupplierInvoice.findById(id);
	if (!invoice)
		throw Object.assign(new Error('Invoice not found'), { status: 404 });

	if (updateCredit) {
		await creditService.recordSupplierPayment(
			invoice.supplierId,
			amount,
			userId,
		);
		await paymentService.create({
			entityType: 'supplier',
			entityId: invoice.supplierId,
			purchaseOrderId: invoice.purchaseOrderId,
			supplierInvoiceId: id,
			amount,
			method,
			reference: reference || undefined,
			createdBy: userId,
		});
	}

	invoice.paidAmount += amount;
	if (invoice.paidAmount >= invoice.totalAmount) {
		invoice.status = 'paid';
	} else {
		invoice.status = 'partial_paid';
	}
	return invoice.save();
}

/**
 * Add attachments to a supplier invoice.
 */
async function addAttachments(id, files) {
	const invoice = await SupplierInvoice.findById(id);
	if (!invoice)
		throw Object.assign(new Error('Invoice not found'), { status: 404 });

	const newAttachments = files.map((file) => ({
		filename: file.filename,
		originalName: file.originalname,
		mimeType: file.mimetype,
		size: file.size,
		path: file.path,
	}));

	invoice.attachments.push(...newAttachments);
	return invoice.save();
}

/**
 * Remove an attachment from a supplier invoice.
 */
async function removeAttachment(id, filename) {
	const invoice = await SupplierInvoice.findById(id);
	if (!invoice)
		throw Object.assign(new Error('Invoice not found'), { status: 404 });

	const attachmentIndex = invoice.attachments.findIndex(
		(att) => att.filename === filename,
	);

	if (attachmentIndex === -1) {
		throw Object.assign(new Error('Attachment not found'), { status: 404 });
	}

	const [attachment] = invoice.attachments.splice(attachmentIndex, 1);
	await invoice.save();

	// Delete file from disk
	try {
		fs.unlinkSync(attachment.path);
	} catch (err) {
		console.error(`Failed to delete file ${attachment.path}:`, err.message);
	}

	return invoice;
}

export { create, getAll, getById, recordPayment, addAttachments, removeAttachment };
