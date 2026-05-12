import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/supplierInvoiceController.js';
import auth from '../middlewares/auth.js';
import createUpload from '../middlewares/upload.js';

const upload = createUpload('invoices');

const router = express.Router({ mergeParams: true });

router.use(auth(['admin', 'store_manager', 'accountant']));

router.post(
	'/',
	celebrate({
		[Segments.BODY]: Joi.object({
			supplierId: Joi.string().hex().length(24).required(),
			purchaseOrderId: Joi.string().hex().length(24).required(),
			invoiceNumber: Joi.string().required(),
			items: Joi.array()
				.items(
					Joi.object({
						productId: Joi.string().hex().length(24).required(),
						sku: Joi.string().required(),
						name: Joi.string().required(),
						quantity: Joi.number().integer().min(1).required(),
						unitPrice: Joi.number().min(0).required(),
						lineTotal: Joi.number().min(0).required(),
					}),
				)
				.min(1)
				.required(),
			totalAmount: Joi.number().min(0).required(),
		}),
	}),
	controller.create,
);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);

router.post(
	'/:id/payment',
	celebrate({
		[Segments.BODY]: Joi.object({
			amount: Joi.number().positive().required(),
			method: Joi.string()
				.valid('cash', 'card', 'qr', 'bank_transfer', 'other')
				.optional(),
			reference: Joi.string().optional().allow(''),
		}),
	}),
	controller.recordPayment,
);

router.post(
	'/:id/attachments',
	upload.array('files', 5),
	controller.uploadAttachments,
);

router.delete('/:id/attachments/:filename', controller.removeAttachment);

export default router;
