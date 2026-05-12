import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/purchaseOrderController.js';
import auth from '../middlewares/auth.js';


const router = express.Router({ mergeParams: true });

router.use(auth(['admin', 'store_manager', 'inventory_manager']));

router.post(
	'/',
	celebrate({
		[Segments.BODY]: Joi.object({
			supplierId: Joi.string().hex().length(24).required(),
			items: Joi.array()
				.items(
					Joi.object({
						productId: Joi.string().hex().length(24).required(),
						sku: Joi.string().required(),
						name: Joi.string().required(),
						orderedQty: Joi.number().integer().min(1).required(),
						unitPrice: Joi.number().min(0).required(),
					}),
				)
				.min(1)
				.required(),
			notes: Joi.string().optional().allow(''),
		}),
	}),
	controller.create,
);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.patch('/:id/approve', controller.approve);
router.patch('/:id/send', controller.markSent);

router.post(
	'/:id/receive',
	celebrate({
		[Segments.BODY]: Joi.object({
			storeId: Joi.string().hex().length(24).required(),
			items: Joi.array()
				.items(
					Joi.object({
						productId: Joi.string().hex().length(24).required(),
						quantity: Joi.number().integer().min(1).required(),
					}),
				)
				.min(1)
				.required(),
		}),
	}),
	controller.receive,
);

router.patch('/:id/cancel', controller.cancel);
router.delete('/:id', controller.remove);

export default router;
