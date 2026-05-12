import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/customerController.js';
import auth from '../middlewares/auth.js';


const router = express.Router({ mergeParams: true });

router.use(auth(['admin', 'store_manager', 'accountant', 'cashier']));

router.post(
	'/',
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().required(),
			email: Joi.string().email().allow('').optional(),
			phone: Joi.string().allow('').optional(),
			address: Joi.object({
				street: Joi.string().allow(''),
				city: Joi.string().allow(''),
				state: Joi.string().allow(''),
				zip: Joi.string().allow(''),
				country: Joi.string().allow(''),
			}).optional(),
			creditLimit: Joi.number().min(0).optional(),
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
			email: Joi.string().email().allow(''),
			phone: Joi.string().allow(''),
			address: Joi.object({
				street: Joi.string().allow(''),
				city: Joi.string().allow(''),
				state: Joi.string().allow(''),
				zip: Joi.string().allow(''),
				country: Joi.string().allow(''),
			}),
			creditLimit: Joi.number().min(0),
		}),
	}),
	controller.update,
);

router.delete(
	'/:id',
	auth(['admin', 'store_manager', 'accountant']),
	controller.remove,
);

export default router;
