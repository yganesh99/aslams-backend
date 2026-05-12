import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/rolePermissionController.js';
import auth from '../middlewares/auth.js';
import { ALL_SECTION_KEYS } from '../models/rolePermission.model.js';


const router = express.Router();

router.use(auth(['admin']));

router.get('/', controller.getAll);

router.get(
	'/:role',
	celebrate({
		[Segments.PARAMS]: Joi.object({
			role: Joi.string().required(),
		}),
	}),
	controller.getByRole,
);

router.put(
	'/:role',
	celebrate({
		[Segments.PARAMS]: Joi.object({
			role: Joi.string().required(),
		}),
		[Segments.BODY]: Joi.object({
			sections: Joi.array()
				.items(Joi.string().valid(...ALL_SECTION_KEYS))
				.required(),
		}),
	}),
	controller.update,
);

export default router;
