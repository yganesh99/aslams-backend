/**
 * One-time migration: copy users from the old Mongoose `users` collection
 * into Better Auth's `user` and `account` collections.
 *
 * Run:  node scripts/migrate-to-better-auth.js
 *
 * - Existing bcrypt hashes are carried over as-is (Better Auth can verify them).
 * - Google OAuth accounts get a `google` provider entry.
 * - `isActive: false` → `banned: true, banReason: 'suspended'`
 * - `deletedAt != null` → `banned: true, banReason: 'archived'`
 * - Additional profile fields (phone, address, etc.) are preserved.
 */
import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

try {
	console.log('Connecting to MongoDB...');
	await mongoose.connect(process.env.MONGO_URI);
	const db = mongoose.connection.db;
	console.log('Connected.');

	const oldUsers = await db
		.collection('users')
		.find({})
		.toArray();

	console.log(`Found ${oldUsers.length} users in the old "users" collection.`);

	let created = 0;
	let skipped = 0;

	for (const old of oldUsers) {
		const existingBA = await db
			.collection('user')
			.findOne({ email: old.email });

		if (existingBA) {
			console.log(`  SKIP (already exists): ${old.email}`);
			skipped++;
			continue;
		}

		const userId = crypto.randomUUID();

		const isArchived = old.deletedAt != null;
		const isSuspended = old.isActive === false && !isArchived;

		const userDoc = {
			_id: userId,
			name: old.name || `${old.firstName || ''} ${old.lastName || ''}`.trim() || old.email,
			email: old.email,
			emailVerified: false,
			image: null,
			role: old.role || 'cashier',
			banned: isArchived || isSuspended,
			banReason: isArchived ? 'archived' : isSuspended ? 'suspended' : null,
			banExpires: null,
			phone: old.phone || null,
			firstName: old.firstName || null,
			lastName: old.lastName || null,
			address: old.address || null,
			country: old.country || null,
			city: old.city || null,
			postalCode: old.postalCode || null,
			createdAt: old.createdAt || new Date(),
			updatedAt: old.updatedAt || new Date(),
		};

		await db.collection('user').insertOne(userDoc);

		if (old.password) {
			await db.collection('account').insertOne({
				_id: crypto.randomUUID(),
				userId,
				accountId: userId,
				providerId: 'credential',
				password: old.password,
				accessToken: null,
				refreshToken: null,
				accessTokenExpiresAt: null,
				refreshTokenExpiresAt: null,
				scope: null,
				idToken: null,
				createdAt: old.createdAt || new Date(),
				updatedAt: old.updatedAt || new Date(),
			});
		}

		if (old.googleId) {
			await db.collection('account').insertOne({
				_id: crypto.randomUUID(),
				userId,
				accountId: old.googleId,
				providerId: 'google',
				password: null,
				accessToken: null,
				refreshToken: null,
				accessTokenExpiresAt: null,
				refreshTokenExpiresAt: null,
				scope: null,
				idToken: null,
				createdAt: old.createdAt || new Date(),
				updatedAt: old.updatedAt || new Date(),
			});
		}

		const status = isArchived ? '(archived)' : isSuspended ? '(suspended)' : '';
		console.log(`  Migrated: ${old.email} → ${userId} ${status}`);
		created++;
	}

	console.log('\nCreating indexes...');
	await db
		.collection('user')
		.createIndex({ email: 1 }, { unique: true });
	await db.collection('session').createIndex({ userId: 1 });
	await db.collection('account').createIndex({ userId: 1 });

	console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
	process.exit(0);
} catch (err) {
	console.error('Migration failed:', err);
	process.exit(1);
}
