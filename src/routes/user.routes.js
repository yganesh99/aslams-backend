import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/userController.js';
import auth from '../middlewares/auth.js';


const router = express.Router({ mergeParams: true });

router.use(auth(['admin']));

router.post(
	'/',
	celebrate({
		[Segments.BODY]: Joi.object({
			email: Joi.string().email().required(),
			password: Joi.string().min(8).required(),
			name: Joi.string().required(),
			phone: Joi.string().allow('').optional(),
			role: Joi.string().required(),
		}),
	}),
	controller.create,
);

router.get(
	'/',
	celebrate({
		[Segments.QUERY]: Joi.object({
			audience: Joi.string().valid('staff', 'customers').optional(),
			page: Joi.number().integer().min(1).optional(),
			limit: Joi.number().integer().min(1).max(100).optional(),
		}),
	}),
	controller.getAll,
);
router.get('/:id', controller.getById);

router.put(
	'/:id',
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().allow(''),
			phone: Joi.string().allow(''),
			role: Joi.string(),
		}),
	}),
	controller.update,
);

router.patch('/:id/toggle', controller.toggleActive);
router.delete('/:id', controller.remove);

export default router;
