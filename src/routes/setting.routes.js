import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/settingController.js';
import auth from '../middlewares/auth.js';


const router = express.Router();

// Any authenticated user can read (e.g. POS needs it for cart tax display)
router.get('/tax-rate', auth(), controller.getTaxRate);

// Only admin can update
router.put(
	'/tax-rate',
	auth(['admin']),
	celebrate({
		[Segments.BODY]: Joi.object({
			taxRate: Joi.number().min(0).required(),
		}),
	}),
	controller.updateTaxRate,
);

router.get('/company-details', auth(), controller.getCompanyDetails);

router.put(
	'/company-details',
	auth(['admin']),
	celebrate({
		[Segments.BODY]: Joi.object({
			companyName: Joi.string().trim().min(1).max(200).required(),
			registrationNumber: Joi.string().trim().min(1).max(100).required(),
			taxVatId: Joi.string().trim().min(1).max(100).required(),
			supportEmail: Joi.string().trim().email().max(320).required(),
		}),
	}),
	controller.updateCompanyDetails,
);

export default router;
