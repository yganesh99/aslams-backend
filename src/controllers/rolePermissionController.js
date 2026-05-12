import * as rolePermissionService from '../services/rolePermission.service.js';


export const getAll = async (_req, res, next) => {
	try {
		const docs = await rolePermissionService.getAll();
		res.json(docs);
	} catch (err) {
		next(err);
	}
};

export const getByRole = async (req, res, next) => {
	try {
		const doc = await rolePermissionService.getByRole(req.params.role);
		if (!doc)
			return res
				.status(404)
				.json({ message: 'No permissions found for this role' });
		res.json(doc);
	} catch (err) {
		next(err);
	}
};

export const update = async (req, res, next) => {
	try {
		const doc = await rolePermissionService.upsert(
			req.params.role,
			req.body.sections,
		);
		res.json(doc);
	} catch (err) {
		next(err);
	}
};
