const mongoose = require('mongoose');

async function createWarehouse() {
	require('dotenv').config({
		path: '/Users/yogeshganesh/Desktop/Experiments/ERP/backend/.env',
	});
	const mongoURI = process.env.MONGO_URI;
	if (!mongoURI) {
		console.error('MONGO_URI not found in backend/.env');
		process.exit(1);
	}
	await mongoose.connect(mongoURI);

	// Instead of requiring the model directly, define it temporarily
	// to avoid issues with other models failing to load dependencies
	const storeSchema = new mongoose.Schema(
		{
			name: { type: String, required: true, trim: true },
			code: { type: String, required: true, trim: true },
			address: {
				street: String,
				city: String,
				state: String,
				zip: String,
				country: String,
			},
			phone: { type: String },
			isActive: { type: Boolean, default: true },
		},
		{ timestamps: true },
	);

	const Store = mongoose.model('Store', storeSchema);
	let warehouse = await Store.findOne({ code: 'WEB-WH' });

	if (!warehouse) {
		warehouse = await Store.create({
			name: 'E-commerce Warehouse',
			code: 'WEB-WH',
			address: {
				street: 'Online Fulfillment Center',
				city: 'Virtual',
				country: 'Global',
			},
			isActive: true,
		});
		console.log('Created new E-commerce Warehouse:', warehouse._id);
	} else {
		console.log('E-commerce Warehouse already exists:', warehouse._id);
	}

	process.exit(0);
}

createWarehouse();
