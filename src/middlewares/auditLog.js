import AuditLog from '../models/auditLog.model.js';


/**
 * Fire-and-forget audit logger.
 * @param {Object} params
  * @param {string} params.userId
 * @param {string} params.action - e.g. 'create', 'update', 'delete', 'adjust'
 * @param {string} params.entity - e.g. 'Product', 'Inventory', 'CreditAccount'
 * @param {string} params.entityId
 * @param {Object} params.changes - diff / details
 * @param {string} [params.ipAddress]
 */
async function logAudit({
	userId,
	action,
	entity,
	entityId,
	changes,
	ipAddress,
}) {
	try {
		await AuditLog.create({
			userId,
			action,
			entity,
			entityId,
			changes,
			ipAddress,
		});
	} catch (err) {
		// Non-blocking – log but don't fail the request
		console.error('Audit log failed:', err.message);
	}
}

export { logAudit };
