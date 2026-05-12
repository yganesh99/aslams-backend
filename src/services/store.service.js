import Store from '../models/store.model.js';
import Inventory from '../models/inventory.model.js';
import RegisterSession from '../models/registerSession.model.js';


async function create(data) {
	return Store.create(data);
}

async function getAll() {
	return Store.find({ isActive: true }).sort({ name: 1 });
}

async function getById(id) {
	return Store.findById(id);
}

async function countActiveStores() {
	return Store.countDocuments({ isActive: true });
}

/**
 * Blocks turning off the last active store (non–soft-deleted docs only).
 */
async function assertCanDeactivate(storeDoc) {
	if (!storeDoc?.isActive) return;
	const activeCount = await countActiveStores();
	if (activeCount <= 1) {
		throw Object.assign(
			new Error('Cannot deactivate the only active store.'),
			{ status: 400 },
		);
	}
}

async function update(id, data) {
	if (
		data &&
		Object.prototype.hasOwnProperty.call(data, 'isActive') &&
		data.isActive === false
	) {
		const current = await Store.findById(id);
		if (!current) return null;
		await assertCanDeactivate(current);
	}
	return Store.findByIdAndUpdate(id, data, {
		new: true,
		runValidators: true,
	});
}

async function toggleActive(id) {
	const store = await Store.findById(id);
	if (!store) return null;
	if (store.isActive) {
		await assertCanDeactivate(store);
	}
	store.isActive = !store.isActive;
	return store.save();
}

/**
 * Ensure the store exists and, unless allowInactive, is active.
 * Used to block sales, stock moves, and new sessions at deactivated locations.
 */
async function assertStoreActive(
	storeId,
	{ allowInactive = false } = {},
) {
	if (!storeId) {
		throw Object.assign(new Error('Store is required'), { status: 400 });
	}
	const store = await Store.findById(storeId).select('isActive name').lean();
	if (!store) {
		throw Object.assign(new Error('Store not found'), { status: 404 });
	}
	if (!allowInactive && !store.isActive) {
		const label = store.name?.trim() || 'Store';
		throw Object.assign(new Error(`${label} is not active`), {
			status: 400,
		});
	}
}

/**
 * Soft-delete if no stock and no open register sessions. Throws { status: 400 } if not allowed.
 */
async function remove(id) {
	const store = await Store.findById(id);
	if (!store) return null;

	const stockRow = await Inventory.findOne({
		storeId: id,
		$or: [{ quantity: { $gt: 0 } }, { reservedQuantity: { $gt: 0 } }],
	})
		.select('_id')
		.lean();

	if (stockRow) {
		const err = new Error(
			'Cannot archive store while it has on-hand or reserved inventory. Transfer or adjust stock to zero first.',
		);
		err.status = 400;
		throw err;
	}

	const openSession = await RegisterSession.findOne({
		storeId: id,
		status: 'open',
	})
		.select('_id')
		.lean();

	if (openSession) {
		const err = new Error(
			'Cannot archive store while a register session is still open. Close all sessions first.',
		);
		err.status = 400;
		throw err;
	}

	store.deletedAt = new Date();
	await store.save();
	return store;
}

export { create, getAll, getById, update, toggleActive, assertStoreActive, remove };
