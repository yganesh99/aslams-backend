/**
 * tests/helpers/auth.js
 *
 * Authentication helpers.
 * These helpers allow test files to quickly create users and obtain
 * JWT tokens without duplicating login logic across test files.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');

/**
 * Directly inserts a User document into the database.
 * Bypasses the HTTP layer to avoid bootstrap chicken-and-egg issues.
 *
 * @param {object} overrides - Fields to override on the default admin user
 * @returns {Promise<{user: object, plainPassword: string}>}
 */
async function createUser(overrides = {}) {
	// Require model lazily (Mongoose must already be connected)
	const User = require('../../src/models/user.model');

	const plainPassword = overrides.password || 'TestPass123!';
	const defaults = {
		email: `admin_${Date.now()}@test.com`,
		password: plainPassword,
		name: 'Test Admin',
		role: 'admin',
	};

	const user = new User({ ...defaults, ...overrides });
	await user.save();
	return { user, plainPassword };
}

/**
 * Creates a user then logs in, returning { accessToken, refreshToken, user }.
 *
 * @param {object} userOverrides - Forwarded to createUser()
 * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>}
 */
async function createUserAndLogin(userOverrides = {}) {
	const { user, plainPassword } = await createUser(userOverrides);

	const res = await request(app)
		.post('/api/auth/login')
		.send({ email: user.email, password: plainPassword });

	if (res.status !== 200) {
		throw new Error(
			`Login failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`,
		);
	}

	return {
		accessToken: res.body.accessToken,
		refreshToken: res.body.refreshToken,
		user,
	};
}

/**
 * Returns the Authorization header object for supertest.
 * Usage: request(app).get('/api/...').set(authHeader(token))
 *
 * @param {string} token
 * @returns {{ Authorization: string }}
 */
function authHeader(token) {
	return { Authorization: `Bearer ${token}` };
}

module.exports = { createUser, createUserAndLogin, authHeader };
