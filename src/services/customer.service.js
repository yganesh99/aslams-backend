import Customer from '../models/customer.model.js';
import { assertUniquePhoneDigits } from '../utils/contactUniqueness.js';


function escapeRegex(str) {
	return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function create(data) {
	const payload = { ...data };
	if (payload.phone !== undefined && payload.phone !== null) {
		payload.phone = String(payload.phone).trim();
	}

	if (payload.name) {
		const existingName = await Customer.findOne({
			name: { $regex: new RegExp(`^${escapeRegex(payload.name)}$`, 'i') },
		});
		if (existingName) {
			const err = new Error('A customer with this name already exists.');
			err.status = 400;
			throw err;
		}
	}

	const emailNorm = (payload.email || '').trim().toLowerCase();
	if (emailNorm) {
		const existingEmail = await Customer.findOne({ email: emailNorm });
		if (existingEmail) {
			const err = new Error('A customer with this email already exists.');
			err.status = 400;
			throw err;
		}
		payload.email = emailNorm;
	}

	await assertUniquePhoneDigits(Customer, payload.phone, { label: 'customer' });

	return Customer.create(payload);
}

async function getAll({ search, page = 1, limit = 50 } = {}) {
	const query = { isActive: true };
	if (search) {
		const term = escapeRegex(String(search).trim());
		if (term) {
			const rx = { $regex: term, $options: 'i' };
			query.$or = [
				{ name: rx },
				{ email: rx },
				{ phone: rx },
			];
		}
	}
	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		Customer.find(query).sort({ name: 1 }).skip(skip).limit(limit),
		Customer.countDocuments(query),
	]);
	return { items, total, page, limit };
}

async function getById(id) {
	return Customer.findById(id);
}

async function update(id, data) {
	const payload = { ...data };
	if (payload.phone !== undefined && payload.phone !== null) {
		payload.phone = String(payload.phone).trim();
	}

	if (payload.name) {
		const existingName = await Customer.findOne({
			_id: { $ne: id },
			name: { $regex: new RegExp(`^${escapeRegex(payload.name)}$`, 'i') },
		});
		if (existingName) {
			const err = new Error('A customer with this name already exists.');
			err.status = 400;
			throw err;
		}
	}

	if (payload.email !== undefined) {
		const emailNorm = (payload.email || '').trim().toLowerCase();
		if (emailNorm) {
			const existingEmail = await Customer.findOne({
				_id: { $ne: id },
				email: emailNorm,
			});
			if (existingEmail) {
				const err = new Error('A customer with this email already exists.');
				err.status = 400;
				throw err;
			}
		}
		payload.email = emailNorm || undefined;
	}

	await assertUniquePhoneDigits(Customer, payload.phone, {
		excludeId: id,
		label: 'customer',
	});

	if (payload.creditLimit !== undefined) {
		const customer = await Customer.findById(id);
		if (!customer) {
			const err = new Error('Customer not found');
			err.status = 404;
			throw err;
		}

		if (
			customer.currentBalance > 0 &&
			customer.creditLimit !== payload.creditLimit
		) {
			const err = new Error(
				'Cannot update credit limit while there is an outstanding balance.',
			);
			err.status = 400;
			throw err;
		}
	}

	return Customer.findByIdAndUpdate(id, payload, {
		new: true,
		runValidators: true,
	});
}

async function checkCredit(customerId, amount) {
	const customer = await Customer.findById(customerId);
	if (!customer) {
		const err = new Error('Customer not found');
		err.status = 404;
		throw err;
	}
	return customer.creditLimit - customer.currentBalance >= amount;
}

function assertNoOutstandingBalance(customer) {
	const bal = Number(customer.currentBalance) || 0;
	if (bal > 0) {
		const err = new Error(
			'Cannot archive customer with an outstanding balance. Record payments until the balance is zero.',
		);
		err.status = 400;
		throw err;
	}
}

/**
 * Soft-delete after financial checks. Throws { status: 400 } if not allowed.
 */
async function remove(id) {
	const cust = await Customer.findById(id);
	if (!cust) return null;
	assertNoOutstandingBalance(cust);
	cust.deletedAt = new Date();
	await cust.save();
	return cust;
}

export { create, getAll, getById, update, checkCredit, remove };
