/**
 * tests/helpers/apiClient.js
 *
 * A thin Supertest wrapper that automatically attaches a Bearer token
 * when one is provided. This keeps test code clean — no need to chain
 * .set(authHeader(token)) on every single request.
 *
 * Usage:
 *   const api = createApiClient(accessToken);
 *   const res = await api.post('/api/products').send({ ... });
 *
 *   // Unauthenticated request:
 *   const res = await createApiClient().get('/api/products');
 */
const request = require('supertest');
const app = require('../../src/app');

/**
 * Creates a supertest agent bound to the app.
 * If a token is provided, every request it makes will include
 * the Authorization: Bearer header automatically.
 *
 * @param {string|null} token - JWT access token
 * @returns {object} - Object with .get/.post/.put/.patch/.delete methods
 */
function createApiClient(token = null) {
	// Helper to conditionally set auth
	function withAuth(req) {
		return token ? req.set('Authorization', `Bearer ${token}`) : req;
	}

	return {
		get: (url) => withAuth(request(app).get(url)),
		post: (url) => withAuth(request(app).post(url)),
		put: (url) => withAuth(request(app).put(url)),
		patch: (url) => withAuth(request(app).patch(url)),
		delete: (url) => withAuth(request(app).delete(url)),
	};
}

module.exports = { createApiClient };
