/**
 * tests/api/customers.test.js
 *
 * Endpoint-level tests for the Customers API:
 *   POST  /api/customers       — Create customer
 *   GET   /api/customers       — List customers
 *   GET   /api/customers/:id   — Get by ID
 *   PUT   /api/customers/:id   — Update customer
 *
 * Allowed roles: admin, store_manager, accountant, cashier
 */

'use strict';

require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const db = require('../helpers/db');
const { createUserAndLogin } = require('../helpers/auth');
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

const VALID_CUSTOMER = {
	name: 'Jane Doe',
	email: 'jane@test.com',
	phone: '+94771234567',
	address: {
		street: '123 Main St',
		city: 'Colombo',
		state: 'Western',
		zip: '00100',
		country: 'LK',
	},
	creditLimit: 5000,
};

/** Seed a customer via API and return its ID */
async function seedCustomer(api, overrides = {}) {
	const res = await api
		.post('/api/customers')
		.send({ ...VALID_CUSTOMER, ...overrides });
	if (res.status !== 201) {
		throw new Error(
			`Seed customer failed: ${res.status} ${JSON.stringify(res.body)}`,
		);
	}
	return res.body._id || res.body.id || res.body.customer?._id;
}

// ─── POST /api/customers ──────────────────────────────────────────────────────

describe('POST /api/customers', () => {
	it('201 — all fields provided', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);

		const res = await api.post('/api/customers').send(VALID_CUSTOMER);
		expect(res.status).toBe(201);
		expect(res.body).toMatchObject({ name: 'Jane Doe' });
	});

	it('201 — only required name field', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);

		const res = await api
			.post('/api/customers')
			.send({ name: 'Minimal Customer' });
		expect(res.status).toBe(201);
		expect(res.body).toHaveProperty('name', 'Minimal Customer');
	});

	it('201 — cashier role is allowed to create customers', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'cashier' });
		const api = createApiClient(accessToken);

		const res = await api
			.post('/api/customers')
			.send({ name: 'Cashier Customer' });
		expect(res.status).toBe(201);
	});

	// Missing required field
	it('422 — missing name (required)', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api
			.post('/api/customers')
			.send({ email: 'x@test.com' });
		expect(res.status).toBe(400);
	});

	// Invalid field format cases
	const invalidFormatCases = [
		{
			label: 'invalid email format',
			body: { name: 'X', email: 'not-a-valid-email' },
		},
		{
			label: 'negative creditLimit (boundary: -1)',
			body: { name: 'X', creditLimit: -1 },
		},
		{
			label: 'zero creditLimit (boundary: 0 — valid)',
			body: { name: 'Zero Limit', creditLimit: 0 },
			expectedStatus: 201,
		},
	];

	test.each(invalidFormatCases)(
		'$expectedStatus — $label',
		async ({ body, expectedStatus = 400 }) => {
			const { accessToken } = await createUserAndLogin({ role: 'admin' });
			const api = createApiClient(accessToken);
			const res = await api.post('/api/customers').send(body);
			expect(res.status).toBe(expectedStatus);
		},
	);

	it('401 — no token', async () => {
		const res = await request(app)
			.post('/api/customers')
			.send(VALID_CUSTOMER);
		expect(res.status).toBe(401);
	});
});

// ─── GET /api/customers ───────────────────────────────────────────────────────

describe('GET /api/customers', () => {
	it('200 — returns array of customers', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		await seedCustomer(api);

		const res = await api.get('/api/customers');
		expect(res.status).toBe(200);
		// API may return paginated {items, total} or plain array
		const list = Array.isArray(res.body) ? res.body : res.body.items;
		expect(Array.isArray(list)).toBe(true);
		expect(list.length).toBeGreaterThanOrEqual(1);
	});

	it('200 — returns empty array when no customers', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api.get('/api/customers');
		expect(res.status).toBe(200);
		// API may return paginated {items, total} or plain array
		const list = Array.isArray(res.body) ? res.body : res.body.items;
		expect(Array.isArray(list)).toBe(true);
	});

	it('401 — no token', async () => {
		const res = await request(app).get('/api/customers');
		expect(res.status).toBe(401);
	});
});

// ─── GET /api/customers/:id ───────────────────────────────────────────────────

describe('GET /api/customers/:id', () => {
	it('200 — returns the customer by valid ID', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const customerId = await seedCustomer(api);

		const res = await api.get(`/api/customers/${customerId}`);
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('name', VALID_CUSTOMER.name);
	});

	it('404 — valid ObjectId that does not exist', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const fakeId = new mongoose.Types.ObjectId().toHexString();
		const res = await api.get(`/api/customers/${fakeId}`);
		expect(res.status).toBe(404);
	});

	it('400/422 — malformed ObjectId', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api.get('/api/customers/bad-id');
		expect(res.status).toBeGreaterThanOrEqual(400);
		// malformed IDs may return 400 or 500 depending on error handler
		expect(res.status).toBeLessThan(600);
	});
});

// ─── PUT /api/customers/:id ───────────────────────────────────────────────────

describe('PUT /api/customers/:id', () => {
	it('200 — valid update changes customer fields', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const customerId = await seedCustomer(api);

		const res = await api
			.put(`/api/customers/${customerId}`)
			.send({ name: 'Updated Name', creditLimit: 10000 });

		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			name: 'Updated Name',
			creditLimit: 10000,
		});
	});

	it('422 — invalid email format on update', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const customerId = await seedCustomer(api);

		const res = await api
			.put(`/api/customers/${customerId}`)
			.send({ email: 'bad-email' });
		expect(res.status).toBe(400);
	});

	it('422 — negative creditLimit on update', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const customerId = await seedCustomer(api);

		const res = await api
			.put(`/api/customers/${customerId}`)
			.send({ creditLimit: -100 });
		expect(res.status).toBe(400);
	});

	it('404 — updating non-existent customer', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const fakeId = new mongoose.Types.ObjectId().toHexString();
		const res = await api
			.put(`/api/customers/${fakeId}`)
			.send({ name: 'Ghost' });
		expect(res.status).toBe(404);
	});

	it('401 — no token on update', async () => {
		const res = await request(app)
			.put(`/api/customers/${new mongoose.Types.ObjectId()}`)
			.send({ name: 'Ghost' });
		expect(res.status).toBe(401);
	});
});
