import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/storeController.js';
import auth from '../middlewares/auth.js';

const router = express.Router({ mergeParams: true });

/** List/read stores for POS and inventory workflows; mutations remain admin-only. */
const readStoreAuth = auth([
	'admin',
	'store_manager',
	'inventory_manager',
	'cashier',
]);

router.get('/', readStoreAuth, controller.getAll);
router.get('/:id', readStoreAuth, controller.getById);

router.post(
	'/',
	auth(['admin']),
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().required(),
			code: Joi.string().required(),
			address: Joi.object({
				street: Joi.string().allow(''),
				city: Joi.string().allow(''),
				state: Joi.string().allow(''),
				zip: Joi.string().allow(''),
				country: Joi.string().allow(''),
			}).optional(),
			phone: Joi.string().allow('').optional(),
		}),
	}),
	controller.create,
);

router.put(
	'/:id',
	auth(['admin']),
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().allow(''),
			address: Joi.object({
				street: Joi.string().allow(''),
				city: Joi.string().allow(''),
				state: Joi.string().allow(''),
				zip: Joi.string().allow(''),
				country: Joi.string().allow(''),
			}),
			phone: Joi.string().allow(''),
		}),
	}),
	controller.update,
);

router.patch('/:id/toggle', auth(['admin']), controller.toggleActive);
router.delete('/:id', auth(['admin']), controller.remove);

export default router;
