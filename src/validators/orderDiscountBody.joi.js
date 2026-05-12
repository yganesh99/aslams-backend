import Product from '../models/product.model.js';
import { normalizeQuantity } from '../utils/quantityByUnit.js';

'use strict';


/**
 * Subtotal used for discount caps on POS (same rules as pos.service createOrder / quote).
 * Returns null if any line cannot be priced for a valid POS cart (service will error separately).
 */
async function computePosSubtotalForDiscountCheck(items) {
	let subtotal = 0;
	for (const item of items) {
		const product = await Product.findById(item.productId)
			.select('posPrice unit isActive')
			.lean();
		if (!product) return null;
		if (!product.isActive) {
			return null;
		}
		const qty = normalizeQuantity(item.quantity, product.unit);
		subtotal += product.posPrice * qty;
	}
	return subtotal;
}

async function posOrderDiscountExternal(value, helpers) {
	const { items, discountType, discountValue } = value;
	if (!discountType || discountValue == null || discountValue <= 0) return value;
	if (discountType !== 'fixed') return value;

	const subtotal = await computePosSubtotalForDiscountCheck(items);
	if (subtotal == null) return value;
	if (discountValue > subtotal) {
		return helpers.message({
			custom: 'Discount cannot exceed order subtotal',
		});
	}
	return value;
}

export { posOrderDiscountExternal };
