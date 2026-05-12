import mongoose from 'mongoose';
import PurchaseOrder from '../models/purchaseOrder.model.js';
import Inventory from '../models/inventory.model.js';
import * as fifoService from './inventoryCostFifo.service.js';
import { logAudit } from '../middlewares/auditLog.js';
import * as storeService from './store.service.js';


const PO_SOFT_DELETE_ALLOWED = ['draft', 'cancelled'];

function generatePONumber() {
	const ts = Date.now().toString(36).toUpperCase();
	const rand = Math.random().toString(36).substring(2, 4).toUpperCase();
	return `PO-${ts}-${rand}`;
}

async function create(data, userId) {
	let totalAmount = 0;
	const items = data.items.map((item) => {
		const lineTotal = item.orderedQty * item.unitPrice;
		totalAmount += lineTotal;
		return { ...item, receivedQty: 0, lineTotal };
	});

	return PurchaseOrder.create({
		supplierId: data.supplierId,
		poNumber: generatePONumber(),
		status: 'draft',
		items,
		totalAmount,
		notes: data.notes,
		createdBy: userId,
	});
}

async function getAll({ status, supplierId, page = 1, limit = 50 } = {}) {
	const query = {};
	if (status) query.status = status;
	if (supplierId) query.supplierId = supplierId;

	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		PurchaseOrder.find(query)
			.populate('supplierId', 'name')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit),
		PurchaseOrder.countDocuments(query),
	]);
	return { items, total, page, limit };
}

async function getById(id) {
	return PurchaseOrder.findById(id).populate(
		'supplierId',
		'name contactPerson email phone',
	);
}

async function approve(id, userId) {
	return PurchaseOrder.findByIdAndUpdate(
		id,
		{ status: 'approved', approvedBy: userId },
		{ new: true },
	);
}

async function markSent(id) {
	return PurchaseOrder.findByIdAndUpdate(
		id,
		{ status: 'sent' },
		{ new: true },
	);
}

/**
 * Receive delivery (partial or full).
 * Updates receivedQty for each item, adds to inventory at the given store, and updates PO status.
 */
async function receiveDelivery(id, receivedItems, userId, storeId) {
	if (!storeId) {
		throw Object.assign(
			new Error('storeId is required when receiving goods'),
			{ status: 400 },
		);
	}

	await storeService.assertStoreActive(storeId);

	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const po = await PurchaseOrder.findById(id).session(session);
		if (!po)
			throw Object.assign(new Error('PO not found'), { status: 404 });

		for (const recv of receivedItems) {
			const poItem = po.items.find(
				(i) => String(i.productId) === String(recv.productId),
			);
			if (!poItem) {
				throw Object.assign(
					new Error(`Product ${recv.productId} not in PO`),
					{ status: 400 },
				);
			}

			if (poItem.receivedQty + recv.quantity > poItem.orderedQty) {
				throw Object.assign(
					new Error(
						`Received qty exceeds ordered qty for ${poItem.sku}`,
					),
					{ status: 400 },
				);
			}

			poItem.receivedQty += recv.quantity;

			// Add to inventory at the specified store
			await Inventory.findOneAndUpdate(
				{
					productId: recv.productId,
					storeId,
				},
				{ $inc: { quantity: recv.quantity } },
				{ upsert: true, setDefaultsOnInsert: true, session },
			);

			const poLineIndex = po.items.findIndex(
				(i) => String(i.productId) === String(recv.productId),
			);
			await fifoService.addLayer(session, {
				productId: recv.productId,
				storeId,
				quantity: recv.quantity,
				unitCost: poItem.unitPrice,
				receivedAt: new Date(),
				source: {
					type: 'purchase_order',
					purchaseOrderId: po._id,
					poLineIndex: poLineIndex >= 0 ? poLineIndex : undefined,
				},
			});
		}

		// Check if all items fully received
		const allReceived = po.items.every(
			(i) => i.receivedQty >= i.orderedQty,
		);
		po.status = allReceived ? 'closed' : 'partial_received';
		await po.save({ session });

		await session.commitTransaction();

		logAudit({
			userId,
			action: 'po_receive',
			entity: 'PurchaseOrder',
			entityId: id,
			changes: { receivedItems, newStatus: po.status },
		});

		return po;
	} catch (err) {
		await session.abortTransaction();
		throw err;
	} finally {
		session.endSession();
	}
}

async function cancel(id) {
	return PurchaseOrder.findByIdAndUpdate(
		id,
		{ status: 'cancelled' },
		{ new: true },
	);
}

async function remove(id) {
	const po = await PurchaseOrder.findById(id);
	if (!po) return null;

	if (!PO_SOFT_DELETE_ALLOWED.includes(po.status)) {
		const err = new Error(
			`Only purchase orders with status ${PO_SOFT_DELETE_ALLOWED.join(' or ')} can be removed`,
		);
		err.status = 400;
		throw err;
	}

	po.deletedAt = new Date();
	await po.save();
	return po;
}

export { create, getAll, getById, approve, markSent, receiveDelivery, cancel, remove };
