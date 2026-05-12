import * as inventoryService from '../services/inventory.service.js';

'use strict';


export const getStock = async (req, res, next) => {
	try {
		const stock = await inventoryService.getStock({
			storeId: req.query.storeId,
			productId: req.query.productId,
			page: req.query.page,
			limit: req.query.limit,
		});
		res.json(stock);
	} catch (err) {
		next(err);
	}
};

export const adjust = async (req, res, next) => {
	try {
		const { productId, storeId, quantityChange, unitCost, adjustmentNote } =
			req.body;
		const inv = await inventoryService.adjustStock(
			productId,
			storeId,
			quantityChange,
			req.user.id,
			{ unitCost, adjustmentNote },
		);
		res.json(inv);
	} catch (err) {
		next(err);
	}
};

export const transfer = async (req, res, next) => {
	try {
		const { fromStoreId, toStoreId, items } = req.body;
		const transfer = await inventoryService.transferStock(
			fromStoreId,
			toStoreId,
			items,
			req.user.id,
		);
		res.status(201).json(transfer);
	} catch (err) {
		next(err);
	}
};

export const getTransfers = async (req, res, next) => {
	try {
		const storeId = req.query.storeId || undefined;
		const page = req.query.page ? parseInt(req.query.page, 10) : 1;
		const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
		const result = await inventoryService.listTransfers({ storeId, page, limit });
		res.json(result);
	} catch (err) {
		next(err);
	}
};

export const lock = async (req, res, next) => {
	try {
		const { storeId, items, sessionId, ttlMinutes } = req.body;
		const locks = await inventoryService.lockStock(
			storeId,
			items,
			sessionId,
			ttlMinutes,
		);
		res.status(201).json(locks);
	} catch (err) {
		next(err);
	}
};

export const release = async (req, res, next) => {
	try {
		const { sessionId } = req.body;
		const result = await inventoryService.releaseStock(sessionId);
		res.json({ released: result.length });
	} catch (err) {
		next(err);
	}
};

export const receive = async (req, res, next) => {
	try {
		const result = await inventoryService.receiveStock(
			req.body.storeId,
			req.body.productId,
			req.body.quantity,
			req.user?.id,
		);
		res.status(201).json(result);
	} catch (err) {
		next(err);
	}
};
