import mongoose from 'mongoose';
import InventoryCostLayer from '../models/inventoryCostLayer.model.js';

'use strict';


const QTY_EPS = 1e-6;

function assertSession(session) {
	if (!session) {
		const err = new Error(
			'FIFO operations require an active MongoDB session',
		);
		err.status = 500;
		throw err;
	}
}

/**
 * Add one cost layer (e.g. PO receipt, transfer in, return, positive adjustment).
 */
async function addLayer(
	session,
	{ productId, storeId, quantity, unitCost, receivedAt, source },
) {
	assertSession(session);
	if (quantity <= 0) return null;
	const [doc] = await InventoryCostLayer.create(
		[
			{
				productId,
				storeId,
				quantityRemaining: quantity,
				unitCost,
				receivedAt: receivedAt || new Date(),
				source,
			},
		],
		{ session },
	);
	return doc;
}

/**
 * Consume quantity from oldest layers first. Returns segments for COGS / restore.
 */
async function consumeFifo(session, productId, storeId, quantity) {
	assertSession(session);
	if (quantity <= QTY_EPS) {
		return { cogsTotal: 0, cogsLayers: [] };
	}

	const layers = await InventoryCostLayer.find({
		productId,
		storeId,
		quantityRemaining: { $gt: QTY_EPS },
	})
		.sort({ receivedAt: 1, _id: 1 })
		.session(session);

	let remaining = quantity;
	const cogsLayers = [];
	let cogsTotal = 0;

	for (const layer of layers) {
		if (remaining <= QTY_EPS) break;
		const take = Math.min(remaining, layer.quantityRemaining);
		if (take <= QTY_EPS) continue;

		layer.quantityRemaining =
			Math.round((layer.quantityRemaining - take) * 10000) / 10000;
		if (layer.quantityRemaining <= QTY_EPS) {
			layer.quantityRemaining = 0;
		}
		await layer.save({ session });

		const segment = {
			quantity: take,
			unitCost: layer.unitCost,
			receivedAt: layer.receivedAt,
		};
		cogsLayers.push(segment);
		cogsTotal += take * layer.unitCost;
		remaining = Math.round((remaining - take) * 10000) / 10000;
	}

	if (remaining > QTY_EPS) {
		const err = new Error(
			'Insufficient stock(FIFO cost layers) for this product at this store. Add stock via purchase receive or a positive adjustment with unit cost.',
		);
		err.status = 409;
		throw err;
	}

	return { cogsTotal, cogsLayers };
}

/**
 * Restore inventory cost layers (e.g. customer return), preserving unit cost and FIFO timestamps.
 */
async function restoreLayers(session, productId, storeId, segments, source) {
	assertSession(session);
	if (!segments || segments.length === 0) return;
	for (const seg of segments) {
		if (seg.quantity <= QTY_EPS) continue;
		await addLayer(session, {
			productId,
			storeId,
			quantity: seg.quantity,
			unitCost: seg.unitCost,
			receivedAt: seg.receivedAt || new Date(),
			source,
		});
	}
}

/**
 * Split a return quantity across stored COGS segments (FIFO order from the original sale).
 */
function segmentsForReturn(cogsLayers, returnQty) {
	if (!cogsLayers || cogsLayers.length === 0 || returnQty <= QTY_EPS) {
		return [];
	}
	let remaining = returnQty;
	const out = [];
	for (const seg of cogsLayers) {
		if (remaining <= QTY_EPS) break;
		const cap = seg.quantity;
		const take = Math.min(remaining, cap);
		if (take > QTY_EPS) {
			out.push({
				quantity: take,
				unitCost: seg.unitCost,
				receivedAt: seg.receivedAt
					? new Date(seg.receivedAt)
					: new Date(),
			});
			remaining = Math.round((remaining - take) * 10000) / 10000;
		}
	}
	return out;
}

export { addLayer, consumeFifo, restoreLayers, segmentsForReturn, QTY_EPS };
