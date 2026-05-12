import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errors } from 'celebrate';
import { UPLOAD_ROOT } from './middlewares/upload.js';
import authRoutes from './routes/auth.routes.js';
import storeRoutes from './routes/store.routes.js';
import userRoutes from './routes/user.routes.js';
import categoryRoutes from './routes/category.routes.js';
import productRoutes from './routes/product.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import customerRoutes from './routes/customer.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import creditRoutes from './routes/credit.routes.js';
import posRoutes from './routes/pos.routes.js';
import orderRoutes from './routes/order.routes.js';
import purchaseOrderRoutes from './routes/purchaseOrder.routes.js';
import supplierInvoiceRoutes from './routes/supplierInvoice.routes.js';
import taxRoutes from './routes/tax.routes.js';
import settingRoutes from './routes/setting.routes.js';
import reportingRoutes from './routes/reporting.routes.js';
import registerRoutes from './routes/register.routes.js';
import rolePermissionRoutes from './routes/rolePermission.routes.js';
import roleRoutes from './routes/role.routes.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();
// deployment-test-2
// Production: set CORS_ORIGIN to explicit origins (comma-separated). Using * with credentials: true
// allows any site to send credentialed requests and is not appropriate for deployed APIs.
const rawCorsOrigin = process.env.CORS_ORIGIN || '*';
const parsedCorsOrigin =
	rawCorsOrigin === '*'
		? true
		: rawCorsOrigin.split(',').map((origin) => origin.trim());

// Allow browsers on another origin (e.g. Next.js on :3000) to display <img src="http://api.../uploads/...">.
// Helmet's default CORP is same-origin, which blocks cross-origin embedding of static files.
app.use(
	helmet({
		crossOriginResourcePolicy: { policy: 'cross-origin' },
	}),
);
app.use(
	cors({
		origin: parsedCorsOrigin,
		credentials: true,
	}),
);
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(UPLOAD_ROOT));

const authLimiter =
	process.env.NODE_ENV === 'test'
		? (_req, _res, next) => next() // disabled in test mode
		: rateLimit({
				windowMs: 15 * 60 * 1000,
				max: 100,
			});

// ── Health ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
	res.json({ status: 'ok', uptime: process.uptime() }),
);

// ── Auth ────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);

// ── Store & Resource Routes ─────────────────────────────────────────────
app.use('/api/stores', storeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/registers', registerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/supplier-invoices', supplierInvoiceRoutes);
app.use('/api/taxes', taxRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/reports', reportingRoutes);
app.use('/api/role-permissions', rolePermissionRoutes);
app.use('/api/roles', roleRoutes);

// ── Flat routes ─────────────────────────────────────────────────
app.use('/api/inventory', inventoryRoutes);
app.use('/api/credit', creditRoutes);
app.use('/api/pos', posRoutes);

// ── Error handling ──────────────────────────────────────────────
app.use(errors());
app.use(errorHandler);

export default app;
