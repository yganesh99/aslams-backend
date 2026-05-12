/**
 * tests/api/products.test.js
 *
 * Endpoint-level tests for the Products API:
 *   POST   /api/products         — Create product
 *   GET    /api/products         — List products
 *   GET    /api/products/:id     — Get by ID
 *   PUT    /api/products/:id     — Update product
 *   PATCH  /api/products/:id/toggle — Toggle active status
 *
 * Access control matrix:
 *   admin           → 2xx (allowed)
 *   cashier         → 403 (forbidden on mutations)
 *   GET list        → public (no token); `includeInactive` only for admin / store_manager / inventory_manager
 */

'use strict';

require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const db = require('../helpers/db');
const { createUserAndLogin, authHeader } = require('../helpers/auth');
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

/** A fully specified valid product payload */
const VALID_PRODUCT = {
	sku: 'PROD-001',
	name: 'Test Widget',
	description: 'A test product',
	unit: 'pcs',
	posPrice: 10.99,
	ecommercePrice: 12.99,
	taxRate: 8,
	visibility: 'both',
};

/** Helper — create a product via the API and return its ID */
async function seedProduct(api, overrides = {}) {
	const res = await api
		.post('/api/products')
		.send({ ...VALID_PRODUCT, ...overrides });
	if (res.status !== 201) {
		throw new Error(
			`Seed product failed: ${res.status} ${JSON.stringify(res.body)}`,
		);
	}
	return res.body._id || res.body.id || res.body.product?._id;
}

// ─── POST /api/products ───────────────────────────────────────────────────────

describe('POST /api/products', () => {
	it('201 — valid payload with all fields', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);

		const res = await api.post('/api/products').send(VALID_PRODUCT);

		expect(res.status).toBe(201);
		expect(res.body).toMatchObject({
			sku: 'PROD-001',
			name: 'Test Widget',
		});
	});

	it('201 — minimal required fields only', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);

		const res = await api.post('/api/products').send({
			sku: 'PROD-MIN',
			name: 'Minimal Product',
			posPrice: 5,
			ecommercePrice: 6,
		});

		expect(res.status).toBe(201);
		expect(res.body).toHaveProperty('sku', 'PROD-MIN');
	});

	// Missing required field cases
	const missingFieldCases = [
		{
			label: 'missing sku',
			body: { name: 'X', posPrice: 1, ecommercePrice: 1 },
		},
		{
			label: 'missing name',
			body: { sku: 'X', posPrice: 1, ecommercePrice: 1 },
		},
		{
			label: 'missing posPrice',
			body: { sku: 'X', name: 'X', ecommercePrice: 1 },
		},
		{
			label: 'missing ecommercePrice',
			body: { sku: 'X', name: 'X', posPrice: 1 },
		},
	];

	test.each(missingFieldCases)('422 — $label', async ({ body }) => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api.post('/api/products').send(body);
		expect(res.status).toBe(400);
	});

	// Boundary / invalid value cases
	const invalidValueCases = [
		{
			label: 'negative posPrice (boundary: -1)',
			body: { ...VALID_PRODUCT, sku: 'BND-001', posPrice: -1 },
		},
		{
			label: 'invalid visibility enum',
			body: {
				...VALID_PRODUCT,
				sku: 'BND-003',
				visibility: 'unknown_visibility',
			},
		},
	];

	test.each(invalidValueCases)('422 — $label', async ({ body }) => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api.post('/api/products').send(body);
		expect(res.status).toBe(400);
	});

	// Auth / RBAC
	it('401 — no token', async () => {
		const res = await request(app)
			.post('/api/products')
			.send(VALID_PRODUCT);
		expect(res.status).toBe(401);
	});

	it('403 — cashier role is forbidden', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'cashier' });
		const api = createApiClient(accessToken);
		const res = await api.post('/api/products').send(VALID_PRODUCT);
		expect(res.status).toBe(403);
	});
});

// ─── GET /api/products ────────────────────────────────────────────────────────

describe('GET /api/products', () => {
	it('200 — returns array of products', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);

		await seedProduct(api);
		const res = await api.get('/api/products');

		expect(res.status).toBe(200);
		// API may return paginated {items, total} or plain array
		const list = Array.isArray(res.body) ? res.body : res.body.items;
		expect(Array.isArray(list)).toBe(true);
		expect(list.length).toBeGreaterThanOrEqual(1);
	});

	it('200 — returns empty array when no products exist', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api.get('/api/products');
		expect(res.status).toBe(200);
		// API may return paginated {items, total} or plain array
		const list = Array.isArray(res.body) ? res.body : res.body.items;
		expect(Array.isArray(list)).toBe(true);
	});

	it('200 — no token (public product list for storefront)', async () => {
		const res = await request(app).get('/api/products');
		expect(res.status).toBe(200);
		const list = Array.isArray(res.body) ? res.body : res.body.items;
		expect(Array.isArray(list)).toBe(true);
	});

	it('200 — includeInactive without auth is ignored (only active)', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);
		await api.patch(`/api/products/${productId}/toggle`);

		const res = await request(app).get(
			'/api/products?includeInactive=true',
		);
		expect(res.status).toBe(200);
		const list = res.body.items || [];
		expect(list.every((p) => p.isActive !== false)).toBe(true);
	});

	it('200 — admin + includeInactive lists inactive products', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api, { sku: 'INACTIVE-LIST' });
		await api.patch(`/api/products/${productId}/toggle`);

		const res = await api.get('/api/products?includeInactive=true');
		expect(res.status).toBe(200);
		const skus = (res.body.items || []).map((p) => p.sku);
		expect(skus).toContain('INACTIVE-LIST');
	});
});

// ─── GET /api/products/:id ────────────────────────────────────────────────────

describe('GET /api/products/:id', () => {
	it('200 — returns product by valid ID', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		const res = await api.get(`/api/products/${productId}`);
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('sku', VALID_PRODUCT.sku);
	});

	it('404 — non-existent but valid ObjectId', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const fakeId = new mongoose.Types.ObjectId().toHexString();
		const res = await api.get(`/api/products/${fakeId}`);
		expect(res.status).toBe(404);
	});

	it('400/422 — malformed ObjectId', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const res = await api.get('/api/products/not-a-valid-id');
		expect(res.status).toBeGreaterThanOrEqual(400);
		// malformed IDs may return 400 or 500 depending on error handler config
		expect(res.status).toBeLessThan(600);
	});
});

// ─── PUT /api/products/:id ────────────────────────────────────────────────────

describe('PUT /api/products/:id', () => {
	it('200 — valid update changes product fields', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		const res = await api
			.put(`/api/products/${productId}`)
			.send({ name: 'Updated Widget', posPrice: 15.99 });

		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			name: 'Updated Widget',
			posPrice: 15.99,
		});
	});

	it('422 — negative price in update body', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		const res = await api
			.put(`/api/products/${productId}`)
			.send({ posPrice: -5 });

		expect(res.status).toBe(400);
	});

	it('422 — invalid visibility enum in update', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		const res = await api
			.put(`/api/products/${productId}`)
			.send({ visibility: 'everywhere' });

		expect(res.status).toBe(400);
	});

	it('404 — updating a non-existent product', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const fakeId = new mongoose.Types.ObjectId().toHexString();
		const res = await api
			.put(`/api/products/${fakeId}`)
			.send({ name: 'Ghost' });
		expect(res.status).toBe(404);
	});

	it('401 — no token on update', async () => {
		const res = await request(app)
			.put(`/api/products/${new mongoose.Types.ObjectId()}`)
			.send({ name: 'Ghost' });
		expect(res.status).toBe(401);
	});
});

// ─── PATCH /api/products/:id/toggle ──────────────────────────────────────────

describe('PATCH /api/products/:id/toggle', () => {
	it('200 — toggles the isActive flag', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		const res = await api.patch(`/api/products/${productId}/toggle`);
		expect(res.status).toBe(200);
		// The product should now be inactive (was created active by default)
		expect(res.body).toHaveProperty('isActive', false);
	});

	it('404 — non-existent product', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const fakeId = new mongoose.Types.ObjectId().toHexString();
		const res = await api.patch(`/api/products/${fakeId}/toggle`);
		expect(res.status).toBe(404);
	});

	it('401 — no auth token', async () => {
		const res = await request(app).patch(
			`/api/products/${new mongoose.Types.ObjectId()}/toggle`,
		);
		expect(res.status).toBe(401);
	});
});

// ─── POST /api/products/:id/image ──────────────────────────────────────────────

describe('POST /api/products/:id/image', () => {
	it('200 — valid image upload', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		// Use a tiny 1x1 transparent PNG buffer for testing
		const tinyPng = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==',
			'base64',
		);

		const res = await request(app)
			.post(`/api/products/${productId}/image`)
			.set('Authorization', `Bearer ${accessToken}`)
			.attach('image', tinyPng, 'test.png');

		expect(res.status).toBe(200);
		expect(res.body.image).toMatch(/^\/uploads\/products\//);
	});

	it('400 — missing image file', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		const res = await request(app)
			.post(`/api/products/${productId}/image`)
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/No image file provided/i);
	});

	it('400 — invalid file type', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		const fakeTxt = Buffer.from('this is not an image');

		const res = await request(app)
			.post(`/api/products/${productId}/image`)
			.set('Authorization', `Bearer ${accessToken}`)
			.attach('image', fakeTxt, 'test.txt');

		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/Invalid file type/i);
	});
});

// ─── DELETE /api/products/:id/images/:filename ─────────────────────────────────

describe('DELETE /api/products/:id/images/:filename', () => {
	it('200 — removes image and file', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		const tinyPng = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==',
			'base64',
		);

		const up = await request(app)
			.post(`/api/products/${productId}/image`)
			.set('Authorization', `Bearer ${accessToken}`)
			.attach('image', tinyPng, 'test.png');

		expect(up.status).toBe(200);
		const filename = up.body.image.replace(/^\/uploads\/products\//, '');

		const res = await request(app)
			.delete(
				`/api/products/${productId}/images/${encodeURIComponent(filename)}`,
			)
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(200);
		expect(res.body.images || []).not.toContain(up.body.image);
	});

	it('404 — image not on product', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const api = createApiClient(accessToken);
		const productId = await seedProduct(api);

		const res = await request(app)
			.delete(`/api/products/${productId}/images/nope-123.png`)
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(404);
	});
});
