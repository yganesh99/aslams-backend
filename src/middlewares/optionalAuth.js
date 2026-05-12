import { fromNodeHeaders } from 'better-auth/node';
import { getBetterAuth } from '../betterAuth.js';

/**
 * If a valid Better Auth session cookie is present, sets `req.user`.
 * If no session, continues without `req.user` (public request).
 */
export default async function optionalAuth(req, _res, next) {
	try {
		const auth = getBetterAuth();
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(req.headers),
		});

		if (session) {
			req.user = {
				id: session.user.id,
				role: session.user.role || null,
			};
		}
	} catch {
		// Silently continue as unauthenticated
	}
	next();
}
