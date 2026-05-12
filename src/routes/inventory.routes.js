import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/inventoryController.js';
import auth from '../middlewares/auth.js';


const router = express.Router();

const itemSchema = Joi.object({
	productId: Joi.string().hex().length(24).required(),
	quantity: Joi.number().min(0.001).required(),
	/** Optional: ecommerce checkout lines for FIFO COGS on confirm. */
	lineIndex: Joi.number().integer().min(0).optional(),
});

router.get(
	'/',
	auth(['admin', 'store_manager', 'inventory_manager']),
	celebrate({
		[Segments.QUERY]: Joi.object({
			storeId: Joi.string().hex().length(24).optional(),
			productId: Joi.string().hex().length(24).optional(),
			page: Joi.number().integer().min(1).optional(),
			limit: Joi.number().integer().min(1).max(100).optional(),
		}),
	}),
	controller.getStock,
);

router.post(
	'/adjust',
	auth(['admin']),
	celebrate({
		[Segments.BODY]: Joi.object({
			productId: Joi.string().hex().length(24).required(),
			storeId: Joi.string().hex().length(24).required(),
			quantityChange: Joi.number().required(),
			/** Required when quantityChange > 0 (FIFO cost layer). */
			unitCost: Joi.number().min(0).optional(),
			adjustmentNote: Joi.string().trim().max(500).allow('').optional(),
		}),
	}),
	controller.adjust,
);

router.get(
	'/transfers',
	auth([
		'admin',
		'store_manager',
		'inventory_manager',
	]),
	celebrate({
		[Segments.QUERY]: Joi.object({
			storeId: Joi.string().hex().length(24).optional(),
			page: Joi.number().integer().min(1).optional(),
			limit: Joi.number().integer().min(1).max(100).optional(),
		}),
	}),
	controller.getTransfers,
);

router.post(
	'/transfer',
	auth([
		'admin',
		'store_manager',
		'inventory_manager',
	]),
	celebrate({
		[Segments.BODY]: Joi.object({
			fromStoreId: Joi.string().hex().length(24).required(),
			toStoreId: Joi.string().hex().length(24).required(),
			items: Joi.array().items(itemSchema).min(1).required(),
		}),
	}),
	controller.transfer,
);

router.post(
	'/lock',
	auth(),
	celebrate({
		[Segments.BODY]: Joi.object({
			storeId: Joi.string().hex().length(24).required(),
			items: Joi.array().items(itemSchema).min(1).required(),
			sessionId: Joi.string().required(),
			ttlMinutes: Joi.number().integer().min(1).optional(),
		}),
	}),
	controller.lock,
);

router.post(
	'/release',
	auth(),
	celebrate({
		[Segments.BODY]: Joi.object({
			sessionId: Joi.string().required(),
		}),
	}),
	controller.release,
);

export default router;
