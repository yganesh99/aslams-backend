import dotenv from 'dotenv';

dotenv.config();

export default {
	port: process.env.PORT || 4000,
	mongoUri: process.env.MONGO_URI,
	env: process.env.NODE_ENV || 'development',
	stockLockTTLMinutes: parseInt(process.env.STOCK_LOCK_TTL_MINUTES) || 15,
};
