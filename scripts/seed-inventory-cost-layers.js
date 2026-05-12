/**
 * Seeds InventoryCostLayer documents for existing product/store inventory.
 * Clears all cost layers first, then creates dummy FIFO layers matching each
 * Inventory.quantity (source: adjustment). Safe for dev/demo only.
 *
 * Usage: node scripts/seed-inventory-cost-layers.js
 * Optional: SEED_COST_LAYERS_APPEND=1 — do not delete existing layers; only
 *   add layers for (productId, storeId) pairs that have inventory > 0 but
 *   zero total quantityRemaining in existing layers.
 */
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Inventory = require('../src/models/inventory.model');
const Product = require('../src/models/product.model');
const InventoryCostLayer = require('../src/models/inventoryCostLayer.model');

const QTY_EPS = 1e-6;

function roundQty(n) {
	return Math.round(n * 10000) / 10000;
}

/** Split qty into 1–2 layers for slightly more realistic FIFO (optional). */
function layerQuantities(total) {
	if (total <= QTY_EPS) return [];
	if (total < 2) return [roundQty(total)];
	const first = roundQty(total * 0.62);
	const second = roundQty(total - first);
	if (second <= QTY_EPS) return [roundQty(total)];
	return [first, second];
}

function baseUnitCostFromProduct(product) {
	const ref =
		typeof product?.posPrice === 'number' && product.posPrice > 0
			? product.posPrice
			: 100;
	// Rough “cost” band: ~42–58% of sell price
	const factor = 0.42 + Math.random() * 0.16;
	return roundQty(ref * factor);
}

async function totalLayersRemaining(productId, storeId) {
	const agg = await InventoryCostLayer.aggregate([
		{
			$match: {
				productId: new mongoose.Types.ObjectId(productId),
				storeId: new mongoose.Types.ObjectId(storeId),
			},
		},
		{ $group: { _id: null, sum: { $sum: '$quantityRemaining' } } },
	]);
	return agg.length ? roundQty(agg[0].sum) : 0;
}

async function seedInventoryCostLayers() {
	const uri = process.env.MONGO_URI;
	if (!uri) {
		console.error('MONGO_URI is not set (backend/.env).');
		process.exit(1);
	}

	const appendOnly = process.env.SEED_COST_LAYERS_APPEND === '1';

	try {
		console.log('Connecting...');
		await mongoose.connect(uri, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});

		if (!appendOnly) {
			const del = await InventoryCostLayer.deleteMany({});
			console.log(`Removed ${del.deletedCount} existing cost layer(s).`);
		}

		const inventories = await Inventory.find({ quantity: { $gt: QTY_EPS } })
			.lean()
			.exec();

		let created = 0;
		let skipped = 0;

		for (const inv of inventories) {
			const product = await Product.findById(inv.productId).lean();
			if (!product) {
				console.warn(
					`Skip inventory ${inv._id}: product ${inv.productId} missing`,
				);
				skipped += 1;
				continue;
			}

			if (appendOnly) {
				const existing = await totalLayersRemaining(
					inv.productId,
					inv.storeId,
				);
				if (existing > QTY_EPS) {
					skipped += 1;
					continue;
				}
			}

			const qty = roundQty(inv.quantity);
			const chunks = layerQuantities(qty);
			const base = baseUnitCostFromProduct(product);
			const now = Date.now();

			for (let i = 0; i < chunks.length; i += 1) {
				const q = chunks[i];
				if (q <= QTY_EPS) continue;
				// Older layer first (FIFO): first chunk older date, slight cost drift
				const daysAgo = chunks.length === 1 ? 30 : i === 0 ? 75 : 12;
				const receivedAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
				const drift = i === 0 ? 0.97 : 1.04;
				const unitCost = roundQty(Math.max(0.01, base * drift));

				await InventoryCostLayer.create({
					productId: inv.productId,
					storeId: inv.storeId,
					quantityRemaining: q,
					unitCost,
					receivedAt,
					source: {
						type: 'adjustment',
						note: 'Seeded dummy FIFO cost layer',
					},
				});
				created += 1;
			}
		}

		console.log(
			`Done. Created ${created} cost layer document(s). Skipped ${skipped} inventory row(s).`,
		);
		process.exit(0);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
}

seedInventoryCostLayers();
