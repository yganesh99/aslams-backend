import express from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import * as controller from '../controllers/categoryController.js';
import auth from '../middlewares/auth.js';


const router = express.Router({ mergeParams: true });
const manageCategoryAuth = auth([
	'admin',
	'store_manager',
	'inventory_manager',
]);

router.post(
	'/',
	manageCategoryAuth,
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().required(),
			description: Joi.string().allow('').optional(),
			image: Joi.string().allow('').optional(),
			isActive: Joi.boolean().optional(),
		}),
	}),
	controller.create,
);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);

router.put(
	'/:id',
	manageCategoryAuth,
	celebrate({
		[Segments.BODY]: Joi.object({
			name: Joi.string().optional(),
			description: Joi.string().allow('').optional(),
			image: Joi.string().allow('').optional(),
			isActive: Joi.boolean().optional(),
		}),
	}),
	controller.update,
);

router.patch('/:id/toggle', manageCategoryAuth, controller.toggleActive);
router.delete('/:id', manageCategoryAuth, controller.remove);

export default router;
