import Supplier from '../models/supplier.model.js';
import SupplierInvoice from '../models/supplierInvoice.model.js';
import { assertUniquePhoneDigits } from '../utils/contactUniqueness.js';


async function create(data) {
	const payload = { ...data };
	if (payload.phone !== undefined && payload.phone !== null) {
		payload.phone = String(payload.phone).trim();
	}

	const emailNorm = (payload.email || '').trim().toLowerCase();
	if (emailNorm) {
		const existingEmail = await Supplier.findOne({ email: emailNorm });
		if (existingEmail) {
			const err = new Error('A supplier with this email already exists.');
			err.status = 400;
			throw err;
		}
		payload.email = emailNorm;
	}

	await assertUniquePhoneDigits(Supplier, payload.phone, { label: 'supplier' });

	return Supplier.create(payload);
}

async function getAll(
	{ search, page = 1, limit = 50 } = {},
) {
	const query = { isActive: true };
	if (search) {
		query.$or = [
			{ name: { $regex: search, $options: 'i' } },
			{ contactPerson: { $regex: search, $options: 'i' } },
		];
	}
	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		Supplier.find(query).sort({ name: 1 }).skip(skip).limit(limit),
		Supplier.countDocuments(query),
	]);
	return { items, total, page, limit };
}

async function getById(id) {
	return Supplier.findById(id);
}

async function update(id, data) {
	const payload = { ...data };
	if (payload.phone !== undefined && payload.phone !== null) {
		payload.phone = String(payload.phone).trim();
	}

	if (payload.email !== undefined) {
		const emailNorm = (payload.email || '').trim().toLowerCase();
		if (emailNorm) {
			const existingEmail = await Supplier.findOne({
				_id: { $ne: id },
				email: emailNorm,
			});
			if (existingEmail) {
				const err = new Error('A supplier with this email already exists.');
				err.status = 400;
				throw err;
			}
		}
		payload.email = emailNorm || undefined;
	}

	await assertUniquePhoneDigits(Supplier, payload.phone, {
		excludeId: id,
		label: 'supplier',
	});

	return Supplier.findByIdAndUpdate(id, payload, {
		new: true,
		runValidators: true,
	});
}

/**
 * Soft-delete after payable checks. Throws { status: 400 } if not allowed.
 */
async function remove(id) {
	const supplier = await Supplier.findById(id);
	if (!supplier) return null;

	const balance = Number(supplier.currentBalance) || 0;
	if (balance > 0) {
		const err = new Error(
			'Cannot archive supplier while there is an outstanding balance owed to them. Clear payables first.',
		);
		err.status = 400;
		throw err;
	}

	const unpaidInvoice = await SupplierInvoice.findOne({
		supplierId: id,
		status: { $in: ['pending', 'partial_paid'] },
	})
		.select('_id invoiceNumber')
		.lean();

	if (unpaidInvoice) {
		const err = new Error(
			'Cannot archive supplier with unpaid or partially paid invoices. Settle invoices first.',
		);
		err.status = 400;
		throw err;
	}

	supplier.deletedAt = new Date();
	await supplier.save();
	return supplier;
}

export { create, getAll, getById, update, remove };
