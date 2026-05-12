import mongoose from 'mongoose';
import config from './config/index.js';
import app from './app.js';
import { seedDefaults as seedRoles } from './services/role.service.js';
import { seedDefaults as seedRolePermissions } from './services/rolePermission.service.js';

async function start() {
	try {
		await mongoose.connect(config.mongoUri, { autoIndex: true });
		console.log('Connected to MongoDB..');

		await seedRoles();
		await seedRolePermissions();

		app.listen(config.port, () => {
			console.log(`Server running on port ${config.port}`);
		});
	} catch (err) {
		console.error('Failed to start', err);
		process.exit(1);
	}
}
start();
