import express from 'express';
import * as registerController from '../controllers/registerController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

router.post('/', auth(['admin']), registerController.createRegister);
router.get('/', auth(['admin', 'cashier']), registerController.getRegisters);

router.post(
	'/:id/open',
	auth(['admin', 'cashier']),
	registerController.openSession,
);
router.get(
	'/:id/sessions/current',
	auth(['admin', 'cashier']),
	registerController.getCurrentSession,
);
router.post(
	'/sessions/:sessionId/close',
	auth(['admin', 'cashier']),
	registerController.closeSession,
);

export default router;
