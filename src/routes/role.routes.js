import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/roleController.js';
import auth from '../middlewares/auth.js';


const router = express.Router();

router.use(auth(['admin']));

router.get('/', controller.getAll);
router.get('/staff', controller.getStaffRoles);

router.post(
	'/',
	celebrate({
		[Segments.BODY]: Joi.object({
			slug: Joi.string()
				.pattern(/^[a-z][a-z0-9_]*$/)
				.max(50)
				.required(),
			label: Joi.string().max(100).required(),
		}),
	}),
	controller.create,
);

router.put(
	'/:slug',
	celebrate({
		[Segments.PARAMS]: Joi.object({
			slug: Joi.string().required(),
		}),
		[Segments.BODY]: Joi.object({
			label: Joi.string().max(100).required(),
		}),
	}),
	controller.update,
);

router.delete(
	'/:slug',
	celebrate({
		[Segments.PARAMS]: Joi.object({
			slug: Joi.string().required(),
		}),
	}),
	controller.remove,
);

export default router;
