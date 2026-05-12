import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import Inventory from '../models/inventory.model.js';
import Customer from '../models/customer.model.js';
import Supplier from '../models/supplier.model.js';
import PurchaseOrder from '../models/purchaseOrder.model.js';
import SupplierInvoice from '../models/supplierInvoice.model.js';
import Return from '../models/return.model.js';
import RegisterSession from '../models/registerSession.model.js';
import Product from '../models/product.model.js';
import InventoryCostLayer from '../models/inventoryCostLayer.model.js';
import CreditAccount from '../models/creditAccount.model.js';


/**
 * Sales by store.
 */
async function salesByStore({ startDate, endDate, storeId } = {}) {
	const match = {
		status: { $nin: ['cancelled', 'returned', 'refunded'] },
		deletedAt: null,
	};
	if (storeId) {
		match.storeId =
			typeof storeId === 'string'
				? new mongoose.Types.ObjectId(storeId)
				: storeId;
	}
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return Order.aggregate([
		{ $match: match },
		{
			$group: {
				_id: '$storeId',
				totalSales: { $sum: '$totalAmount' },
				totalOrders: { $sum: 1 },
				avgOrderValue: { $avg: '$totalAmount' },
			},
		},
		{
			$lookup: {
				from: 'stores',
				localField: '_id',
				foreignField: '_id',
				as: 'store',
			},
		},
		{ $unwind: '$store' },
		{ $sort: { totalSales: -1 } },
	]);
}

/**
 * Sales by product.
 */
async function salesByProduct({ startDate, endDate, storeId } = {}) {
	const match = {
		status: { $nin: ['cancelled', 'returned', 'refunded'] },
		deletedAt: null,
	};
	if (storeId) {
		match.storeId =
			typeof storeId === 'string'
				? new mongoose.Types.ObjectId(storeId)
				: storeId;
	}
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return Order.aggregate([
		{ $match: match },
		{ $unwind: '$items' },
		{
			$group: {
				_id: '$items.productId',
				sku: { $first: '$items.sku' },
				name: { $first: '$items.name' },
				totalQuantity: { $sum: '$items.quantity' },
				totalRevenue: { $sum: '$items.lineTotal' },
			},
		},
		{ $sort: { totalRevenue: -1 } },
	]);
}

/**
 * Revenue per product.
 * Thin wrapper around salesByProduct to provide a more
 * finance-oriented naming.
 */
async function revenuePerProduct(params = {}) {
	return salesByProduct(params);
}

/**
 * Sales by cashier.
 */
async function salesByCashier({ startDate, endDate, storeId } = {}) {
	const match = {
		channel: 'pos',
		status: { $nin: ['cancelled', 'returned', 'refunded'] },
		deletedAt: null,
	};
	if (storeId) {
		match.storeId =
			typeof storeId === 'string'
				? new mongoose.Types.ObjectId(storeId)
				: storeId;
	}
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return Order.aggregate([
		{ $match: match },
		{
			$group: {
				_id: '$createdBy',
				totalSales: { $sum: '$totalAmount' },
				totalOrders: { $sum: 1 },
			},
		},
		{
			$lookup: {
				from: 'user',
				localField: '_id',
				foreignField: '_id',
				as: 'cashier',
			},
		},
		{ $unwind: '$cashier' },
		{
			$project: {
				cashierName: '$cashier.name',
				totalSales: 1,
				totalOrders: 1,
			},
		},
		{ $sort: { totalSales: -1 } },
	]);
}

/**
 * Sales by register (POS only).
 */
async function salesByRegister({ startDate, endDate, storeId } = {}) {
	const match = {
		channel: 'pos',
		status: { $nin: ['cancelled', 'returned', 'refunded'] },
		sessionId: { $ne: null },
		deletedAt: null,
	};
	if (storeId) {
		match.storeId =
			typeof storeId === 'string'
				? new mongoose.Types.ObjectId(storeId)
				: storeId;
	}
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return Order.aggregate([
		{ $match: match },
		{
			$group: {
				_id: '$sessionId',
				totalSales: { $sum: '$totalAmount' },
				totalOrders: { $sum: 1 },
			},
		},
		{
			$lookup: {
				from: 'registersessions',
				localField: '_id',
				foreignField: '_id',
				as: 'session',
			},
		},
		{ $unwind: '$session' },
		{
			$lookup: {
				from: 'registers',
				localField: 'session.registerId',
				foreignField: '_id',
				as: 'register',
			},
		},
		{ $unwind: '$register' },
		{
			$lookup: {
				from: 'stores',
				localField: 'session.storeId',
				foreignField: '_id',
				as: 'store',
			},
		},
		{ $unwind: '$store' },
		{
			$project: {
				_id: 1,
				totalSales: 1,
				totalOrders: 1,
				registerId: '$register._id',
				registerName: '$register.name',
				storeId: '$store._id',
				storeName: '$store.name',
				openedAt: '$session.openedAt',
				closedAt: '$session.closedAt',
			},
		},
		{ $sort: { openedAt: -1 } },
	]);
}

/**
 * Low stock: active products with reorderLevel > 0 where total **available**
 * (quantity − reserved, summed across all stores) is strictly less than reorderLevel.
 */
async function lowStock() {
	return Product.aggregate([
		{
			$match: {
				isActive: true,
				reorderLevel: { $gt: 0 },
				deletedAt: null,
			},
		},
		{
			$lookup: {
				from: 'inventories',
				let: { pid: '$_id' },
				pipeline: [
					{
						$match: {
							$expr: { $eq: ['$productId', '$$pid'] },
						},
					},
					{
						$group: {
							_id: null,
							totalAvailable: {
								$sum: {
									$subtract: [
										'$quantity',
										{ $ifNull: ['$reservedQuantity', 0] },
									],
								},
							},
						},
					},
				],
				as: 'invTotals',
			},
		},
		{
			$addFields: {
				totalAvailable: {
					$ifNull: [
						{ $arrayElemAt: ['$invTotals.totalAvailable', 0] },
						0,
					],
				},
			},
		},
		{
			$match: {
				$expr: { $lt: ['$totalAvailable', '$reorderLevel'] },
			},
		},
		{ $sort: { name: 1 } },
		{
			$project: {
				_id: 0,
				productId: {
					_id: '$_id',
					name: '$name',
					sku: '$sku',
					reorderLevel: '$reorderLevel',
				},
				quantity: '$totalAvailable',
				reservedQuantity: { $literal: 0 },
				reorderLevel: '$reorderLevel',
			},
		},
	]);
}

/**
 * Total stock per product aggregated across all stores.
 */
async function totalStock({ productId } = {}) {
	const match = {};
	if (productId) {
		match.productId =
			typeof productId === 'string'
				? new mongoose.Types.ObjectId(productId)
				: productId;
	}

	return Inventory.aggregate([
		{ $match: match },
		{
			$group: {
				_id: '$productId',
				quantity: { $sum: '$quantity' },
				reservedQuantity: { $sum: '$reservedQuantity' },
				storeCount: { $sum: 1 },
			},
		},
		{
			$lookup: {
				from: 'products',
				let: { pid: '$_id' },
				pipeline: [
					{
						$match: {
							$expr: { $eq: ['$_id', '$$pid'] },
							deletedAt: null,
						},
					},
				],
				as: 'product',
			},
		},
		{ $unwind: '$product' },
		{
			$project: {
				_id: 1,
				productId: '$product._id',
				productName: '$product.name',
				sku: '$product.sku',
				quantity: 1,
				reservedQuantity: 1,
				availableQuantity: {
					$subtract: ['$quantity', '$reservedQuantity'],
				},
				storeCount: 1,
			},
		},
		{ $sort: { productName: 1 } },
	]);
}

/**
 * Current stock levels by store and product.
 */
async function currentStockLevels({ storeId, productId } = {}) {
	const match = {};
	if (storeId) {
		match.storeId =
			typeof storeId === 'string'
				? new mongoose.Types.ObjectId(storeId)
				: storeId;
	}
	if (productId) {
		match.productId =
			typeof productId === 'string'
				? new mongoose.Types.ObjectId(productId)
				: productId;
	}

	return Inventory.aggregate([
		{ $match: match },
		{
			$lookup: {
				from: 'products',
				let: { pid: '$productId' },
				pipeline: [
					{
						$match: {
							$expr: { $eq: ['$_id', '$$pid'] },
							deletedAt: null,
						},
					},
				],
				as: 'product',
			},
		},
		{ $unwind: '$product' },
		{
			$lookup: {
				from: 'stores',
				let: { sid: '$storeId' },
				pipeline: [
					{
						$match: {
							$expr: { $eq: ['$_id', '$$sid'] },
							deletedAt: null,
						},
					},
				],
				as: 'store',
			},
		},
		{ $unwind: '$store' },
		{
			$project: {
				_id: 1,
				productId: '$product._id',
				productName: '$product.name',
				sku: '$product.sku',
				storeId: '$store._id',
				storeName: '$store.name',
				quantity: 1,
				reservedQuantity: 1,
				availableQuantity: {
					$subtract: ['$quantity', '$reservedQuantity'],
				},
			},
		},
		{
			$sort: {
				storeName: 1,
				productName: 1,
			},
		},
	]);
}

/**
 * Inventory valuation (FIFO cost layers; not retail price).
 */
async function inventoryValuation() {
	const rows = await InventoryCostLayer.aggregate([
		{ $match: { quantityRemaining: { $gt: 0 } } },
		{
			$group: {
				_id: null,
				totalUnits: { $sum: '$quantityRemaining' },
				totalValue: {
					$sum: {
						$multiply: ['$quantityRemaining', '$unitCost'],
					},
				},
			},
		},
	]);
	if (!rows.length) {
		return [{ totalUnits: 0, totalValue: 0 }];
	}
	return rows;
}

/**
 * Customer credit exposure.
 */
async function customerCreditExposure() {
	return Customer.find({ currentBalance: { $gt: 0 } })
		.select('name email phone creditLimit currentBalance')
		.sort({ currentBalance: -1 });
}

/**
 * Supplier payables summary.
 */
async function supplierPayables() {
	return Supplier.find({ currentBalance: { $gt: 0 } })
		.select('name contactPerson email currentBalance')
		.sort({ currentBalance: -1 });
}

/**
 * Profit per SKU.
 */
async function profitPerSku({ startDate, endDate } = {}) {
	const match = {
		status: {
			$nin: ['cancelled', 'returned', 'refunded', 'pending'],
		},
		deletedAt: null,
	};
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return Order.aggregate([
		{ $match: match },
		{ $unwind: '$items' },
		{
			$lookup: {
				from: 'products',
				localField: 'items.productId',
				foreignField: '_id',
				as: 'product',
			},
		},
		{ $unwind: '$product' },
		{
			$group: {
				_id: '$items.productId',
				sku: { $first: '$items.sku' },
				name: { $first: '$items.name' },
				totalRevenue: { $sum: '$items.lineTotal' },
				totalCost: {
					$sum: { $ifNull: ['$items.cogsAmount', 0] },
				},
				totalQuantity: { $sum: '$items.quantity' },
			},
		},
		{
			$addFields: {
				profit: { $subtract: ['$totalRevenue', '$totalCost'] },
				margin: {
					$cond: [
						{ $eq: ['$totalRevenue', 0] },
						0,
						{
							$multiply: [
								{
									$divide: [
										{
											$subtract: [
												'$totalRevenue',
												'$totalCost',
											],
										},
										'$totalRevenue',
									],
								},
								100,
							],
						},
					],
				},
			},
		},
		{ $sort: { profit: -1 } },
	]);
}

/**
 * Tax collected (by store and optional date range).
 */
async function taxCollected({ startDate, endDate, storeId } = {}) {
	const match = {
		status: { $nin: ['cancelled', 'returned', 'refunded'] },
		deletedAt: null,
	};
	if (storeId) {
		match.storeId =
			typeof storeId === 'string'
				? new mongoose.Types.ObjectId(storeId)
				: storeId;
	}
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return Order.aggregate([
		{ $match: match },
		{
			$group: {
				_id: '$storeId',
				totalTax: { $sum: '$taxAmount' },
				totalSales: { $sum: '$totalAmount' },
				orderCount: { $sum: 1 },
			},
		},
		{
			$lookup: {
				from: 'stores',
				localField: '_id',
				foreignField: '_id',
				as: 'store',
			},
		},
		{ $unwind: '$store' },
		{
			$project: {
				storeId: '$store._id',
				storeName: '$store.name',
				totalTax: 1,
				totalSales: 1,
				orderCount: 1,
			},
		},
		{ $sort: { totalTax: -1 } },
	]);
}

/**
 * Returns and refunds summary.
 */
async function returnsAndRefundsSummary({ startDate, endDate } = {}) {
	const match = {};
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return Return.aggregate([
		{ $match: match },
		{
			$group: {
				_id: { type: '$type', storeId: '$storeId' },
				totalAmount: { $sum: '$totalAmount' },
				count: { $sum: 1 },
			},
		},
		{
			$lookup: {
				from: 'stores',
				localField: '_id.storeId',
				foreignField: '_id',
				as: 'store',
			},
		},
		{ $unwind: '$store' },
		{
			$project: {
				type: '$_id.type',
				storeId: '$store._id',
				storeName: '$store.name',
				totalAmount: 1,
				count: 1,
			},
		},
		{ $sort: { totalAmount: -1 } },
	]);
}

/**
 * Purchase order status summary.
 */
async function purchaseOrderStatusSummary({ startDate, endDate } = {}) {
	const match = { deletedAt: null };
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return PurchaseOrder.aggregate([
		{ $match: match },
		{
			$group: {
				_id: '$status',
				totalAmount: { $sum: '$totalAmount' },
				count: { $sum: 1 },
			},
		},
		{ $sort: { _id: 1 } },
	]);
}

/**
 * Supplier invoice payment status.
 */
async function supplierInvoicePaymentStatus({ startDate, endDate } = {}) {
	const match = {};
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return SupplierInvoice.aggregate([
		{ $match: match },
		{
			$project: {
				supplierId: 1,
				invoiceNumber: 1,
				totalAmount: 1,
				paidAmount: 1,
				outstandingAmount: {
					$max: [
						0,
						{ $subtract: ['$totalAmount', '$paidAmount'] },
					],
				},
				status: 1,
				createdAt: 1,
			},
		},
		{
			$lookup: {
				from: 'suppliers',
				localField: 'supplierId',
				foreignField: '_id',
				as: 'supplier',
			},
		},
		{ $unwind: '$supplier' },
		{
			$project: {
				_id: 1,
				invoiceNumber: 1,
				supplierName: '$supplier.name',
				totalAmount: 1,
				paidAmount: 1,
				outstandingAmount: 1,
				status: 1,
				createdAt: 1,
			},
		},
		{ $sort: { createdAt: -1 } },
	]);
}

/**
 * Daily sales summary by store.
 */
async function dailySalesSummary({ startDate, endDate, storeId } = {}) {
	const match = {
		status: { $nin: ['cancelled', 'returned', 'refunded'] },
		deletedAt: null,
	};
	if (storeId) {
		match.storeId =
			typeof storeId === 'string'
				? new mongoose.Types.ObjectId(storeId)
				: storeId;
	}
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return Order.aggregate([
		{ $match: match },
		{
			$group: {
				_id: {
					storeId: '$storeId',
					day: {
						$dateToString: {
							format: '%Y-%m-%d',
							date: '$createdAt',
						},
					},
				},
				totalSales: { $sum: '$totalAmount' },
				orderCount: { $sum: 1 },
			},
		},
		{
			$lookup: {
				from: 'stores',
				localField: '_id.storeId',
				foreignField: '_id',
				as: 'store',
			},
		},
		{ $unwind: '$store' },
		{
			$project: {
				storeId: '$_id.storeId',
				storeName: '$store.name',
				day: '$_id.day',
				totalSales: 1,
				orderCount: 1,
			},
		},
		{ $sort: { day: -1, storeName: 1 } },
	]);
}

/**
 * Monthly sales summary by store.
 */
async function monthlySalesSummary({ startDate, endDate, storeId } = {}) {
	const match = {
		status: { $nin: ['cancelled', 'returned', 'refunded'] },
		deletedAt: null,
	};
	if (storeId) {
		match.storeId =
			typeof storeId === 'string'
				? new mongoose.Types.ObjectId(storeId)
				: storeId;
	}
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return Order.aggregate([
		{ $match: match },
		{
			$group: {
				_id: {
					storeId: '$storeId',
					month: {
						$dateToString: {
							format: '%Y-%m',
							date: '$createdAt',
						},
					},
				},
				totalSales: { $sum: '$totalAmount' },
				orderCount: { $sum: 1 },
			},
		},
		{
			$lookup: {
				from: 'stores',
				localField: '_id.storeId',
				foreignField: '_id',
				as: 'store',
			},
		},
		{ $unwind: '$store' },
		{
			$project: {
				storeId: '$_id.storeId',
				storeName: '$store.name',
				month: '$_id.month',
				totalSales: 1,
				orderCount: 1,
			},
		},
		{ $sort: { month: -1, storeName: 1 } },
	]);
}

/**
 * Customer credit settlement history — every credit/debit entry per customer.
 */
async function customerCreditSettlementHistory({
	startDate,
	endDate,
	customerId,
} = {}) {

	const match = { entityType: 'customer' };
	if (customerId) {
		match.entityId =
			typeof customerId === 'string'
				? new mongoose.Types.ObjectId(customerId)
				: customerId;
	}
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return CreditAccount.aggregate([
		{ $match: match },
		{
			$lookup: {
				from: 'customers',
				localField: 'entityId',
				foreignField: '_id',
				as: 'customer',
			},
		},
		{ $unwind: '$customer' },
		{
			$lookup: {
				from: 'orders',
				localField: 'orderId',
				foreignField: '_id',
				as: 'order',
			},
		},
		{
			$unwind: {
				path: '$order',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$project: {
				_id: 1,
				customerId: '$customer._id',
				customerName: '$customer.name',
				type: 1,
				amount: 1,
				balance: 1,
				orderNumber: { $ifNull: ['$order.orderNumber', null] },
				description: 1,
				createdAt: 1,
			},
		},
		{ $sort: { customerName: 1, createdAt: -1 } },
	]);
}

/**
 * Supplier payables history — every credit/debit entry per supplier.
 */
async function supplierPayablesHistory({
	startDate,
	endDate,
	supplierId,
} = {}) {

	const match = { entityType: 'supplier' };
	if (supplierId) {
		match.entityId =
			typeof supplierId === 'string'
				? new mongoose.Types.ObjectId(supplierId)
				: supplierId;
	}
	if (startDate || endDate) {
		match.createdAt = {};
		if (startDate) match.createdAt.$gte = new Date(startDate);
		if (endDate) match.createdAt.$lte = new Date(endDate);
	}

	return CreditAccount.aggregate([
		{ $match: match },
		{
			$lookup: {
				from: 'suppliers',
				localField: 'entityId',
				foreignField: '_id',
				as: 'supplier',
			},
		},
		{ $unwind: '$supplier' },
		{
			$lookup: {
				from: 'purchaseorders',
				localField: 'purchaseOrderId',
				foreignField: '_id',
				as: 'po',
			},
		},
		{
			$unwind: {
				path: '$po',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$project: {
				_id: 1,
				supplierId: '$supplier._id',
				supplierName: '$supplier.name',
				type: 1,
				amount: 1,
				balance: 1,
				poNumber: { $ifNull: ['$po.poNumber', null] },
				description: 1,
				createdAt: 1,
			},
		},
		{ $sort: { supplierName: 1, createdAt: -1 } },
	]);
}

export { salesByStore, salesByProduct, salesByCashier, salesByRegister, lowStock, totalStock, currentStockLevels, inventoryValuation, customerCreditExposure, supplierPayables, profitPerSku, revenuePerProduct, taxCollected, returnsAndRefundsSummary, purchaseOrderStatusSummary, supplierInvoicePaymentStatus, dailySalesSummary, monthlySalesSummary, customerCreditSettlementHistory, supplierPayablesHistory };
