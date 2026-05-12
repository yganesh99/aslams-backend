import fs from 'fs';
import path from 'path';
import * as productService from '../services/product.service.js';
import { logAudit } from '../middlewares/auditLog.js';
import { UPLOAD_ROOT } from '../middlewares/upload.js';


const PRODUCT_LIST_INACTIVE_ROLES = [
	'admin',
	'store_manager',
	'inventory_manager',
];

export const create = async (req, res, next) => {
	try {
		const product = await productService.create({
			...req.body,
		});
		logAudit({
			userId: req.user.id,
			action: 'create',
			entity: 'Product',
			entityId: product._id,
			changes: req.body,
		});
		res.status(201).json(product);
	} catch (err) {
		next(err);
	}
};

export const getAll = async (req, res, next) => {
	try {
		const wantsInactive = req.query.includeInactive === 'true';
		const canIncludeInactive =
			req.user &&
			PRODUCT_LIST_INACTIVE_ROLES.includes(req.user.role);
		const result = await productService.getAll({
			...req.query,
			includeInactive: wantsInactive && canIncludeInactive,
			includeAggregatedStock: !!req.user,
		});
		res.json(result);
	} catch (err) {
		next(err);
	}
};

export const getById = async (req, res, next) => {
	try {
		const product = await productService.getById(req.params.id);
		if (!product) return res.status(404).json({ message: 'Not found' });
		res.json(product);
	} catch (err) {
		next(err);
	}
};

export const update = async (req, res, next) => {
	try {
		const product = await productService.update(req.params.id, req.body);
		if (!product) return res.status(404).json({ message: 'Not found' });
		logAudit({
			userId: req.user.id,
			action: 'update',
			entity: 'Product',
			entityId: product._id,
			changes: req.body,
		});
		res.json(product);
	} catch (err) {
		next(err);
	}
};

export const toggleActive = async (req, res, next) => {
	try {
		const product = await productService.toggleActive(req.params.id);
		if (!product) return res.status(404).json({ message: 'Not found' });
		res.json(product);
	} catch (err) {
		next(err);
	}
};

export const remove = async (req, res, next) => {
	try {
		const product = await productService.remove(req.params.id);
		if (!product) return res.status(404).json({ message: 'Not found' });

		logAudit({
			userId: req.user.id,
			action: 'delete',
			entity: 'Product',
			entityId: product._id,
			changes: { deletedAt: product.deletedAt },
		});
		res.status(204).send();
	} catch (err) {
		next(err);
	}
};

export const searchForPos = async (req, res, next) => {
	try {
		const result = await productService.searchForPos(req.query);
		res.json(result);
	} catch (err) {
		next(err);
	}
};

export const uploadImage = async (req, res, next) => {
	try {
		if (!req.file) {
			return res.status(400).json({ message: 'No image file provided' });
		}

		const imageUrl = `/uploads/products/${req.file.filename}`;

		const product = await productService.getById(req.params.id);

		if (!product) {
			return res.status(404).json({ message: 'Not found' });
		}

		product.image = imageUrl;
		const existingImages = Array.isArray(product.images)
			? product.images
			: [];
		product.images = [...existingImages, imageUrl];

		await product.save();

		const plainProduct = product.toObject();

		logAudit({
			userId: req.user.id,
			action: 'update_image',
			entity: 'Product',
			entityId: product._id,
			changes: { image: imageUrl },
		});

		res.json(plainProduct);
	} catch (err) {
		next(err);
	}
};

export const removeImage = async (req, res, next) => {
	try {
		const filename = req.params.filename;
		if (
			!filename ||
			filename.includes('..') ||
			filename.includes('/') ||
			filename.includes('\\')
		) {
			return res.status(400).json({ message: 'Invalid filename' });
		}

		const urlPath = `/uploads/products/${filename}`;
		const product = await productService.getById(req.params.id);
		if (!product) return res.status(404).json({ message: 'Not found' });

		const existingImages = Array.isArray(product.images)
			? [...product.images]
			: [];
		const inList = existingImages.includes(urlPath);
		const matchesPrimary = product.image === urlPath;

		if (!inList && !matchesPrimary) {
			return res
				.status(404)
				.json({ message: 'Image not found on this product' });
		}

		product.images = existingImages.filter((p) => p !== urlPath);

		if (matchesPrimary) {
			product.image = product.images[0] || undefined;
		}
		if (!product.images.length) {
			product.image = undefined;
		}

		await product.save();

		const diskPath = path.join(UPLOAD_ROOT, 'products', filename);
		try {
			fs.unlinkSync(diskPath);
		} catch (err) {
			if (err.code !== 'ENOENT') throw err;
		}

		logAudit({
			userId: req.user.id,
			action: 'delete_image',
			entity: 'Product',
			entityId: product._id,
			changes: { removed: urlPath },
		});

		res.json(product.toObject());
	} catch (err) {
		next(err);
	}
};
