'use strict';

/**
 * Units that allow decimal quantities (e.g. weight, length, volume).
 * All other units (pcs, bales, cartons, box, etc.) require whole numbers.
 */
const DECIMAL_QUANTITY_UNITS = new Set([
	'kg', 'kgs', 'g', 'gm', 'gms', 'gram', 'grams',
	'm', 'meter', 'meters', 'metre', 'metres', 'cm', 'km',
	'l', 'litre', 'litres', 'liter', 'liters', 'ml',
	'lb', 'lbs', 'oz',
]);

function normalized(u) {
	return (u || '').toLowerCase().trim();
}

/**
 * Returns true if the product unit allows decimal quantities.
 */
function allowsDecimalQuantity(unit) {
	return DECIMAL_QUANTITY_UNITS.has(normalized(unit || ''));
}

/**
 * Normalize quantity for the given unit: integer for whole-number units,
 * up to 2 decimals otherwise. Enforces min 0.001 for decimals, 1 for whole.
 */
function normalizeQuantity(quantity, unit) {
	const raw = Number(quantity);
	if (!Number.isFinite(raw) || raw <= 0) {
		return allowsDecimalQuantity(unit) ? 0.001 : 1;
	}
	if (allowsDecimalQuantity(unit)) {
		const rounded = Math.round(raw * 100) / 100;
		return Math.max(0.001, rounded);
	}
	return Math.max(1, Math.round(raw));
}

/**
 * Normalize a quantity change (can be positive or negative) for the given unit.
 * Used for inventory adjustments. Zero is allowed (no-op).
 */
function normalizeQuantityChange(quantityChange, unit) {
	const raw = Number(quantityChange);
	if (!Number.isFinite(raw) || raw === 0) return 0;
	const sign = raw > 0 ? 1 : -1;
	const absVal = Math.abs(raw);
	if (allowsDecimalQuantity(unit)) {
		const rounded = Math.round(absVal * 100) / 100;
		return sign * Math.max(0.001, rounded);
	}
	return sign * Math.max(1, Math.round(absVal));
}

export { allowsDecimalQuantity, normalizeQuantity, normalizeQuantityChange };
