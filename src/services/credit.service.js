import CreditAccount from '../models/creditAccount.model.js';
import Customer from '../models/customer.model.js';
import Supplier from '../models/supplier.model.js';
import { logAudit } from '../middlewares/auditLog.js';


/**
 * Record a credit sale (increases customer AR).
 * @param {import('mongoose').ClientSession} [opts.session] — include in the same multi-doc txn as the order when provided; skips audit log until after commit.
 */
async function recordCreditSale(
	customerId,
	amount,
	orderId,
	userId,
	opts = {},
) {
	const { session } = opts;
	let q = Customer.findById(customerId);
	if (session) q = q.session(session);
	const customer = await q;
	if (!customer)
		throw Object.assign(new Error('Customer not found'), { status: 404 });

	const availableCredit = customer.creditLimit - customer.currentBalance;
	if (availableCredit < amount) {
		throw Object.assign(new Error('Credit limit exceeded'), {
			status: 400,
		});
	}

	customer.currentBalance += amount;
	await customer.save(session ? { session } : {});

	const [entry] = await CreditAccount.create(
		[
			{
				entityType: 'customer',
				entityId: customerId,
				entityModel: 'Customer',
				type: 'sale',
				amount,
				balance: customer.currentBalance,
				orderId,
				description: `Credit sale for order`,
				createdBy: userId,
			},
		],
		session ? { session } : {},
	);

	if (!session) {
		logAudit({
			userId,
			action: 'credit_sale',
			entity: 'CreditAccount',
			entityId: entry._id,
			changes: { customerId, amount, newBalance: customer.currentBalance },
		});
	}

	return entry;
}

/**
 * Record a customer payment (reduces AR).
 */
async function recordCustomerPayment( customerId, amount, userId) {
	const customer = await Customer.findById(customerId);
	if (!customer)
		throw Object.assign(new Error('Customer not found'), { status: 404 });

	customer.currentBalance = Math.max(0, customer.currentBalance - amount);
	await customer.save();

	const entry = await CreditAccount.create({
		entityType: 'customer',
		entityId: customerId,
		entityModel: 'Customer',
		type: 'payment',
		amount: -amount,
		balance: customer.currentBalance,
		description: 'Customer payment received',
		createdBy: userId,
	});

	logAudit({
		userId,
		action: 'customer_payment',
		entity: 'CreditAccount',
		entityId: entry._id,
		changes: { customerId, amount, newBalance: customer.currentBalance },
	});

	return entry;
}

/**
 * Record a customer return (reduces AR).
 */
async function recordCustomerReturn(
	customerId,
	amount,
	orderId,
	userId,
) {
	const customer = await Customer.findById(customerId);
	if (!customer)
		throw Object.assign(new Error('Customer not found'), { status: 404 });

	customer.currentBalance = Math.max(0, customer.currentBalance - amount);
	await customer.save();

	return CreditAccount.create({
		entityType: 'customer',
		entityId: customerId,
		entityModel: 'Customer',
		type: 'return',
		amount: -amount,
		balance: customer.currentBalance,
		orderId,
		description: 'Return credit reduction',
		createdBy: userId,
	});
}

/**
 * Record a supplier purchase (increases AP).
 */
async function recordSupplierPurchase(
	supplierId,
	amount,
	purchaseOrderId,
	userId,
) {
	const supplier = await Supplier.findById(supplierId);
	if (!supplier)
		throw Object.assign(new Error('Supplier not found'), { status: 404 });

	supplier.currentBalance += amount;
	await supplier.save();

	return CreditAccount.create({
		entityType: 'supplier',
		entityId: supplierId,
		entityModel: 'Supplier',
		type: 'purchase',
		amount,
		balance: supplier.currentBalance,
		purchaseOrderId,
		description: 'Purchase on credit',
		createdBy: userId,
	});
}

/**
 * Record supplier payment (reduces AP).
 */
async function recordSupplierPayment( supplierId, amount, userId) {
	const supplier = await Supplier.findById(supplierId);
	if (!supplier)
		throw Object.assign(new Error('Supplier not found'), { status: 404 });

	supplier.currentBalance = Math.max(0, supplier.currentBalance - amount);
	await supplier.save();

	return CreditAccount.create({
		entityType: 'supplier',
		entityId: supplierId,
		entityModel: 'Supplier',
		type: 'supplier_payment',
		amount: -amount,
		balance: supplier.currentBalance,
		description: 'Payment to supplier',
		createdBy: userId,
	});
}

/**
 * Record supplier return (reduces AP).
 */
async function recordSupplierReturn(
	supplierId,
	amount,
	purchaseOrderId,
	userId,
) {
	const supplier = await Supplier.findById(supplierId);
	if (!supplier)
		throw Object.assign(new Error('Supplier not found'), { status: 404 });

	supplier.currentBalance = Math.max(0, supplier.currentBalance - amount);
	await supplier.save();

	return CreditAccount.create({
		entityType: 'supplier',
		entityId: supplierId,
		entityModel: 'Supplier',
		type: 'supplier_return',
		amount: -amount,
		balance: supplier.currentBalance,
		purchaseOrderId,
		description: 'Supplier return credit reduction',
		createdBy: userId,
	});
}

/**
 * Get ledger history for an entity.
 */
async function getLedger( entityType, entityId) {
	return CreditAccount.find({
		entityType,
		entityId,
	}).sort({ createdAt: -1 });
}

export { recordCreditSale, recordCustomerPayment, recordCustomerReturn, recordSupplierPurchase, recordSupplierPayment, recordSupplierReturn, getLedger };
