import Product from '../models/product.model.js';
import Inventory from '../models/inventory.model.js';
import * as storeService from './store.service.js';

function escapeRegex(str) {
	return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function assertUniqueSkuAndName(data, excludeProductId) {
	if (data.sku != null && String(data.sku).trim() !== '') {
		const sku = String(data.sku).trim();
		const q = {
			sku: { $regex: new RegExp(`^${escapeRegex(sku)}$`, 'i') },
		};
		if (excludeProductId) q._id = { $ne: excludeProductId };
		const existingSku = await Product.findOne(q);
		if (existingSku) {
			const err = new Error('A product with this SKU already exists.');
			err.status = 400;
			throw err;
		}
	}
	if (data.name != null && String(data.name).trim() !== '') {
		const name = String(data.name).trim();
		const q = {
			name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
		};
		if (excludeProductId) q._id = { $ne: excludeProductId };
		const existingName = await Product.findOne(q);
		if (existingName) {
			const err = new Error('A product with this name already exists.');
			err.status = 400;
			throw err;
		}
	}
}

async function create(data) {
	await assertUniqueSkuAndName(data);
	return Product.create(data);
}

/**
 * Search products visible in POS and include stock for a given store.
 */
async function searchForPos({
	search,
	category,
	storeId,
	page = 1,
	limit = 50,
} = {}) {
	if (storeId) {
		await storeService.assertStoreActive(storeId);
	}

	const query = { isActive: true };

	if (search) {
		query.$or = [
			{ name: { $regex: search, $options: 'i' } },
			{ sku: { $regex: search, $options: 'i' } },
		];
	}
	if (category) {
		query.categories = category;
	}

	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		Product.find(query)
			.populate('categories', 'name')
			.sort({ name: 1 })
			.skip(skip)
			.limit(limit)
			.lean(),
		Product.countDocuments(query),
	]);

	// Attach stock info for the given store
	if (storeId && items.length > 0) {
		const productIds = items.map((p) => p._id);
		const inventoryRecords = await Inventory.find({
			productId: { $in: productIds },
			storeId,
		}).lean();

		const stockMap = {};
		for (const inv of inventoryRecords) {
			stockMap[String(inv.productId)] =
				inv.quantity - (inv.reservedQuantity || 0);
		}

		for (const item of items) {
			item.stock = stockMap[String(item._id)] ?? 0;
		}
	}

	return { items, total, page, limit };
}

async function getAll({
	category,
	search,
	name,
	sku,
	storeId,
	page = 1,
	limit = 50,
	includeInactive = false,
	includeOutOfStock = false,
	/** When true, each item includes totalAvailableStock (sum of available qty across stores). */
	includeAggregatedStock = false,
} = {}) {
	const query = {};
	if (!includeInactive) {
		query.isActive = true;
	}
	if (category) query.categories = category;
	if (name) query.name = { $regex: name, $options: 'i' };
	if (sku) query.sku = { $regex: sku, $options: 'i' };
	if (search) {
		query.$or = [
			{ name: { $regex: search, $options: 'i' } },
			{ sku: { $regex: search, $options: 'i' } },
		];
	}

	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		Product.find(query)
			.populate('categories', 'name')
			.sort({ name: 1 })
			.skip(skip)
			.limit(limit)
			.lean(),
		Product.countDocuments(query),
	]);

	if (includeAggregatedStock && items.length > 0) {
		const productIds = items.map((p) => p._id);
		const totals = await Inventory.aggregate([
			{ $match: { productId: { $in: productIds } } },
			{
				$group: {
					_id: '$productId',
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
		]);
		const stockByProduct = {};
		for (const row of totals) {
			stockByProduct[String(row._id)] = row.totalAvailable;
		}
		for (const item of items) {
			item.totalAvailableStock = stockByProduct[String(item._id)] ?? 0;
		}
	}

	return { items, total, page, limit };
}

async function getById(id) {
	return Product.findById(id).populate('categories', 'name');
}

async function getBySku(sku) {
	return Product.findOne({ sku }).populate('categories', 'name');
}

async function update(id, data) {
	if (data.sku !== undefined || data.name !== undefined) {
		await assertUniqueSkuAndName(data, id);
	}
	return Product.findByIdAndUpdate(id, data, {
		new: true,
		runValidators: true,
	}).populate('categories', 'name');
}

async function toggleActive(id) {
	const product = await Product.findById(id);
	if (!product) return null;
	product.isActive = !product.isActive;
	return product.save();
}

/**
 * Soft-delete if no stock anywhere. Throws { status: 400 } if not allowed.
 */
async function remove(id) {
	const product = await Product.findById(id);
	if (!product) return null;

	const stockRow = await Inventory.findOne({
		productId: id,
		$or: [{ quantity: { $gt: 0 } }, { reservedQuantity: { $gt: 0 } }],
	})
		.select('_id storeId')
		.lean();

	if (stockRow) {
		const err = new Error(
			'Cannot archive product while it has on-hand or reserved stock at a store. Clear stock first.',
		);
		err.status = 400;
		throw err;
	}

	product.deletedAt = new Date();
	await product.save();
	return product;
}

export {
	create,
	searchForPos,
	getAll,
	getById,
	getBySku,
	update,
	toggleActive,
	remove,
};
