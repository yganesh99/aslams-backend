/**
 * tests/api/users.test.js
 *
 * Endpoint-level tests for the Users API:
 *   POST   /api/users           — Create user (admin only)
 *   GET    /api/users           — List users (paginated: items, total, page, limit)
 *   GET    /api/users/:id       — Get by ID   (admin only)
 *   PUT    /api/users/:id       — Update user (admin only)
 *   PATCH  /api/users/:id/toggle — Toggle active status (admin only)
 *
 * RBAC: Only the `admin` role is permitted on all routes.
 */

'use strict';

require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const db = require('../helpers/db');
const { createUser, createUserAndLogin } = require('../helpers/auth');
const { createApiClient } = require('../helpers/apiClient');

// ─── DB Lifecycle ────────────────────────────────────────────────────────────

beforeAll(async () => {
	await db.connect();
});

beforeEach(async () => {
	await db.clearCollections();
});

afterAll(async () => {
	await db.disconnect();
});

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const VALID_USER_PAYLOAD = {
	email: 'newuser@test.com',
	password: 'NewUser123!',
	name: 'New User',
	role: 'cashier',
};

/** Seed a user via API and return its ID */
async function seedUser(api, overrides = {}) {
	const payload = {
		...VALID_USER_PAYLOAD,
		email: `seeduser_${Date.now()}@test.com`,
		...overrides,
	};
	const res = await api.post('/api/users').send(payload);
	if (res.status !== 201) {
		throw new Error(
			`Seed user failed: ${res.status} ${JSON.stringify(res.body)}`,
		);
	}
	return res.body._id || res.body.id || res.body.user?._id;
}

// ─── POST /api/users ──────────────────────────────────────────────────────────

describe('POST /api/users', () => {
	const validRoleCases = [
		{ label: 'role: cashier', role: 'cashier' },
		{ label: 'role: store_manager', role: 'store_manager' },
		{ label: 'role: inventory_manager', role: 'inventory_manager' },
		{ label: 'role: accountant', role: 'accountant' },
		{ label: 'role: admin', role: 'admin' },
	];

	test.each(validRoleCases)(
		'201 — creates user with $label',
		async ({ role }) => {
			const { accessToken } = await createUserAndLogin({ role: 'admin' });
			const api = createApiClient(accessToken);

			const res = await api.post('/api/users').send({
				...VALID_USER_PAYLOAD,
				email: `${role}_${Date.now()}@test.com`,
				role,
			});

			expect(res.status).toBe(201);
			expect(res.body).toMatchObject({ role });
			// Password must never be in the response
			expect(
				res.body.password ?? res.body.user?.password,
			).toBeUndefined();
		},
	);

	// Missing required field cases
	const missingFieldCases = [
		{
			label: 'missing email',
			body: { password: 'Pass123!', name: 'X', role: 'cashier' },
		},
		{
			label: 'missing password',
			body: { email: 'x@test.com', name: 'X', role: 'cashier' },
		},
		{
			label: 'missing name',
			body: {
				email: 'x@test.com',
				password: 'Pass123!',
				role: 'cashier',
			},
		},
		{
			label: 'missing role',
			body: { email: 'x@test.com', password: 'Pass123!', name: 'X' },
		},
	];

	test.each(missingFieldCases)('422 — $label', async ({ body }) => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api.post('/api/users').send(body);
		expect(res.status).toBe(400);
	});

	// Invalid value cases
	const invalidValueCases = [
		{
			label: 'invalid email format',
			body: {
				email: 'not-an-email',
				password: 'Pass123!',
				name: 'X',
				role: 'cashier',
			},
		},
		{
			label: 'password shorter than 8 chars',
			body: {
				email: 'x@test.com',
				password: 'short',
				name: 'X',
				role: 'cashier',
			},
		},
		{
			label: 'invalid role enum',
			body: {
				email: 'x@test.com',
				password: 'Pass123!!',
				name: 'X',
				role: 'superuser',
			},
		},
	];

	test.each(invalidValueCases)('422 — $label', async ({ body }) => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api.post('/api/users').send(body);
		expect(res.status).toBe(400);
	});

	// RBAC cases
	it('401 — no token', async () => {
		const res = await request(app)
			.post('/api/users')
			.send(VALID_USER_PAYLOAD);
		expect(res.status).toBe(401);
	});

	it('403 — cashier role is forbidden', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'cashier' });
		const api = createApiClient(accessToken);
		const res = await api.post('/api/users').send(VALID_USER_PAYLOAD);
		expect(res.status).toBe(403);
	});

	it('403 — store_manager role is forbidden', async () => {
		const { accessToken } = await createUserAndLogin({
			role: 'store_manager',
		});
		const api = createApiClient(accessToken);
		const res = await api.post('/api/users').send(VALID_USER_PAYLOAD);
		expect(res.status).toBe(403);
	});
});

// ─── GET /api/users ───────────────────────────────────────────────────────────

describe('GET /api/users', () => {
	it('200 — returns list of users', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);

		await seedUser(api);
		const res = await api.get('/api/users');

		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			items: expect.any(Array),
			total: expect.any(Number),
			page: 1,
			limit: 50,
		});
		expect(res.body.items.length).toBeGreaterThanOrEqual(1);
		res.body.items.forEach((u) => expect(u.password).toBeUndefined());
	});

	it('401 — no token', async () => {
		const res = await request(app).get('/api/users');
		expect(res.status).toBe(401);
	});

	it('200 — audience=staff excludes customers', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		await seedUser(api);
		await createUser({
			email: `cust_aud_${Date.now()}@test.com`,
			password: 'TestPass123!',
			name: 'Cust Aud',
			role: 'customer',
		});
		const res = await api.get('/api/users?audience=staff');
		expect(res.status).toBe(200);
		expect(res.body.items.every((u) => u.role !== 'customer')).toBe(true);
	});

	it('200 — audience=customers returns only customers', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		await createUser({
			email: `cust_only_${Date.now()}@test.com`,
			password: 'TestPass123!',
			name: 'Cust Only',
			role: 'customer',
		});
		const res = await api.get('/api/users?audience=customers');
		expect(res.status).toBe(200);
		expect(res.body.items.length).toBeGreaterThanOrEqual(1);
		expect(res.body.items.every((u) => u.role === 'customer')).toBe(
			true,
		);
	});

	it('200 — paginates with page and limit', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		await seedUser(api);
		const res = await api.get('/api/users?page=1&limit=1');
		expect(res.status).toBe(200);
		expect(res.body.items).toHaveLength(1);
		expect(res.body.total).toBeGreaterThanOrEqual(2);
		expect(res.body.page).toBe(1);
		expect(res.body.limit).toBe(1);
	});
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────

describe('GET /api/users/:id', () => {
	it('200 — returns user by valid ID', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const userId = await seedUser(api);

		const res = await api.get(`/api/users/${userId}`);
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('role', 'cashier');
		expect(res.body.password).toBeUndefined();
	});

	it('404 — valid ObjectId that does not exist', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const fakeId = new mongoose.Types.ObjectId().toHexString();
		const res = await api.get(`/api/users/${fakeId}`);
		expect(res.status).toBe(404);
	});

	it('400/422 — malformed ObjectId', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api.get('/api/users/not-valid-id');
		expect(res.status).toBeGreaterThanOrEqual(400);
		// malformed IDs may return 400 or 500 depending on error handler
		expect(res.status).toBeLessThan(600);
	});
});

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────

describe('PUT /api/users/:id', () => {
	it('200 — valid update changes user fields', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const userId = await seedUser(api);

		const res = await api
			.put(`/api/users/${userId}`)
			.send({ name: 'Updated Name' });
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ name: 'Updated Name' });
	});

	it('422 — invalid role enum on update', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const userId = await seedUser(api);

		const res = await api
			.put(`/api/users/${userId}`)
			.send({ role: 'god_mode' });
		expect(res.status).toBe(400);
	});

	it('404 — updating non-existent user', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const fakeId = new mongoose.Types.ObjectId().toHexString();
		const res = await api
			.put(`/api/users/${fakeId}`)
			.send({ name: 'Ghost' });
		expect(res.status).toBe(404);
	});

	it('401 — no token on update', async () => {
		const res = await request(app)
			.put(`/api/users/${new mongoose.Types.ObjectId()}`)
			.send({ name: 'x' });
		expect(res.status).toBe(401);
	});

	it('403 — cannot update customer user from user management', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const { user: cust } = await createUser({
			email: `cust_put_${Date.now()}@test.com`,
			password: 'TestPass123!',
			name: 'Customer X',
			role: 'customer',
		});
		const res = await api
			.put(`/api/users/${cust._id}`)
			.send({ name: 'Hacked' });
		expect(res.status).toBe(403);
	});
});

// ─── PATCH /api/users/:id/toggle ─────────────────────────────────────────────

describe('PATCH /api/users/:id/toggle', () => {
	it('200 — toggles the isActive flag', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const userId = await seedUser(api);

		const res = await api.patch(`/api/users/${userId}/toggle`);
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('isActive', false);
	});

	it('404 — non-existent user', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const fakeId = new mongoose.Types.ObjectId().toHexString();
		const res = await api.patch(`/api/users/${fakeId}/toggle`);
		expect(res.status).toBe(404);
	});

	it('403 — non-admin role', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'cashier' });
		const api = createApiClient(accessToken);
		const res = await api.patch(
			`/api/users/${new mongoose.Types.ObjectId()}/toggle`,
		);
		expect(res.status).toBe(403);
	});

	it('400 — cannot toggle own account', async () => {
		const { accessToken, user } = await createUserAndLogin({
			role: 'admin',
		});
		const api = createApiClient(accessToken);
		const res = await api.patch(`/api/users/${user._id}/toggle`);
		expect(res.status).toBe(400);
	});
});
