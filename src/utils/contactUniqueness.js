import mongoose from 'mongoose';


function normalizePhoneDigits(phone) {
	return String(phone || '').replace(/\D/g, '');
}

/**
 * @param {import('mongoose').Model} Model
 * @param {string} [phone]
 * @param {{ excludeId?: string, label: string }} opts
 */
async function assertUniquePhoneDigits(Model, phone, { excludeId, label }) {
	const digits = normalizePhoneDigits(phone);
	if (!digits) return;

	const filter = {
		phone: { $exists: true, $nin: [null, ''] },
	};
	if (excludeId) {
		filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
	}

	const docs = await Model.find(filter).select('phone').lean();
	const dup = docs.find((d) => normalizePhoneDigits(d.phone) === digits);
	if (dup) {
		const err = new Error(`A ${label} with this phone number already exists.`);
		err.status = 400;
		throw err;
	}
}

export { normalizePhoneDigits, assertUniquePhoneDigits };
