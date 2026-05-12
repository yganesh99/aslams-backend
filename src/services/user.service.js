import crypto from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import { getDb } from '../betterAuth.js';

function users() {
	return getDb().collection('user');
}

function accounts() {
	return getDb().collection('account');
}

const NOT_ARCHIVED = {
	$or: [
		{ banReason: { $exists: false } },
		{ banReason: null },
		{ banReason: { $ne: 'archived' } },
	],
};

async function createUser(data) {
	const existing = await users().findOne({ email: data.email });
	if (existing) {
		const err = new Error('Email already in use');
		err.status = 409;
		throw err;
	}

	const userId = crypto.randomUUID();
	const hashedPw = await hashPassword(data.password);

	const userDoc = {
		_id: userId,
		name: data.name,
		email: data.email.toLowerCase().trim(),
		emailVerified: false,
		image: null,
		role: data.role || 'cashier',
		banned: false,
		banReason: null,
		banExpires: null,
		phone: data.phone || null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	await users().insertOne(userDoc);

	await accounts().insertOne({
		_id: crypto.randomUUID(),
		userId,
		accountId: userId,
		providerId: 'credential',
		password: hashedPw,
		accessToken: null,
		refreshToken: null,
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
		scope: null,
		idToken: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return userDoc;
}

const STAFF_ROLE_FILTER = { role: { $ne: 'customer' } };

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * @param {{
 *   audience?: 'all' | 'staff' | 'customers';
 *   page?: number;
 *   limit?: number;
 * }} [query]
 */
async function getAll(query = {}) {
	const audience = query.audience || 'all';
	const audienceFilter =
		audience === 'staff'
			? STAFF_ROLE_FILTER
			: audience === 'customers'
				? { role: 'customer' }
				: {};

	const filter = { ...audienceFilter, ...NOT_ARCHIVED };

	let page = Number(query.page);
	let limit = Number(query.limit);
	if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE;
	if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
	limit = Math.min(Math.floor(limit), MAX_LIMIT);
	page = Math.floor(page);

	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		users().find(filter).sort({ name: 1 }).skip(skip).limit(limit).toArray(),
		users().countDocuments(filter),
	]);
	return { items, total, page, limit };
}

async function getById(id) {
	return users().findOne({ _id: id });
}

async function update(id, data) {
	delete data.password;
	delete data.email;

	const user = await users().findOne({ _id: id });
	if (!user) return null;
	if (user.role === 'customer') {
		const err = new Error(
			'Customer accounts cannot be edited from user management',
		);
		err.status = 403;
		throw err;
	}

	const sets = {};
	if (typeof data.name === 'string') sets.name = data.name;
	if (typeof data.phone === 'string') sets.phone = data.phone;
	if (typeof data.role === 'string') sets.role = data.role;

	if (Object.keys(sets).length === 0) return user;
	sets.updatedAt = new Date();

	const result = await users().findOneAndUpdate(
		{ _id: id },
		{ $set: sets },
		{ returnDocument: 'after' },
	);
	return result;
}

async function toggleActive(id) {
	const user = await users().findOne({ _id: id });
	if (!user) return null;

	const newBanned = !user.banned;
	const result = await users().findOneAndUpdate(
		{ _id: id },
		{
			$set: {
				banned: newBanned,
				banReason: newBanned ? 'suspended' : null,
				updatedAt: new Date(),
			},
		},
		{ returnDocument: 'after' },
	);
	return result;
}

async function archive(id) {
	const result = await users().findOneAndUpdate(
		{ _id: id },
		{
			$set: {
				banned: true,
				banReason: 'archived',
				updatedAt: new Date(),
			},
		},
		{ returnDocument: 'after' },
	);
	return result;
}

async function countByRole(role) {
	return users().countDocuments({ role, ...NOT_ARCHIVED });
}

export { createUser, getAll, getById, update, toggleActive, archive, countByRole };
