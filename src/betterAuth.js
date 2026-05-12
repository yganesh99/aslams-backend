import { MongoClient } from 'mongodb';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { admin } from 'better-auth/plugins';

let _auth;
let _db;

export function getBetterAuth() {
	if (_auth) return _auth;

	const client = new MongoClient(process.env.MONGO_URI);
	_db = client.db();

	const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
		? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
				.map((o) => o.trim())
				.filter(Boolean)
		: ['http://localhost:3000', 'http://localhost:4000'];

	_auth = betterAuth({
		baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:4000',
		secret: process.env.BETTER_AUTH_SECRET,
		database: mongodbAdapter(_db, { client }),
		trustedOrigins,
		plugins: [admin({ defaultRole: 'cashier' })],
	});

	return _auth;
}

export function getDb() {
	if (!_db) getBetterAuth();
	return _db;
}
