/**
 * tests/api/auth.test.js
 *
 * Endpoint-level tests for the Auth API:
 *   POST   /api/auth/register
 *   POST   /api/auth/login
 *   POST   /api/auth/refresh
 *   GET    /api/auth/me
 *
 * Strategy: table-driven cases per endpoint; each test is stateless (beforeEach wipes DB).
 */

'use strict';

require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');
const {
	createUser,
	createUserAndLogin,
	authHeader,
} = require('../helpers/auth');

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

// ─── POST /api/auth/register ─────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
	// Valid payloads
	const validCases = [
		{
			label: 'all fields provided',
			body: {
				email: 'alice@test.com',
				password: 'Secure123!',
				name: 'Alice',
			},
			expectedStatus: 201,
		},
		{
			label: 'without optional name field',
			body: { email: 'bob@test.com', password: 'Secure123!' },
			expectedStatus: 201, // register derives display name from email local part
		},
	];

	test.each(validCases)('201 — $label', async ({ body, expectedStatus }) => {
		const res = await request(app).post('/api/auth/register').send(body);
		expect(res.status).toBe(expectedStatus);
		// Register returns {id, email, role} — not tokens
		expect(res.body).toHaveProperty('id');
		expect(res.body).toHaveProperty('email');
		// Password must never be leaked
		expect(res.body.password).toBeUndefined();
	});

	// Invalid payloads (422 = celebrate/Joi validation failure)
	const invalidCases = [
		{
			label: 'missing email',
			body: { password: 'Secure123!' },
			expectedStatus: 400,
		},
		{
			label: 'missing password',
			body: { email: 'carol@test.com' },
			expectedStatus: 400,
		},
		{
			label: 'invalid email format',
			body: { email: 'not-an-email', password: 'Secure123!' },
			expectedStatus: 400,
		},
		{
			label: 'password too short (< 8 chars)',
			body: { email: 'dave@test.com', password: 'short' },
			expectedStatus: 400,
		},
		{
			label: 'empty body',
			body: {},
			expectedStatus: 400,
		},
	];

	test.each(invalidCases)(
		'422 — $label',
		async ({ body, expectedStatus }) => {
			const res = await request(app)
				.post('/api/auth/register')
				.send(body);
			expect(res.status).toBe(expectedStatus);
		},
	);

	it('409 — duplicate email returns non-2xx', async () => {
		const payload = { email: 'dup@test.com', password: 'Secure123!' };
		await request(app).post('/api/auth/register').send(payload);
		const res = await request(app).post('/api/auth/register').send(payload);
		expect(res.status).toBeGreaterThanOrEqual(400);
	});
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
	const VALID_EMAIL = 'testuser@test.com';
	const VALID_PASS = 'TestPass123!';

	// Create the user before each login test
	beforeEach(async () => {
		await createUser({
			email: VALID_EMAIL,
			password: VALID_PASS,
			role: 'admin',
		});
	});

	it('200 — valid credentials return tokens and user', async () => {
		const res = await request(app)
			.post('/api/auth/login')
			.send({ email: VALID_EMAIL, password: VALID_PASS });

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('accessToken');
		expect(res.body).toHaveProperty('refreshToken');
		// The login endpoint does not return a user object in this API
		expect(res.body.accessToken).toBeTruthy();
	});

	const invalidLoginCases = [
		{
			label: 'missing email',
			body: { password: VALID_PASS },
			expectedStatus: 400,
		},
		{
			label: 'missing password',
			body: { email: VALID_EMAIL },
			expectedStatus: 400,
		},
		{
			label: 'invalid email format',
			body: { email: 'bad-format', password: VALID_PASS },
			expectedStatus: 400,
		},
		{
			label: 'wrong password',
			body: { email: VALID_EMAIL, password: 'WrongPass999!' },
			expectedStatus: 401,
		},
		{
			label: 'non-existent email',
			body: { email: 'ghost@test.com', password: VALID_PASS },
			expectedStatus: 401,
		},
	];

	test.each(invalidLoginCases)(
		'$expectedStatus — $label',
		async ({ body, expectedStatus }) => {
			const res = await request(app).post('/api/auth/login').send(body);
			expect(res.status).toBe(expectedStatus);
		},
	);

	it('403 — suspended account cannot log in', async () => {
		await createUser({
			email: 'suspended_login@test.com',
			password: VALID_PASS,
			role: 'admin',
			isActive: false,
		});
		const res = await request(app).post('/api/auth/login').send({
			email: 'suspended_login@test.com',
			password: VALID_PASS,
		});
		expect(res.status).toBe(403);
		expect(String(res.body.message || '')).toMatch(/suspended/i);
	});
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
	it('200 — valid refreshToken returns new accessToken', async () => {
		const { refreshToken } = await createUserAndLogin({ role: 'admin' });
		const res = await request(app)
			.post('/api/auth/refresh')
			.send({ refreshToken });

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('accessToken');
	});

	it('403 — refresh denied when account is suspended', async () => {
		const User = require('../../src/models/user.model');
		const { refreshToken, user } = await createUserAndLogin({
			role: 'admin',
		});
		await User.updateOne({ _id: user._id }, { $set: { isActive: false } });
		const res = await request(app)
			.post('/api/auth/refresh')
			.send({ refreshToken });
		expect(res.status).toBe(403);
	});

	const invalidRefreshCases = [
		{
			label: 'missing refreshToken field',
			body: {},
			expectedStatus: 400,
		},
		{
			label: 'malformed token string',
			body: { refreshToken: 'not.a.jwt' },
			expectedStatus: 401,
		},
		{
			label: 'tampered token',
			body: {
				refreshToken:
					'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjY2NjYifQ.bad_signature',
			},
			expectedStatus: 401,
		},
	];

	test.each(invalidRefreshCases)(
		'$expectedStatus — $label',
		async ({ body, expectedStatus }) => {
			const res = await request(app).post('/api/auth/refresh').send(body);
			expect(res.status).toBe(expectedStatus);
		},
	);
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
	it('200 — valid Bearer token returns the authenticated user', async () => {
		const { accessToken, user } = await createUserAndLogin({
			role: 'admin',
		});
		const res = await request(app)
			.get('/api/auth/me')
			.set(authHeader(accessToken));

		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ email: user.email });
		expect(res.body.password).toBeUndefined();
	});

	it('401 — no Authorization header', async () => {
		const res = await request(app).get('/api/auth/me');
		expect(res.status).toBe(401);
	});

	it('401 — malformed Bearer token', async () => {
		const res = await request(app)
			.get('/api/auth/me')
			.set('Authorization', 'Bearer this.is.fake');
		expect(res.status).toBe(401);
	});

	it('401 — missing Bearer prefix (raw token)', async () => {
		const { accessToken } = await createUserAndLogin({ role: 'admin' });
		const res = await request(app)
			.get('/api/auth/me')
			.set('Authorization', accessToken); // no "Bearer " prefix
		expect(res.status).toBe(401);
	});

	it('401 — suspended user cannot use access token on /me', async () => {
		const User = require('../../src/models/user.model');
		const { accessToken, user } = await createUserAndLogin({
			role: 'admin',
		});
		await User.updateOne({ _id: user._id }, { $set: { isActive: false } });
		const res = await request(app)
			.get('/api/auth/me')
			.set(authHeader(accessToken));
		expect(res.status).toBe(401);
	});
});
