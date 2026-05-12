import express from 'express';
import * as controller from '../controllers/reportingController.js';
import auth from '../middlewares/auth.js';


const router = express.Router({ mergeParams: true });

router.use(auth(['admin', 'accountant', 'store_manager']));

// Sales reports
router.get('/sales/by-store', controller.salesByStore);
router.get('/sales/by-product', controller.salesByProduct);
router.get('/sales/by-cashier', controller.salesByCashier);
router.get('/sales/by-register', controller.salesByRegister);
router.get('/sales/daily-summary', controller.dailySalesSummary);
router.get('/sales/monthly-summary', controller.monthlySalesSummary);

// Inventory reports
router.get('/inventory/low-stock', controller.lowStock);
router.get('/inventory/total-stock', controller.totalStock);
router.get(
	'/inventory/current-stock-levels',
	controller.currentStockLevels,
);
router.get('/inventory/valuation', controller.inventoryValuation);
router.get('/inventory/movements', controller.inventoryMovements);

// Finance reports
router.get('/finance/credit-exposure', controller.creditExposure);
router.get('/finance/supplier-payables', controller.supplierPayables);
router.get(
	'/finance/supplier-payables-history',
	controller.supplierPayablesHistory,
);
router.get('/finance/profit-per-sku', controller.profitPerSku);
router.get('/finance/revenue-per-product', controller.revenuePerProduct);
router.get('/finance/tax-collected', controller.taxCollected);
router.get(
	'/finance/customer-credit-settlement-history',
	controller.customerCreditSettlementHistory,
);
router.get(
	'/finance/supplier-invoice-payment-status',
	controller.supplierInvoicePaymentStatus,
);

// Audit logs
router.get('/audit-logs', controller.auditLogs);

// Operational reports
router.get(
	'/operations/returns-summary',
	controller.returnsAndRefundsSummary,
);
router.get(
	'/operations/purchase-order-status',
	controller.purchaseOrderStatusSummary,
);

export default router;
