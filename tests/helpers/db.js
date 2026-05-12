/**
 * tests/helpers/db.js
 *
 * Database lifecycle helpers.
 * Call connect() in beforeAll, clearCollections() in beforeEach,
 * and disconnect() in afterAll.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load .env.test — the dynamic MONGO_URI injected by globalSetup wins
// because process.env vars set by globalSetup are already present.
dotenv.config({ path: '.env.test' });

/**
 * Connect to the in-memory MongoDB started by globalSetup.
 * Uses the dynamic URI written into process.env.MONGO_URI by globalSetup.js.
 */
async function connect() {
	const uri = process.env.MONGO_URI;
	if (!uri)
		throw new Error('MONGO_URI is not set. Ensure globalSetup ran first.');

	if (mongoose.connection.readyState === 0) {
		await mongoose.connect(uri, { autoIndex: true });
	}
}

/**
 * Drop all collections between tests to ensure idempotency.
 * This is faster than recreating the entire DB.
 */
async function clearCollections() {
	const collections = mongoose.connection.collections;
	await Promise.all(
		Object.values(collections).map((col) => col.deleteMany({})),
	);
}

/**
 * Close the Mongoose connection after all tests in a file finish.
 */
async function disconnect() {
	await mongoose.connection.close();
}

module.exports = { connect, clearCollections, disconnect };
