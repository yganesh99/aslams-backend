import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

import Store from '../src/models/store.model.js';
import Product from '../src/models/product.model.js';
import Inventory from '../src/models/inventory.model.js';
import Customer from '../src/models/customer.model.js';
import Register from '../src/models/register.model.js';

try {
	console.log('Connecting to database...');
	await mongoose.connect(process.env.MONGO_URI);
	console.log('MongoDB Connected.');

	console.log('Clearing operational data...');
	const wipeOpts = { includeDeleted: true };
	await Store.deleteMany({}, wipeOpts);
	await Product.deleteMany({}, wipeOpts);
	await Inventory.deleteMany({});
	await Customer.deleteMany({}, wipeOpts);
	await Register.deleteMany({});

	console.log('Creating seed data...');

	const store = await Store.create({
		name: 'Main Store',
		code: 'MAIN-01',
		address: {
			street: '123 Main St',
			city: 'Colombo',
			state: 'Western',
			zip: '00100',
			country: 'Sri Lanka',
		},
		phone: '0112345678',
	});

	await Register.create({
		storeId: store._id,
		name: 'Register 1',
		status: 'closed',
	});

	await Customer.create({
		name: 'John Doe',
		email: 'john@example.com',
		phone: '0771234567',
		creditLimit: 50000,
		currentBalance: 0,
	});

	console.log('Operational data seeding completed!');
	process.exit();
} catch (error) {
	console.error('Error seeding data:', error);
	process.exit(1);
}
