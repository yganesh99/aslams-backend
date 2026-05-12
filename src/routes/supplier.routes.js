import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/supplierController.js';
import auth from '../middlewares/auth.js';


const router = express.Router({ mergeParams: true });

router.use(auth(['admin']));

router.post(
	'/',
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().required(),
			contactPerson: Joi.string().allow('').optional(),
			email: Joi.string().email().allow('').optional(),
			phone: Joi.string().allow('').optional(),
			address: Joi.object({
				street: Joi.string().allow(''),
				city: Joi.string().allow(''),
				state: Joi.string().allow(''),
				zip: Joi.string().allow(''),
				country: Joi.string().allow(''),
			}).optional(),
			leadTimeDays: Joi.number().integer().min(0).optional(),
			isActive: Joi.boolean().optional(),
		}),
	}),
	controller.create,
);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);

router.put(
	'/:id',
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().allow(''),
			contactPerson: Joi.string().allow(''),
			email: Joi.string().email().allow(''),
			phone: Joi.string().allow(''),
			address: Joi.object({
				street: Joi.string().allow(''),
				city: Joi.string().allow(''),
				state: Joi.string().allow(''),
				zip: Joi.string().allow(''),
				country: Joi.string().allow(''),
			}),
			leadTimeDays: Joi.number().integer().min(0),
			isActive: Joi.boolean(),
		}),
	}),
	controller.update,
);

router.delete('/:id', controller.remove);

export default router;
