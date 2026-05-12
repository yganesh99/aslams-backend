export default (err, req, res, next) => {
	console.error(err);
	if (err.name === 'ValidationError') {
		return res.status(400).json({ message: err.message });
	}
	if (err.code === 11000 && err.keyPattern) {
		const keys = Object.keys(err.keyPattern);
		if (keys.length === 1 && keys[0] === 'sku') {
			return res
				.status(400)
				.json({ message: 'A product with this SKU already exists.' });
		}
		if (keys.length === 1 && keys[0] === 'name') {
			return res.status(400).json({
				message: 'This name is already in use.',
			});
		}
		return res.status(400).json({
			message: 'This value is already in use.',
		});
	}
	res.status(err.status || 500).json({
		message: err.message || 'Internal Server Error',
	});
};
