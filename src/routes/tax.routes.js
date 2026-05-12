import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/taxController.js';
import auth from '../middlewares/auth.js';


const router = express.Router({ mergeParams: true });

router.use(
	auth(['admin']),
);

router.post(
	'/',
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().required(),
			rate: Joi.number().min(0).required(),
			isDefault: Joi.boolean().optional(),
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
			name: Joi.string(),
			rate: Joi.number().min(0),
			isDefault: Joi.boolean(),
			isActive: Joi.boolean(),
		}),
	}),
	controller.update,
);

export default router;
