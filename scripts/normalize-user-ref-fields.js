/**
 * One-time: point all legacy user reference fields at a single Better Auth user
 * (default: first `role: 'admin'`, or ADMIN_EMAIL, or any user).
 *
 * Run: node scripts/normalize-user-ref-fields.js
 *
 * - Does not clear `closedBy` on open register sessions (only updates non-null closedBy).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import Order from '../src/models/order.model.js';
import AuditLog from '../src/models/auditLog.model.js';
import RegisterSession from '../src/models/registerSession.model.js';
import ReturnDoc from '../src/models/return.model.js';
import CreditAccount from '../src/models/creditAccount.model.js';
import Payment from '../src/models/payment.model.js';
import PurchaseOrder from '../src/models/purchaseOrder.model.js';
import InventoryTransfer from '../src/models/inventoryTransfer.model.js';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

async function resolveAdminId(db) {
	const email = process.env.ADMIN_EMAIL?.trim();
	let user =
		(await db.collection('user').findOne({ role: 'admin' })) ||
		(email ? await db.collection('user').findOne({ email }) : null) ||
		(await db.collection('user').findOne({}));
	if (!user) {
		throw new Error(
			'No rows in "user" collection. Seed Better Auth users first (e.g. scripts/seed-users.js).',
		);
	}
	return user._id;
}

try {
	await mongoose.connect(process.env.MONGO_URI);
	const client = new MongoClient(process.env.MONGO_URI);
	await client.connect();
	const db = client.db();

	const adminId = await resolveAdminId(db);
	console.log('Target user id:', String(adminId));

	const results = [];

	results.push([
		'orders.createdBy',
		await Order.updateMany({}, { $set: { createdBy: adminId } }),
	]);
	results.push([
		'auditlogs.userId',
		await AuditLog.updateMany(
			{ userId: { $ne: null } },
			{ $set: { userId: adminId } },
		),
	]);
	results.push([
		'registersessions.openedBy',
		await RegisterSession.updateMany({}, { $set: { openedBy: adminId } }),
	]);
	results.push([
		'registersessions.closedBy (non-null only)',
		await RegisterSession.updateMany(
			{ closedBy: { $ne: null } },
			{ $set: { closedBy: adminId } },
		),
	]);
	results.push([
		'returns.createdBy',
		await ReturnDoc.updateMany({}, { $set: { createdBy: adminId } }),
	]);
	results.push([
		'creditaccounts.createdBy',
		await CreditAccount.updateMany({}, { $set: { createdBy: adminId } }),
	]);
	results.push([
		'payments.createdBy',
		await Payment.updateMany({}, { $set: { createdBy: adminId } }),
	]);
	results.push([
		'purchaseorders.createdBy',
		await PurchaseOrder.updateMany({}, { $set: { createdBy: adminId } }),
	]);
	results.push([
		'purchaseorders.approvedBy (non-null only)',
		await PurchaseOrder.updateMany(
			{ approvedBy: { $ne: null } },
			{ $set: { approvedBy: adminId } },
		),
	]);
	results.push([
		'inventorytransfers.createdBy',
		await InventoryTransfer.updateMany({}, { $set: { createdBy: adminId } }),
	]);

	for (const [label, res] of results) {
		console.log(`  ${label}: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
	}

	await mongoose.disconnect();
	await client.close();
	console.log('Done.');
	process.exit(0);
} catch (err) {
	console.error(err);
	process.exit(1);
}
