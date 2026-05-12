import { getDb } from '../betterAuth.js';

/**
 * @param {Iterable<string>} ids
 * @returns {Promise<Map<string, { _id: string, name?: string, email?: string }>>}
 */
export async function fetchUsersByIds(ids) {
	const unique = [...new Set([...ids].filter(Boolean).map(String))];
	if (!unique.length) return new Map();
	const rows = await getDb()
		.collection('user')
		.find({ _id: { $in: unique } })
		.project({ name: 1, email: 1 })
		.toArray();
	return new Map(rows.map((u) => [String(u._id), u]));
}

function userIdKey(value) {
	if (value == null) return null;
	if (typeof value === 'string') return value;
	if (typeof value === 'object') {
		if ('name' in value || 'email' in value) return null;
		return String(value);
	}
	return String(value);
}

/**
 * Replace string/ObjectId user id fields on lean docs with { _id, name, email }.
 * @param {object[]} docs
 * @param {string[]} fields
 */
export async function attachUsersToLeanDocs(docs, fields) {
	if (!docs?.length) return docs;
	const ids = [];
	for (const d of docs) {
		for (const f of fields) {
			const key = userIdKey(d[f]);
			if (key) ids.push(key);
		}
	}
	const map = await fetchUsersByIds(ids);
	for (const d of docs) {
		for (const f of fields) {
			const key = userIdKey(d[f]);
			if (!key) continue;
			const u = map.get(key);
			if (u) {
				d[f] = { _id: u._id, name: u.name, email: u.email };
			}
		}
	}
	return docs;
}

/**
 * @param {object | null} doc
 * @param {string[]} fields
 */
export async function attachUsersToLeanDoc(doc, fields) {
	if (!doc) return doc;
	await attachUsersToLeanDocs([doc], fields);
	return doc;
}
