import { fromNodeHeaders } from 'better-auth/node';
import { getBetterAuth } from '../betterAuth.js';

/**
 * Auth middleware – verifies Better Auth session cookie, attaches user context,
 * and enforces role-based access control.
 * @param {string[]} requiredRoles – allowed roles (empty = any authenticated user)
 */
export default (requiredRoles = []) =>
	async (req, res, next) => {
		try {
			const auth = getBetterAuth();
			const session = await auth.api.getSession({
				headers: fromNodeHeaders(req.headers),
			});

			if (!session) {
				return res.status(401).json({ message: 'Unauthorized' });
			}

			req.user = {
				id: session.user.id,
				email: session.user.email,
				name: session.user.name,
				role: session.user.role || null,
			};

			if (
				requiredRoles.length &&
				!requiredRoles.includes(req.user.role)
			) {
				return res.status(403).json({ message: 'Forbidden' });
			}

			next();
		} catch (err) {
			console.error('Auth middleware error:', err);
			return res.status(401).json({ message: 'Invalid session' });
		}
	};
