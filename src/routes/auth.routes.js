import express from 'express';
import auth from '../middlewares/auth.js';
import * as rolePermissionService from '../services/rolePermission.service.js';
import * as roleService from '../services/role.service.js';

const router = express.Router();

router.get('/me', auth(), async (req, res, next) => {
	try {
		const [allowedSections, roleDoc] = await Promise.all([
			rolePermissionService.getSectionsForRole(req.user.role),
			roleService.getBySlug(req.user.role),
		]);
		res.json({
			_id: req.user.id,
			id: req.user.id,
			email: req.user.email,
			name: req.user.name,
			role: req.user.role,
			roleLabel: roleDoc?.label || req.user.role,
			allowedSections,
		});
	} catch (err) {
		next(err);
	}
});

export default router;
