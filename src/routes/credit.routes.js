import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/creditController.js';
import auth from '../middlewares/auth.js';


const router = express.Router();

router.get(
	'/customer/:id',
	auth(['admin']),
	controller.getCustomerLedger,
);

router.post(
	'/customer/payment',
	auth(['admin']),
	celebrate({
		[Segments.BODY]: Joi.object({
			customerId: Joi.string().hex().length(24).required(),
			amount: Joi.number().positive().required(),
		}),
	}),
	controller.customerPayment,
);

router.get(
	'/supplier/:id',
	auth(['admin']),
	controller.getSupplierLedger,
);

router.post(
	'/supplier/payment',
	auth(['admin']),
	celebrate({
		[Segments.BODY]: Joi.object({
			supplierId: Joi.string().hex().length(24).required(),
			amount: Joi.number().positive().required(),
			supplierInvoiceId: Joi.string().hex().length(24).optional(),
			method: Joi.string()
				.valid('cash', 'card', 'qr', 'bank_transfer', 'other')
				.optional(),
			reference: Joi.string().optional().allow(''),
		}),
	}),
	controller.supplierPayment,
);

export default router;
