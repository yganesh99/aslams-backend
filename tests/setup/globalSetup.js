/**
 * tests/setup/globalSetup.js
 *
 * Runs ONCE before all test suites.
 * Starts an in-memory MongoDB replica set so Mongoose **transactions** work
 * (POS orders, refunds, register open, etc. use startTransaction).
 */
const { MongoMemoryReplSet } = require('mongodb-memory-server');

module.exports = async () => {
	require('dotenv').config({ path: '.env.test' });

	const replSet = await MongoMemoryReplSet.create({
		replSet: {
			count: 1,
			storageEngine: 'wiredTiger',
		},
	});

	const uri = replSet.getUri();

	global.__MONGOD__ = replSet;
	process.env.MONGO_URI = uri;
	process.env.__MONGO_URI__ = uri;
};
