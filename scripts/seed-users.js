import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { hashPassword } from 'better-auth/crypto';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

async function createBetterAuthUser(db, { name, email, password, role }) {
	const userId = crypto.randomUUID();
	const hashedPassword = await hashPassword(password);

	await db.collection('user').insertOne({
		_id: userId,
		name,
		email,
		emailVerified: false,
		image: null,
		role,
		banned: false,
		banReason: null,
		banExpires: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	await db.collection('account').insertOne({
		_id: crypto.randomUUID(),
		userId,
		accountId: userId,
		providerId: 'credential',
		password: hashedPassword,
		accessToken: null,
		refreshToken: null,
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
		scope: null,
		idToken: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	console.log(`  Created user: ${email} (${role})`);
	return userId;
}

try {
	console.log('Connecting to database...');
	await mongoose.connect(process.env.MONGO_URI);
	const db = mongoose.connection.db;
	console.log('MongoDB Connected.');

	console.log('Clearing auth data...');
	await db.collection('user').deleteMany({});
	await db.collection('account').deleteMany({});
	await db.collection('session').deleteMany({});

	console.log('Creating seed users...');
	await createBetterAuthUser(db, {
		name: 'Admin User',
		email: 'admin@erp.com',
		password: 'password123',
		role: 'admin',
	});
	await createBetterAuthUser(db, {
		name: 'Cashier User',
		email: 'cashier@erp.com',
		password: 'password123',
		role: 'cashier',
	});

	console.log('User seeding completed!');
	process.exit();
} catch (error) {
	console.error('Error seeding users:', error);
	process.exit(1);
}
