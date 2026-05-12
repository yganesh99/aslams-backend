/**
 * tests/setup/globalTeardown.js
 *
 * Runs ONCE after all test suites complete.
 * Stops the in-memory MongoDB instance started in globalSetup.
 */
module.exports = async () => {
	if (global.__MONGOD__) {
		await global.__MONGOD__.stop();
	}
};
