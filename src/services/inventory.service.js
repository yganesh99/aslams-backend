import mongoose from 'mongoose';
import { attachUsersToLeanDocs } from '../utils/betterAuthUsers.util.js';
import Inventory from '../models/inventory.model.js';
import InventoryTransfer from '../models/inventoryTransfer.model.js';
import Product from '../models/product.model.js';
import * as storeService from './store.service.js';
import * as fifoService from './inventoryCostFifo.service.js';
import { logAudit } from '../middlewares/auditLog.js';
import { normalizeQuantity, normalizeQuantityChange } from '../utils/quantityByUnit.js';
import { availableAtLeast } from '../utils/inventoryMongo.util.js';


/**
 * Get stock levels. Optionally filter by store and/or product.
 * When `page` or `limit` is set, returns { items, total, page, limit }; otherwise a full array (legacy).
 */
async function getStock({ storeId, productId, page, limit } = {}) {
	const query = {};
	if (storeId) query.storeId = storeId;
	if (productId) query.productId = productId;

	const baseQuery = () =>
		Inventory.find(query)
			.populate('productId', 'name sku')
			.populate('storeId', 'name code')
			.sort({ _id: 1 });

	const shouldPaginate =
		(page !== undefined && page !== null && String(page) !== '') ||
		(limit !== undefined && limit !== null && String(limit) !== '');

	if (shouldPaginate) {
		const p = Math.max(1, parseInt(String(page), 10) || 1);
		const l = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
		const skip = (p - 1) * l;
		const [items, total] = await Promise.all([
			baseQuery().skip(skip).limit(l).lean(),
			Inventory.countDocuments(query),
		]);
		return { items, total, page: p, limit: l };
	}

	return baseQuery();
}

/**
 * Get total available stock for a product across all stores.
 */
async function getTotalAvailable(productId) {
	const records = await Inventory.find({ productId });
	return records.reduce(
		(sum, r) => sum + (r.quantity - r.reservedQuantity),
		0,
	);
}

/**
 * Adjust stock (manual adjustment with audit trail).
 * Quantity change is normalized by product unit (whole numbers for pcs/bales, decimals for kg/m etc.).
 */
async function adjustStock(
	productId,
	storeId,
	quantityChange,
	userId,
	{
		allowInactiveStore = false,
		unitCost,
		adjustmentNote,
		session: outerSession,
	} = {},
) {
	await storeService.assertStoreActive(storeId, {
		allowInactive: allowInactiveStore,
	});
	const product = await Product.findById(productId).select('unit').lean();
	const unit = product?.unit || 'pcs';
	const normalizedChange = normalizeQuantityChange(quantityChange, unit);
	if (normalizedChange === 0) {
		const inv = await Inventory.findOne({ productId, storeId }).lean();
		return inv || { productId, storeId, quantity: 0, reservedQuantity: 0 };
	}

	const runAdjust = async (session) => {
		if (normalizedChange > 0) {
			if (
				unitCost == null ||
				!Number.isFinite(Number(unitCost)) ||
				Number(unitCost) < 0
			) {
				const err = new Error(
					'unitCost is required and must be >= 0 when increasing stock (FIFO layer)',
				);
				err.status = 400;
				throw err;
			}
			const inv = await Inventory.findOneAndUpdate(
				{ productId, storeId },
				{ $inc: { quantity: normalizedChange } },
				{
					new: true,
					upsert: true,
					setDefaultsOnInsert: true,
					session,
				},
			);
			const reserved = inv.reservedQuantity || 0;
			if (inv.quantity < reserved) {
				await Inventory.findOneAndUpdate(
					{ productId, storeId },
					{ $inc: { quantity: -normalizedChange } },
					{ session },
				);
				const err = new Error(
					'Adjustment would leave quantity below reserved stock',
				);
				err.status = 400;
				throw err;
			}
			await fifoService.addLayer(session, {
				productId,
				storeId,
				quantity: normalizedChange,
				unitCost: Number(unitCost),
				receivedAt: new Date(),
				source: {
					type: 'adjustment',
					note: adjustmentNote || 'manual increase',
				},
			});
			logAudit({
				userId,
				action: 'adjust',
				entity: 'Inventory',
				entityId: inv._id,
				changes: {
					quantityChange: normalizedChange,
					newQuantity: inv.quantity,
					unitCost: Number(unitCost),
				},
			});
			return inv;
		}

		const dec = -normalizedChange;
		const inv = await Inventory.findOneAndUpdate(
			{
				productId,
				storeId,
				...availableAtLeast(dec),
			},
			{ $inc: { quantity: normalizedChange } },
			{ new: true, session },
		);
		if (!inv) {
			const err = new Error(
				'Adjustment would result in negative stock or insufficient available quantity',
			);
			err.status = 400;
			throw err;
		}
		const reserved = inv.reservedQuantity || 0;
		if (inv.quantity < reserved) {
			await Inventory.findOneAndUpdate(
				{ productId, storeId },
				{ $inc: { quantity: -normalizedChange } },
				{ session },
			);
			const err = new Error(
				'Adjustment would leave quantity below reserved stock',
			);
			err.status = 400;
			throw err;
		}
		await fifoService.consumeFifo(session, productId, storeId, dec);
		logAudit({
			userId,
			action: 'adjust',
			entity: 'Inventory',
			entityId: inv._id,
			changes: { quantityChange: normalizedChange, newQuantity: inv.quantity },
		});
		return inv;
	};

	if (outerSession) {
		return runAdjust(outerSession);
	}

	const session = await mongoose.startSession();
	session.startTransaction();
	try {
		const inv = await runAdjust(session);
		await session.commitTransaction();
		return inv;
	} catch (err) {
		await session.abortTransaction();
		throw err;
	} finally {
		session.endSession();
	}
}

/**
 * Normalize item quantities by product unit (fetch products, then normalize each item.quantity).
 */
async function normalizeItemsByUnit(items) {
	if (!items || items.length === 0) return items;
	const productIds = [...new Set(items.map((i) => i.productId))];
	const products = await Product.find({ _id: { $in: productIds } })
		.select('unit')
		.lean();
	const unitByProduct = {};
	for (const p of products) unitByProduct[String(p._id)] = p.unit || 'pcs';
	return items.map((item) => ({
		...item,
		quantity: normalizeQuantity(item.quantity, unitByProduct[String(item.productId)]),
	}));
}

/**
 * Transfer stock between stores (atomic via Mongoose transaction).
 * Item quantities are normalized by product unit.
 */
async function transferStock(fromStoreId, toStoreId, items, userId) {
	await storeService.assertStoreActive(fromStoreId);
	await storeService.assertStoreActive(toStoreId);
	const normalizedItems = await normalizeItemsByUnit(items);
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		for (const item of normalizedItems) {
			const source = await Inventory.findOneAndUpdate(
				{
					productId: item.productId,
					storeId: fromStoreId,
					...availableAtLeast(item.quantity),
				},
				{ $inc: { quantity: -item.quantity } },
				{ new: true, session },
			);

			if (!source) {
				throw new Error(
					`Insufficient stock for product ${item.productId} in source store`,
				);
			}

			const { cogsLayers } = await fifoService.consumeFifo(
				session,
				item.productId,
				fromStoreId,
				item.quantity,
			);

			// Increment destination
			await Inventory.findOneAndUpdate(
				{
					productId: item.productId,
					storeId: toStoreId,
				},
				{ $inc: { quantity: item.quantity } },
				{ new: true, upsert: true, setDefaultsOnInsert: true, session },
			);

			await fifoService.restoreLayers(
				session,
				item.productId,
				toStoreId,
				cogsLayers,
				{
					type: 'transfer_in',
					note: `transfer from store ${fromStoreId}`,
				},
			);
		}

		const transfer = await InventoryTransfer.create(
			[
				{
					fromStoreId,
					toStoreId,
					items: normalizedItems,
					status: 'completed',
					createdBy: userId,
				},
			],
			{ session },
		);

		await session.commitTransaction();

		logAudit({
			userId,
			action: 'transfer',
			entity: 'InventoryTransfer',
			entityId: transfer[0]._id,
			changes: { fromStoreId, toStoreId, items: normalizedItems },
		});

		return transfer[0];
	} catch (err) {
		await session.abortTransaction();
		if (!err.status) err.status = 400;
		throw err;
	} finally {
		session.endSession();
	}
}

/**
 * List inventory transfers (movement log). Optional filters: storeId (from or to), pagination.
 */
async function listTransfers({ storeId, page = 1, limit = 20 } = {}) {
	const query = {};
	if (storeId) {
		query.$or = [
			{ fromStoreId: storeId },
			{ toStoreId: storeId },
		];
	}
	const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
	const [items, total] = await Promise.all([
		InventoryTransfer.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(Math.min(100, Math.max(1, limit)))
			.populate('fromStoreId', 'name code')
			.populate('toStoreId', 'name code')
			.populate('items.productId', 'name sku unit')
			.lean(),
		InventoryTransfer.countDocuments(query),
	]);
	await attachUsersToLeanDocs(items, ['createdBy']);
	return { items, total, page: Math.max(1, page), limit: Math.min(100, Math.max(1, limit)) };
}

/**
 * Ensure / initialize inventory record for a product at a store.
 */
async function ensureRecord(productId, storeId) {
	await storeService.assertStoreActive(storeId);
	return Inventory.findOneAndUpdate(
		{ productId, storeId },
		{ $setOnInsert: { quantity: 0, reservedQuantity: 0 } },
		{ upsert: true, new: true, setDefaultsOnInsert: true },
	);
}

/**
 * Restock after a return using original COGS segments when available.
 */
async function restockReturnFifo(
	productId,
	storeId,
	quantity,
	orderItemCogsLayers,
	userId,
	mongoSession,
) {
	let segments = fifoService.segmentsForReturn(orderItemCogsLayers, quantity);
	if (segments.length === 0 && quantity > fifoService.QTY_EPS) {
		segments = [
			{
				quantity,
				unitCost: 0,
				receivedAt: new Date(),
			},
		];
	}
	const addQty = segments.reduce((a, s) => a + s.quantity, 0);
	const inv = await Inventory.findOneAndUpdate(
		{ productId, storeId },
		{ $inc: { quantity: addQty } },
		{
			new: true,
			upsert: true,
			setDefaultsOnInsert: true,
			session: mongoSession,
		},
	);
	await fifoService.restoreLayers(mongoSession, productId, storeId, segments, {
		type: 'return',
	});
	logAudit({
		userId,
		action: 'return_restock',
		entity: 'Inventory',
		entityId: inv._id,
		changes: { quantity: addQty, newQuantity: inv.quantity },
	});
	return inv;
}

export { getStock, getTotalAvailable, adjustStock, transferStock, listTransfers, ensureRecord, restockReturnFifo };
