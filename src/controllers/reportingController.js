import * as reportingService from '../services/reporting.service.js';
import * as auditLogService from '../services/auditLog.service.js';
import Inventory from '../models/inventory.model.js';
import InventoryTransfer from '../models/inventoryTransfer.model.js';
import AuditLog from '../models/auditLog.model.js';
import { attachUsersToLeanDocs } from '../utils/betterAuthUsers.util.js';


export const salesByStore = async (req, res, next) => {
	try {
		const data = await reportingService.salesByStore(
			req.query,
		);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['Store', 'Total Orders', 'Total Sales', 'Avg Order Value'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.store?.name || row.storeName || row._id,
						row.totalOrders,
						row.totalSales,
						row.avgOrderValue,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="sales-by-store.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const salesByProduct = async (req, res, next) => {
	try {
		const data = await reportingService.salesByProduct(
			req.query,
		);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['SKU', 'Product', 'Quantity', 'Revenue'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.sku,
						row.name,
						row.totalQuantity,
						row.totalRevenue,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="sales-by-product.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const salesByCashier = async (req, res, next) => {
	try {
		const data = await reportingService.salesByCashier(
			req.query,
		);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['Cashier', 'Total Orders', 'Total Sales'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.cashierName,
						row.totalOrders,
						row.totalSales,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="sales-by-cashier.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const salesByRegister = async (req, res, next) => {
	try {
		const data = await reportingService.salesByRegister(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = [
				'Register',
				'Store',
				'Opened At',
				'Closed At',
				'Total Orders',
				'Total Sales',
			];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.registerName,
						row.storeName,
						row.openedAt,
						row.closedAt,
						row.totalOrders,
						row.totalSales,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="sales-by-register.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const lowStock = async (req, res, next) => {
	try {
		const data = await reportingService.lowStock();
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = [
				'Scope',
				'SKU',
				'Product',
				'Available',
				'Reorder level',
				'Reserved',
			];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						'All stores',
						row.productId?.sku,
						row.productId?.name,
						row.quantity,
						row.reorderLevel,
						row.reservedQuantity,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="low-stock.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const totalStock = async (req, res, next) => {
	try {
		const data = await reportingService.totalStock(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = [
				'SKU',
				'Product',
				'On Hand',
				'Reserved',
				'Available',
				'Stores',
			];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.sku,
						row.productName,
						row.quantity,
						row.reservedQuantity,
						row.availableQuantity,
						row.storeCount,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="total-stock-report.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const currentStockLevels = async (req, res, next) => {
	try {
		const data = await reportingService.currentStockLevels(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = [
				'Store',
				'SKU',
				'Product',
				'On Hand',
				'Reserved',
				'Available',
			];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.storeName,
						row.sku,
						row.productName,
						row.quantity,
						row.reservedQuantity,
						row.availableQuantity,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="current-stock-levels.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const inventoryValuation = async (req, res, next) => {
	try {
		const data = await reportingService.inventoryValuation();
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['Total Units', 'Total Value'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[row.totalUnits, row.totalValue]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="inventory-valuation.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const creditExposure = async (req, res, next) => {
	try {
		const data = await reportingService.customerCreditExposure(
			);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = [
				'Customer',
				'Email',
				'Phone',
				'Credit Limit',
				'Current Balance',
			];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.name,
						row.email,
						row.phone,
						row.creditLimit,
						row.currentBalance,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="customer-credit-summary.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const supplierPayables = async (req, res, next) => {
	try {
		const data = await reportingService.supplierPayables();
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['Supplier', 'Contact', 'Email', 'Current Balance'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.name,
						row.contactPerson,
						row.email,
						row.currentBalance,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="supplier-payables.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const profitPerSku = async (req, res, next) => {
	try {
		const data = await reportingService.profitPerSku(
			req.query,
		);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = [
				'SKU',
				'Product',
				'Quantity',
				'Revenue',
				'Cost',
				'Profit',
				'Margin %',
			];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.sku,
						row.name,
						row.totalQuantity,
						row.totalRevenue,
						row.totalCost,
						row.profit,
						row.margin,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="profit-per-sku.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const revenuePerProduct = async (req, res, next) => {
	try {
		const data = await reportingService.revenuePerProduct(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['SKU', 'Product', 'Quantity', 'Revenue'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.sku,
						row.name,
						row.totalQuantity,
						row.totalRevenue,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="revenue-per-product.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const inventoryMovements = async (req, res, next) => {
	try {
		const { productId, storeId: filterStoreId } = req.query;
		if (!productId) {
			return res
				.status(400)
				.json({ message: 'productId query parameter is required' });
		}

		const page = req.query.page ? parseInt(req.query.page, 10) : 1;
		const limitRaw = req.query.limit ? parseInt(req.query.limit, 10) : 50;
		const limit = Math.min(100, Math.max(1, limitRaw || 50));

		const inventoryRecords = await Inventory.find({ productId })
			.select('_id storeId')
			.populate('storeId', 'name code')
			.lean();

		const inventoryIds = inventoryRecords.map((r) => String(r._id));
		const storeByInventoryId = {};
		for (const rec of inventoryRecords) {
			storeByInventoryId[String(rec._id)] = rec.storeId;
		}

		const [adjustLogs, transfers] = await Promise.all([
			inventoryIds.length
				? AuditLog.find({
						entity: 'Inventory',
						entityId: { $in: inventoryIds },
					}).lean()
				: [],
			InventoryTransfer.find({ 'items.productId': productId })
				.populate('fromStoreId', 'name code')
				.populate('toStoreId', 'name code')
				.lean(),
		]);
		await attachUsersToLeanDocs(adjustLogs, ['userId']);
		await attachUsersToLeanDocs(transfers, ['createdBy']);

		const adjustEvents = adjustLogs.map((log) => ({
			type: 'ADJUSTMENT',
			date: log.createdAt,
			quantityChange: log.changes?.quantityChange ?? 0,
			store: storeByInventoryId[String(log.entityId)] || null,
			user: log.userId || null,
			reference: null,
			meta: {
				logId: log._id,
				newQuantity: log.changes?.newQuantity,
			},
		}));

		const transferEvents = [];
		for (const t of transfers) {
			const base = {
				date: t.createdAt,
				user: t.createdBy || null,
				meta: { transferId: t._id },
			};
			for (const item of t.items || []) {
				if (String(item.productId) !== String(productId)) continue;
				transferEvents.push({
					type: 'OUT',
					date: base.date,
					quantityChange: -Math.abs(item.quantity),
					store: t.fromStoreId || null,
					user: base.user,
					reference: 'Transfer',
					meta: { ...base.meta, direction: 'from' },
				});
				transferEvents.push({
					type: 'IN',
					date: base.date,
					quantityChange: Math.abs(item.quantity),
					store: t.toStoreId || null,
					user: base.user,
					reference: 'Transfer',
					meta: { ...base.meta, direction: 'to' },
				});
			}
		}

		let allEvents = [...adjustEvents, ...transferEvents].sort(
			(a, b) => new Date(b.date) - new Date(a.date),
		);

		if (filterStoreId) {
			const sid = String(filterStoreId);
			allEvents = allEvents.filter(
				(e) => e.store && String(e.store._id) === sid,
			);
		}

		const total = allEvents.length;
		const start = (Math.max(1, page) - 1) * limit;
		const items = allEvents.slice(start, start + limit);

		res.json({
			items,
			total,
			page: Math.max(1, page),
			limit,
		});
	} catch (err) {
		next(err);
	}
};

export const auditLogs = async (req, res, next) => {
	try {
		const data = await auditLogService.getAll(
			req.query,
		);
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const taxCollected = async (req, res, next) => {
	try {
		const data = await reportingService.taxCollected(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['Store', 'Orders', 'Sales', 'Tax Collected'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.storeName,
						row.orderCount,
						row.totalSales,
						row.totalTax,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="tax-collected.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const returnsAndRefundsSummary = async (req, res, next) => {
	try {
		const data =
			await reportingService.returnsAndRefundsSummary(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['Type', 'Store', 'Count', 'Total Amount'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[row.type, row.storeName, row.count, row.totalAmount]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="returns-summary.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const purchaseOrderStatusSummary = async (req, res, next) => {
	try {
		const data =
			await reportingService.purchaseOrderStatusSummary(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['Status', 'Count', 'Total Amount'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[row._id, row.count, row.totalAmount]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="purchase-order-status.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const supplierInvoicePaymentStatus = async (req, res, next) => {
	try {
		const data =
			await reportingService.supplierInvoicePaymentStatus(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = [
				'Invoice',
				'Supplier',
				'Total',
				'Paid',
				'Outstanding',
				'Status',
				'Created At',
			];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.invoiceNumber,
						row.supplierName,
						row.totalAmount,
						row.paidAmount,
						row.outstandingAmount,
						row.status,
						row.createdAt,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="supplier-invoice-payment-status.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const dailySalesSummary = async (req, res, next) => {
	try {
		const data = await reportingService.dailySalesSummary(req.query);

		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['Date', 'Store', 'Orders', 'Sales'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.day,
						row.storeName,
						row.orderCount,
						row.totalSales,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="daily-sales-summary.csv"',
			);
			return res.send(csvLines.join('\n'));
		}

		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const monthlySalesSummary = async (req, res, next) => {
	try {
		const data = await reportingService.monthlySalesSummary(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = ['Month', 'Store', 'Orders', 'Sales'];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.month,
						row.storeName,
						row.orderCount,
						row.totalSales,
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="monthly-sales-summary.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const supplierPayablesHistory = async (req, res, next) => {
	try {
		const data =
			await reportingService.supplierPayablesHistory(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = [
				'Supplier',
				'Date',
				'Type',
				'Amount',
				'Balance',
				'PO Number',
				'Description',
			];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.supplierName,
						row.createdAt
							? new Date(row.createdAt).toISOString()
							: '',
						row.type,
						row.amount,
						row.balance,
						row.poNumber || '',
						row.description || '',
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="supplier-payables-history.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};

export const customerCreditSettlementHistory = async (req, res, next) => {
	try {
		const data =
			await reportingService.customerCreditSettlementHistory(req.query);
		if (req.query.format === 'csv') {
			const rows = Array.isArray(data) ? data : [];
			const header = [
				'Customer',
				'Date',
				'Type',
				'Amount',
				'Balance',
				'Order',
				'Description',
			];
			const csvLines = [
				header.join(','),
				...rows.map((row) =>
					[
						row.customerName,
						row.createdAt
							? new Date(row.createdAt).toISOString()
							: '',
						row.type,
						row.amount,
						row.balance,
						row.orderNumber || '',
						row.description || '',
					]
						.map((v) =>
							v === null || v === undefined
								? ''
								: String(v).includes(',')
									? `"${String(v).replace(/"/g, '""')}"`
									: String(v),
						)
						.join(','),
				),
			];

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="customer-credit-settlement-history.csv"',
			);
			return res.send(csvLines.join('\n'));
		}
		res.json(data);
	} catch (err) {
		next(err);
	}
};
