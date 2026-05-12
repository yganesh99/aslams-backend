import express from 'express';
import * as controller from '../controllers/orderController.js';
import auth from '../middlewares/auth.js';


const router = express.Router({ mergeParams: true });

router.use(auth(['admin', 'store_manager', 'accountant', 'cashier']));

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.get('/:id/history', controller.getHistory);
router.get('/:id/invoice', controller.generateInvoice);
router.patch(
	'/:id/status',
	auth(['admin', 'store_manager', 'accountant']),
	controller.updateStatus,
);
router.delete(
	'/:id',
	auth(['admin', 'store_manager', 'accountant']),
	controller.remove,
);

export default router;
