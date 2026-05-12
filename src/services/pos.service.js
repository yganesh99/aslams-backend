import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import Inventory from '../models/inventory.model.js';
import RegisterSession from '../models/registerSession.model.js';
import Return from '../models/return.model.js';
import * as creditService from './credit.service.js';
import * as settingService from './setting.service.js';
import * as inventoryService from './inventory.service.js';
import { logAudit } from '../middlewares/auditLog.js';
import { calculateDiscount } from '../utils/discount.util.js';
import { normalizeQuantity } from '../utils/quantityByUnit.js';
import { availableAtLeast } from '../utils/inventoryMongo.util.js';
import * as fifoService from './inventoryCostFifo.service.js';
import * as storeService from './store.service.js';
import { getDb } from '../betterAuth.js';

import { nextOrderNumber, nextQuoteDisplayNumber } from './orderNumber.service.js';
import { refundForLineQuantity } from '../utils/orderRefund.util.js';

function roundMoney(n) {
	const x = Number(n);
	if (!Number.isFinite(x)) return NaN;
	return Math.round((x + Number.EPSILON) * 100) / 100;
}

const MAX_POS_ORDER_TXN_ATTEMPTS = 8;

function isTransientTxnConflict(err) {
	if (!err || typeof err !== 'object') return false;
	if (err.code === 112 || err.codeName === 'WriteConflict') return true;
	if (
		err.errorLabels &&
		typeof err.errorLabels.has === 'function' &&
		err.errorLabels.has('TransientTransactionError')
	) {
		return true;
	}
	return false;
}

/**
 * Validates tender vs order total (cash) or vs cash lines (split). Returns fields to persist.
 */
function resolveCashTenderFields(
	paymentMethod,
	payments,
	totalAmount,
	cashTendered,
) {
	const total = roundMoney(totalAmount);
	if (paymentMethod === 'cash') {
		if (cashTendered == null || !Number.isFinite(Number(cashTendered))) {
			throw Object.assign(
				new Error('Cash tendered is required for cash payments'),
				{ status: 400 },
			);
		}
		const tender = roundMoney(cashTendered);
		if (!Number.isFinite(tender) || tender < 0) {
			throw Object.assign(new Error('Invalid cash tendered amount'), {
				status: 400,
			});
		}
		if (tender + 1e-9 < total) {
			throw Object.assign(
				new Error('Cash tendered cannot be less than order total'),
				{ status: 400 },
			);
		}
		return { cashTendered: tender, cashChange: roundMoney(tender - total) };
	}

	if (paymentMethod === 'split') {
		const cashDue = roundMoney(
			(payments || []).reduce((sum, p) => {
				if (p && p.method === 'cash')
					return sum + Number(p.amount || 0);
				return sum;
			}, 0),
		);
		if (cashDue <= 0) {
			if (cashTendered != null && Number.isFinite(Number(cashTendered))) {
				throw Object.assign(
					new Error(
						'Cash tendered must not be provided when split has no cash portion',
					),
					{ status: 400 },
				);
			}
			return {};
		}
		if (cashTendered == null || !Number.isFinite(Number(cashTendered))) {
			throw Object.assign(
				new Error(
					'Cash tendered is required when split includes a cash portion',
				),
				{ status: 400 },
			);
		}
		const tender = roundMoney(cashTendered);
		if (tender + 1e-9 < cashDue) {
			throw Object.assign(
				new Error(
					'Cash tendered cannot be less than the cash portion of the payment',
				),
				{ status: 400 },
			);
		}
		return { cashTendered: tender, cashChange: roundMoney(tender - cashDue) };
	}

	if (cashTendered != null && Number.isFinite(Number(cashTendered))) {
		throw Object.assign(
			new Error(
				'Cash tendered is only allowed for cash or split payments',
			),
			{ status: 400 },
		);
	}
	return {};
}

/**
 * Create a POS order (cash / card / QR / split / credit).
 */
async function createOrder(
	storeId,
	{
		customerId,
		items,
		paymentMethod,
		payments,
		notes,
		sessionId,
		discountType,
		discountValue,
		includeTax,
		cashTendered,
	},
	userId,
) {
	for (let attempt = 1; attempt <= MAX_POS_ORDER_TXN_ATTEMPTS; attempt++) {
		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			await storeService.assertStoreActive(storeId);

			if (!sessionId) {
				throw Object.assign(
					new Error('Register session required for POS order'),
					{ status: 400 },
				);
			}

			const activeSession = await RegisterSession.findOne({
				_id: sessionId,
				status: 'open',
			}).session(session);
			if (!activeSession) {
				throw Object.assign(
					new Error('Invalid or closed register session'),
					{ status: 400 },
				);
			}

			// Capture tax rate at order time (can vary over time)
			const taxRate =
				includeTax === false
					? 0
					: await settingService.getSystemTaxRate();

			let subtotal = 0;
			let taxAmount = 0;
			const pricingLines = [];

			for (const item of items) {
				const product = await Product.findById(item.productId).session(
					session,
				);
				if (!product) {
					throw Object.assign(
						new Error(`Product ${item.productId} not found`),
						{ status: 404 },
					);
				}
				if (product.visibility === 'ecommerce_only') {
					throw Object.assign(
						new Error(`Product ${product.sku} is ecommerce-only`),
						{ status: 400 },
					);
				}
				if (!product.isActive) {
					throw Object.assign(
						new Error(`Product ${product.sku} is inactive`),
						{ status: 400 },
					);
				}

				const qty = normalizeQuantity(item.quantity, product.unit);
				const unitPrice = product.posPrice;
				const lineTax = unitPrice * qty * (taxRate / 100);
				const lineTotal = unitPrice * qty + lineTax;

				subtotal += unitPrice * qty;
				taxAmount += lineTax;

				pricingLines.push({
					item,
					product,
					qty,
					unitPrice,
					lineTax,
					lineTotal,
				});
			}

			const discountAmount = calculateDiscount(
				subtotal,
				discountType,
				discountValue,
			);
			const totalAmount = subtotal + taxAmount - discountAmount;
			const cashTenderFields = resolveCashTenderFields(
				paymentMethod,
				payments,
				totalAmount,
				cashTendered,
			);
			let creditUsed = 0;

			// Validate credit if credit payment
			if (paymentMethod === 'credit') {
				if (!customerId) {
					throw Object.assign(
						new Error('Customer required for credit sale'),
						{ status: 400 },
					);
				}
				creditUsed = totalAmount;
			}

			// Counter is updated outside this multi-document transaction to avoid WriteConflict
			// on OrderSequence; aborted sales may leave a gap in the numeric sequence.
			const orderNumber = await nextOrderNumber('pos');

			const orderItems = [];
			for (const line of pricingLines) {
				const { item, product, qty, unitPrice, lineTax, lineTotal } = line;

				const inv = await Inventory.findOneAndUpdate(
					{
						productId: item.productId,
						storeId,
						...availableAtLeast(qty),
					},
					{ $inc: { quantity: -qty } },
					{ new: true, session },
				);

				if (!inv) {
					throw Object.assign(
						new Error(`Insufficient stock for ${product.sku}`),
						{ status: 400 },
					);
				}

				const { cogsTotal, cogsLayers } = await fifoService.consumeFifo(
					session,
					item.productId,
					storeId,
					qty,
				);

				orderItems.push({
					productId: product._id,
					sku: product.sku,
					name: product.name,
					quantity: qty,
					unit: product.unit || 'pcs',
					unitPrice,
					taxRate,
					taxAmount: lineTax,
					lineTotal,
					cogsAmount: cogsTotal,
					cogsLayers: cogsLayers.map((s) => ({
						quantity: s.quantity,
						unitCost: s.unitCost,
						receivedAt: s.receivedAt,
					})),
				});
			}

			const order = await Order.create(
				[
					{
						storeId,
						customerId: customerId || null,
						orderNumber,
						channel: 'pos',
						status: 'confirmed',
						items: orderItems,
						subtotal,
						taxAmount,
						orderTaxRate: taxRate,
						discountType: discountType || null,
						discountValue: discountValue || 0,
						discountAmount,
						totalAmount,
						paymentMethod,
						payments: payments || [],
						...cashTenderFields,
						creditUsed,
						notes,
						sessionId,
						createdBy: userId,
					},
				],
				{ session },
			);

			let creditEntry = null;
			if (paymentMethod === 'credit' && customerId) {
				creditEntry = await creditService.recordCreditSale(
					customerId,
					creditUsed,
					order[0]._id,
					userId,
					{ session },
				);
			}

			await session.commitTransaction();

			logAudit({
				userId,
				action: 'pos_sale',
				entity: 'Order',
				entityId: order[0]._id,
				changes: { totalAmount, paymentMethod, items: orderItems.length },
			});

			if (creditEntry) {
				logAudit({
					userId,
					action: 'credit_sale',
					entity: 'CreditAccount',
					entityId: creditEntry._id,
					changes: {
						customerId,
						amount: creditUsed,
						newBalance: creditEntry.balance,
					},
				});
			}

			return order[0];
		} catch (err) {
			await session.abortTransaction().catch(() => {});
			if (
				attempt < MAX_POS_ORDER_TXN_ATTEMPTS &&
				isTransientTxnConflict(err)
			) {
				continue;
			}
			throw err;
		} finally {
			session.endSession();
		}
	}
}

/**
 * Generate a quote for a POS cart without creating an order record.
 */
async function generateQuote(
	storeId,
	{ customerId, items, notes, discountType, discountValue, includeTax },
	userId,
) {
	await storeService.assertStoreActive(storeId);

	const taxRate =
		includeTax === false ? 0 : await settingService.getSystemTaxRate();
	let subtotal = 0;
	let taxAmount = 0;
	const orderItems = [];

	for (const item of items) {
		const product = await Product.findById(item.productId);
		if (!product) {
			throw Object.assign(
				new Error(`Product ${item.productId} not found`),
				{ status: 404 },
			);
		}
		if (product.visibility === 'ecommerce_only') {
			throw Object.assign(
				new Error(`Product ${product.sku} is ecommerce-only`),
				{ status: 400 },
			);
		}
		if (!product.isActive) {
			throw Object.assign(
				new Error(`Product ${product.sku} is inactive`),
				{ status: 400 },
			);
		}

		const qty = normalizeQuantity(item.quantity, product.unit);
		const unitPrice = product.posPrice;
		const lineTax = unitPrice * qty * (taxRate / 100);
		const lineTotal = unitPrice * qty + lineTax;

		subtotal += unitPrice * qty;
		taxAmount += lineTax;

		orderItems.push({
			productId: product._id,
			sku: product.sku,
			name: product.name,
			quantity: qty,
			unit: product.unit || 'pcs',
			unitPrice,
			taxRate,
			taxAmount: lineTax,
			lineTotal,
		});
	}

	const discountAmount = calculateDiscount(
		subtotal,
		discountType,
		discountValue,
	);
	const totalAmount = subtotal + taxAmount - discountAmount;

	let createdBy = null;
	if (userId) {
		createdBy = await getDb().collection('user').findOne(
			{ _id: userId },
			{ projection: { name: 1 } },
		);
	}

	// Build an order-like object for PDF generation only (not persisted).
	const quote = {
		storeId,
		customerId: customerId || null,
		orderNumber: nextQuoteDisplayNumber(),
		channel: 'pos',
		status: 'pending',
		items: orderItems,
		subtotal,
		taxAmount,
		discountType: discountType || null,
		discountValue: discountValue || 0,
		discountAmount,
		totalAmount,
		paymentMethod: 'cash',
		payments: [],
		creditUsed: 0,
		notes,
		sessionId: null,
		createdBy: createdBy || null,
		createdAt: new Date(),
		isQuote: true,
	};

	return quote;
}

/**
 * Get returned quantities per product for an order (from Return documents).
 */
async function getReturnedQuantitiesByOrder(orderId) {
	const returns = await Return.find({
		orderId,
		type: 'customer',
		status: 'completed',
	}).lean();
	const byProduct = {};
	for (const r of returns) {
		for (const line of r.items || []) {
			const id = String(line.productId);
			byProduct[id] = (byProduct[id] || 0) + line.quantity;
		}
	}
	return byProduct;
}

/**
 * Process a POS return (partial) or refund (full order).
 * Creates a Return document, restocks inventory, updates order status to
 * partially_returned or refunded. Multiple partial returns allowed until
 * all items are returned.
 */
async function processRefund(
	orderId,
	{ items, reason, restockStoreId },
	userId,
) {
	const order = await Order.findById(orderId);
	if (!order) {
		throw Object.assign(new Error('Order not found'), { status: 404 });
	}
	if (order.status === 'refunded' || order.status === 'returned') {
		throw Object.assign(new Error('Order is already fully refunded'), {
			status: 400,
		});
	}

	const orderStore = await storeService.getById(order.storeId);
	if (!orderStore) {
		throw Object.assign(new Error('Order store not found'), { status: 404 });
	}

	let targetStoreId;
	let originalStoreId = null;
	if (orderStore.isActive) {
		targetStoreId = order.storeId;
		if (
			restockStoreId &&
			String(restockStoreId) !== String(order.storeId)
		) {
			throw Object.assign(
				new Error(
					'restockStoreId is only allowed when the order store is inactive',
				),
				{ status: 400 },
			);
		}
	} else {
		if (!restockStoreId) {
			const label = orderStore.name?.trim() || 'This store';
			throw Object.assign(
				new Error(
					`${label} is no longer active; provide restockStoreId for an active store to receive inventory.`,
				),
				{ status: 400 },
			);
		}
		if (String(restockStoreId) === String(order.storeId)) {
			throw Object.assign(
				new Error(
					'Choose a different active store for restock; the order location is inactive.',
				),
				{ status: 400 },
			);
		}
		await storeService.assertStoreActive(restockStoreId);
		targetStoreId = restockStoreId;
		originalStoreId = order.storeId;
	}

	const returnedSoFar = await getReturnedQuantitiesByOrder(orderId);
	const remainingByProduct = {};
	for (const item of order.items) {
		const id = String(item.productId);
		const returned = returnedSoFar[id] || 0;
		remainingByProduct[id] = Math.max(0, item.quantity - returned);
	}

	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		let refundTotal = 0;
		const returnItems = [];

		for (const item of items) {
			const orderItem = order.items.find(
				(oi) => String(oi.productId) === String(item.productId),
			);
			if (!orderItem) {
				throw Object.assign(new Error(`Item not in original order`), {
					status: 400,
				});
			}
			const remaining = remainingByProduct[String(item.productId)] ?? 0;
			if (item.quantity > remaining) {
				throw Object.assign(
					new Error(
						`Cannot return more than ${remaining} of ${orderItem.name} (already returned: ${returnedSoFar[String(item.productId)] || 0})`,
					),
					{ status: 400 },
				);
			}

			// Restock at active order store, or at alternate store when order store is closed
			await inventoryService.restockReturnFifo(
				item.productId,
				targetStoreId,
				item.quantity,
				orderItem.cogsLayers,
				userId,
				session,
			);

			const lineRefund = refundForLineQuantity(order, orderItem, item.quantity);
			refundTotal = roundMoney(refundTotal + lineRefund);
			returnItems.push({
				productId: orderItem.productId,
				quantity: item.quantity,
				unitPrice: orderItem.unitPrice,
				lineTotal: lineRefund,
			});
		}

		// Reduce credit if credit order
		if (order.paymentMethod === 'credit' && order.customerId) {
			await creditService.recordCustomerReturn(
				order.customerId,
				refundTotal,
				orderId,
				userId,
			);
		}

		const returnPayload = {
			type: 'customer',
			entityId: order.customerId || order._id,
			orderId: order._id,
			storeId: targetStoreId,
			items: returnItems,
			totalAmount: refundTotal,
			reason: reason || undefined,
			status: 'completed',
			createdBy: userId,
		};
		if (originalStoreId) {
			returnPayload.originalStoreId = originalStoreId;
		}
		const returnDoc = await Return.create([returnPayload], { session });

		// Update returned counts and decide order status
		for (const item of items) {
			const id = String(item.productId);
			returnedSoFar[id] = (returnedSoFar[id] || 0) + item.quantity;
		}
		const allReturned = order.items.every(
			(oi) => (returnedSoFar[String(oi.productId)] || 0) >= oi.quantity,
		);
		order.status = allReturned ? 'refunded' : 'partially_returned';
		await order.save({ session });

		await session.commitTransaction();

		logAudit({
			userId,
			action: allReturned ? 'pos_refund' : 'pos_return',
			entity: 'Order',
			entityId: orderId,
			changes: {
				refundTotal,
				reason,
				returnId: returnDoc[0]._id,
				restockStoreId: targetStoreId,
				...(originalStoreId && { originalStoreId }),
			},
		});

		return {
			orderId,
			refundTotal,
			returnId: returnDoc[0]._id,
			orderStatus: order.status,
			isFullRefund: allReturned,
		};
	} catch (err) {
		await session.abortTransaction();
		throw err;
	} finally {
		session.endSession();
	}
}

/**
 * List returns for a POS order (for computing remaining returnable quantities).
 * For legacy 'returned' or 'refunded' orders with no Return docs, treat all as returned.
 */
async function getReturnsByOrderId(orderId) {
	const order = await Order.findById(orderId).populate(
		'storeId',
		'name code isActive',
	);
	if (!order) return null;
	const returns = await Return.find({
		orderId,
		type: 'customer',
	})
		.sort({ createdAt: 1 })
		.lean();
	let returnedByProduct = await getReturnedQuantitiesByOrder(orderId);
	// Legacy orders: status 'returned' means full refund with no Return docs
	if (
		(order.status === 'returned' || order.status === 'refunded') &&
		returns.length === 0
	) {
		returnedByProduct = {};
		for (const item of order.items) {
			returnedByProduct[String(item.productId)] = item.quantity;
		}
	}
	return {
		order,
		returns,
		returnedByProduct,
	};
}

export { createOrder, generateQuote, processRefund, getReturnsByOrderId };
