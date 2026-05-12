import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/posController.js';
import auth from '../middlewares/auth.js';

import { posOrderDiscountExternal } from '../validators/orderDiscountBody.joi.js';

const router = express.Router();

const paymentDetailSchema = Joi.object({
	method: Joi.string().valid('cash', 'card', 'qr', 'credit').required(),
	amount: Joi.number().min(0).required(),
	reference: Joi.string().optional(),
});

const orderItemSchema = Joi.object({
	productId: Joi.string().hex().length(24).required(),
	quantity: Joi.number().min(0.001).required(),
});

router.post(
	'/order',
	auth(['admin', 'cashier']),
	celebrate({
		[Segments.BODY]: Joi.object({
			storeId: Joi.string().hex().length(24).required(),
			sessionId: Joi.string().hex().length(24).required(),
			customerId: Joi.string().hex().length(24).optional().allow(null),
			items: Joi.array().items(orderItemSchema).min(1).required(),
			paymentMethod: Joi.string()
				.valid('cash', 'card', 'qr', 'split', 'credit')
				.required(),
			payments: Joi.array().items(paymentDetailSchema).optional(),
			notes: Joi.string().optional().allow(''),
			discountType: Joi.string()
				.valid('percentage', 'fixed')
				.optional()
				.allow(null),
			discountValue: Joi.when('discountType', {
				is: 'percentage',
				then: Joi.number().min(0).max(100).optional(),
				otherwise: Joi.number().min(0).optional(),
			}),
			includeTax: Joi.boolean().optional(),
			/** Required for cash (≥ total) and for split when payments include cash (≥ cash portion). */
			cashTendered: Joi.number().min(0).optional(),
		}).external(posOrderDiscountExternal),
	}),
	controller.createOrder,
);

router.post(
	'/quote',
	auth(['admin', 'cashier']),
	celebrate({
		[Segments.BODY]: Joi.object({
			storeId: Joi.string().hex().length(24).required(),
			customerId: Joi.string().hex().length(24).optional().allow(null),
			items: Joi.array().items(orderItemSchema).min(1).required(),
			notes: Joi.string().optional().allow(''),
			discountType: Joi.string()
				.valid('percentage', 'fixed')
				.optional()
				.allow(null),
			discountValue: Joi.when('discountType', {
				is: 'percentage',
				then: Joi.number().min(0).max(100).optional(),
				otherwise: Joi.number().min(0).optional(),
			}),
			includeTax: Joi.boolean().optional(),
		}).external(posOrderDiscountExternal),
	}),
	controller.generateQuote,
);

router.post(
	'/refund',
	auth(['admin', 'cashier']),
	celebrate({
		[Segments.BODY]: Joi.object({
			orderId: Joi.string().hex().length(24).required(),
			items: Joi.array()
				.items(
					Joi.object({
						productId: Joi.string().hex().length(24).required(),
						quantity: Joi.number().min(0.001).required(),
					}),
				)
				.min(1)
				.required(),
			reason: Joi.string().optional(),
			/** Required when the order’s store is inactive: active store to receive restocked inventory. */
			restockStoreId: Joi.string().hex().length(24).optional(),
		}),
	}),
	controller.refund,
);

router.get(
	'/orders/:orderId/returns',
	auth(['admin', 'cashier']),
	celebrate({
		[Segments.PARAMS]: Joi.object({
			orderId: Joi.string().hex().length(24).required(),
		}),
	}),
	controller.getReturnsByOrderId,
);

export default router;
