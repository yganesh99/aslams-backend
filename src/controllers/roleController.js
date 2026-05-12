import * as roleService from '../services/role.service.js';


export const getAll = async (_req, res, next) => {
	try {
		res.json(await roleService.getAll());
	} catch (err) {
		next(err);
	}
};

export const getStaffRoles = async (_req, res, next) => {
	try {
		res.json(await roleService.getStaffRoles());
	} catch (err) {
		next(err);
	}
};

export const create = async (req, res, next) => {
	try {
		const role = await roleService.create(req.body);
		res.status(201).json(role);
	} catch (err) {
		if (err.code === 11000) {
			return res
				.status(409)
				.json({ message: 'A role with this slug already exists' });
		}
		next(err);
	}
};

export const update = async (req, res, next) => {
	try {
		const role = await roleService.update(req.params.slug, req.body);
		if (!role) return res.status(404).json({ message: 'Role not found' });
		res.json(role);
	} catch (err) {
		if (err.status) return res.status(err.status).json({ message: err.message });
		next(err);
	}
};

export const remove = async (req, res, next) => {
	try {
		const role = await roleService.remove(req.params.slug);
		if (!role) return res.status(404).json({ message: 'Role not found' });
		res.json({ message: 'Role deleted', role });
	} catch (err) {
		if (err.status) return res.status(err.status).json({ message: err.message });
		next(err);
	}
};
