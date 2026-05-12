import * as orderService from '../services/order.service.js';
import { generateInvoice as generateInvoicePdf } from '../utils/pdfGenerator.js';
import { logAudit } from '../middlewares/auditLog.js';
import {
	assertCashierCanReadOrder,
	assertCashierOrderListQuery,
} from '../utils/orderAccess.util.js';

export const getAll = async (req, res, next) => {
	try {
		await assertCashierOrderListQuery(req);
		const result = await orderService.getAll(req.query);
		res.json(result);
	} catch (err) {
		next(err);
	}
};

export const getById = async (req, res, next) => {
	try {
		const order = await orderService.getById(req.params.id);
		if (!order) return res.status(404).json({ message: 'Not found' });
		await assertCashierCanReadOrder(req, order);
		res.json(order);
	} catch (err) {
		next(err);
	}
};

export const getHistory = async (req, res, next) => {
	try {
		const order = await orderService.getById(req.params.id);
		if (!order) return res.status(404).json({ message: 'Order not found' });
		await assertCashierCanReadOrder(req, order);
		const history = await orderService.getOrderHistory(req.params.id);
		if (!history) return res.status(404).json({ message: 'Order not found' });
		res.json(history);
	} catch (err) {
		next(err);
	}
};

export const updateStatus = async (req, res, next) => {
	try {
		const order = await orderService.updateStatus(
			req.params.id,
			req.body.status,
		);
		if (!order) return res.status(404).json({ message: 'Not found' });
		res.json(order);
	} catch (err) {
		next(err);
	}
};

export const remove = async (req, res, next) => {
	try {
		const order = await orderService.remove(req.params.id);
		if (!order) return res.status(404).json({ message: 'Not found' });

		logAudit({
			userId: req.user.id,
			action: 'delete',
			entity: 'Order',
			entityId: order._id,
			changes: { deletedAt: order.deletedAt, orderNumber: order.orderNumber },
		});
		res.status(204).send();
	} catch (err) {
		next(err);
	}
};

export const generateInvoice = async (req, res, next) => {
	try {
		const order = await orderService.getById(req.params.id);

		if (!order) {
			return res.status(404).json({ message: 'Order not found' });
		}
		await assertCashierCanReadOrder(req, order);

		// Optional: Ensure the order is in a state that enables it to have an invoice (like confirmed/shipped)
		if (order.status === 'pending' || order.status === 'cancelled') {
			return res
				.status(400)
				.json({
					message: `Cannot generate invoice for a ${order.status} order`,
				});
		}

		// Set response headers to force PDF download/inline viewing in browser
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader(
			'Content-Disposition',
			`inline; filename=invoice-${order.orderNumber}.pdf`,
		);

		// Generate and pipe the PDF
		generateInvoicePdf(order, res);

		// Note: We don't call res.json() here since the stream automatically handles closing the response
	} catch (err) {
		next(err);
	}
};
