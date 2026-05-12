import Tax from '../models/tax.model.js';


async function create(data) {
	return Tax.create(data);
}

async function getAll() {
	return Tax.find({ isActive: true }).sort({ name: 1 });
}

async function getById(id) {
	return Tax.findById(id);
}

async function update(id, data) {
	return Tax.findByIdAndUpdate(id, data, {
		new: true,
		runValidators: true,
	});
}

async function getDefault() {
	return Tax.findOne({ isDefault: true, isActive: true });
}

export { create, getAll, getById, update, getDefault };
