'use strict';

/**
 * Calculate the discount amount from subtotal, type, and value.
 * Discount is always capped at subtotal so total never goes negative.
 *
 * @param {number} subtotal
 * @param {'percentage'|'fixed'|null} discountType
 * @param {number} discountValue
 * @returns {number} discountAmount in currency
 */
function calculateDiscount(subtotal, discountType, discountValue) {
	if (!discountType || !discountValue || discountValue <= 0) return 0;

	let amount = 0;
	if (discountType === 'percentage') {
		amount = subtotal * (discountValue / 100);
	} else if (discountType === 'fixed') {
		amount = discountValue;
	}

	// Cap at subtotal so total is never negative
	return Math.min(amount, subtotal);
}

export { calculateDiscount };
