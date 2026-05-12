export function roundMoney(n) {
	if (!Number.isFinite(n)) return 0;
	return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Refund amount for returning `returnQty` units of an order line.
 * Uses stored line totals (incl. line tax) and scales by order total vs
 * subtotal+tax so order-level discounts match what the customer paid.
 *
 * @param {import('mongoose').Document | object} order — order doc with subtotal, taxAmount, totalAmount, optional shippingCost
 * @param {object} orderItem — line with quantity, lineTotal
 * @param {number} returnQty
 * @returns {number}
 */
export function refundForLineQuantity(order, orderItem, returnQty) {
	const qty = Number(returnQty);
	const lineQty = Number(orderItem.quantity);
	if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(lineQty) || lineQty <= 0) {
		return 0;
	}

	const lineTotal = Number(orderItem.lineTotal ?? 0);
	const orderGross =
		Number(order.subtotal ?? 0) + Number(order.taxAmount ?? 0);
	const shipping = Number(order.shippingCost ?? 0);
	const totalPaid = Number(order.totalAmount ?? 0);
	/** Product portion paid (excludes flat shipping; shipping is not allocated to lines). */
	const productPaid = totalPaid - (Number.isFinite(shipping) ? shipping : 0);
	const paidScale = orderGross > 0 ? productPaid / orderGross : 1;

	const perUnit = lineTotal / lineQty;
	return roundMoney(perUnit * qty * paidScale);
}
