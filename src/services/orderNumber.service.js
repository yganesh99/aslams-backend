import OrderSequence from '../models/orderSequence.model.js';


const CHANNEL_PREFIX = {
	pos: 'FH-POS',
};

function periodParts(at) {
	const month = String(at.getMonth() + 1).padStart(2, '0');
	const year = String(at.getFullYear());
	return { month, year };
}

/**
 * Next persisted order number: FH-POS-MM-YYYY-000001
 * Avoid passing `session` from a multi-document transaction that also touches Order/Inventory —
 * MongoDB may raise WriteConflict; call without session and accept rare sequence gaps on abort.
 * @param {{ session?: import('mongoose').ClientSession, at?: Date }} [opts]
 */
async function nextOrderNumber(opts = {}) {
	const prefix = CHANNEL_PREFIX['pos'];
	const at = opts.at || new Date();
	const { month, year } = periodParts(at);
	const periodKey = `${prefix}-${month}-${year}`;

	const doc = await OrderSequence.findOneAndUpdate(
		{ periodKey },
		{ $inc: { seq: 1 } },
		{
			new: true,
			upsert: true,
			session: opts.session ?? null,
		},
	);

	const increment = String(doc.seq).padStart(6, '0');
	return `${periodKey}-${increment}`;
}

/**
 * Display reference for POS quotes (not persisted; does not consume order sequence).
 */
function nextQuoteDisplayNumber(at = new Date()) {
	const { month, year } = periodParts(at);
	const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
	return `FH-POS-${month}-${year}-Q-${rand}`;
}

export { nextOrderNumber, nextQuoteDisplayNumber };
