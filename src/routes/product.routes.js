import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/productController.js';
import auth from '../middlewares/auth.js';
import optionalAuth from '../middlewares/optionalAuth.js';
import createUpload from '../middlewares/upload.js';

const router = express.Router({ mergeParams: true });

const manageProductAuth = auth(['admin', 'store_manager', 'inventory_manager']);

router.post(
	'/',
	manageProductAuth,
	celebrate({
		[Segments.BODY]: Joi.object({
			sku: Joi.string().required(),
			name: Joi.string().required(),
			description: Joi.string().allow('').optional(),
			categories: Joi.array().items(Joi.string()).optional(),
			unit: Joi.string().allow('').optional(),
			posPrice: Joi.number().min(0).required(),
			taxRate: Joi.number().min(0).optional(),
			reorderLevel: Joi.number().min(0).optional(),
			image: Joi.string().allow('').optional(),
		}),
	}),
	controller.create,
);

router.get(
	'/',
	optionalAuth,
	celebrate({
		[Segments.QUERY]: Joi.object({
			page: Joi.number().integer().min(1).optional(),
			limit: Joi.number().integer().min(1).max(500).optional(),
			category: Joi.string().optional(),
			search: Joi.string().allow('').optional(),
			name: Joi.string().optional(),
			sku: Joi.string().optional(),
			includeInactive: Joi.string().valid('true', 'false').optional(),
			includeOutOfStock: Joi.string().valid('true', 'false').optional(),
			storeId: Joi.string().hex().length(24).optional(),
		}).unknown(true),
	}),
	controller.getAll,
);
router.get(
	'/pos-search',
	auth(['admin', 'store_manager', 'inventory_manager', 'cashier']),
	controller.searchForPos,
);
router.get(
	'/:id',
	celebrate({
		[Segments.PARAMS]: Joi.object({
			id: Joi.string().hex().length(24).required(),
		}),
	}),
	controller.getById,
);

router.put(
	'/:id',
	manageProductAuth,
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().allow(''),
			sku: Joi.string().optional(),
			description: Joi.string().allow(''),
			categories: Joi.array().items(Joi.string()).optional(),
			unit: Joi.string().allow(''),
			posPrice: Joi.number().min(0),
			taxRate: Joi.number().min(0),
			reorderLevel: Joi.number().min(0).optional(),
			image: Joi.string().allow('').optional(),
		}),
	}),
	controller.update,
);

const upload = createUpload('products');

router.post(
	'/:id/image',
	manageProductAuth,
	upload.single('image'),
	controller.uploadImage,
);

router.delete(
	'/:id/images/:filename',
	manageProductAuth,
	celebrate({
		[Segments.PARAMS]: Joi.object({
			id: Joi.string().hex().length(24).required(),
			filename: Joi.string()
				.pattern(/^[a-zA-Z0-9._-]+$/)
				.max(255)
				.required(),
		}),
	}),
	controller.removeImage,
);

router.patch('/:id/toggle', manageProductAuth, controller.toggleActive);
router.delete('/:id', manageProductAuth, controller.remove);

export default router;
