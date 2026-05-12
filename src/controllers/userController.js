import * as userService from '../services/user.service.js';
import * as roleService from '../services/role.service.js';
import { logAudit } from '../middlewares/auditLog.js';

function toFrontend(doc) {
	if (!doc) return null;
	return {
		_id: doc._id,
		name: doc.name,
		email: doc.email,
		phone: doc.phone || '',
		role: doc.role,
		isActive: !doc.banned,
		firstName: doc.firstName || '',
		lastName: doc.lastName || '',
		address: doc.address || '',
		country: doc.country || '',
		city: doc.city || '',
		postalCode: doc.postalCode || '',
	};
}

export const create = async (req, res, next) => {
	try {
		if (req.body.role) {
			const valid = await roleService.isValidRole(req.body.role);
			if (!valid) {
				return res
					.status(400)
					.json({ message: `Invalid role: "${req.body.role}"` });
			}
		}
		const user = await userService.createUser(req.body);
		res.status(201).json(toFrontend(user));
	} catch (err) {
		next(err);
	}
};

export const getAll = async (req, res, next) => {
	try {
		const audience = req.query.audience;
		const result = await userService.getAll({
			audience:
				audience === 'staff' || audience === 'customers'
					? audience
					: 'all',
			page: req.query.page,
			limit: req.query.limit,
		});
		res.json({
			...result,
			items: result.items.map(toFrontend),
		});
	} catch (err) {
		next(err);
	}
};

export const getById = async (req, res, next) => {
	try {
		const user = await userService.getById(req.params.id);
		if (!user) return res.status(404).json({ message: 'Not found' });
		res.json(toFrontend(user));
	} catch (err) {
		next(err);
	}
};

export const update = async (req, res, next) => {
	try {
		if (req.body.role) {
			const valid = await roleService.isValidRole(req.body.role);
			if (!valid) {
				return res
					.status(400)
					.json({ message: `Invalid role: "${req.body.role}"` });
			}
		}
		const user = await userService.update(req.params.id, req.body);
		if (!user) return res.status(404).json({ message: 'Not found' });
		res.json(toFrontend(user));
	} catch (err) {
		next(err);
	}
};

export const toggleActive = async (req, res, next) => {
	try {
		if (String(req.params.id) === String(req.user.id)) {
			return res.status(400).json({
				message: 'You cannot suspend or activate your own account',
			});
		}
		const user = await userService.toggleActive(req.params.id);
		if (!user) return res.status(404).json({ message: 'Not found' });
		res.json(toFrontend(user));
	} catch (err) {
		next(err);
	}
};

export const remove = async (req, res, next) => {
	try {
		if (String(req.params.id) === String(req.user.id)) {
			return res
				.status(400)
				.json({ message: 'Cannot delete your own account' });
		}

		const user = await userService.getById(req.params.id);
		if (!user) return res.status(404).json({ message: 'Not found' });

		if (user.role === 'admin') {
			const adminCount = await userService.countByRole('admin');
			if (adminCount <= 1) {
				return res
					.status(400)
					.json({ message: 'Cannot delete the last admin' });
			}
		}

		await userService.archive(req.params.id);

		logAudit({
			userId: req.user.id,
			action: 'delete',
			entity: 'User',
			entityId: user._id,
			changes: { archived: true },
		});
		res.status(204).send();
	} catch (err) {
		next(err);
	}
};
