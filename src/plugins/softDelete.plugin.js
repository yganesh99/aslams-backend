/**
 * Adds `deletedAt` and excludes soft-deleted documents from queries by default.
 * Pass `{ includeDeleted: true }` in query options to include or update deleted rows.
 *
 * Does not apply to aggregate(); add `{ $match: { deletedAt: null } }` (or omit to
 * include deleted for historical joins) in pipelines as needed.
 */
function softDeletePlugin(schema) {
	schema.add({
		deletedAt: { type: Date, default: null, index: true },
	});

	const excludeDeleted = function excludeDeleted() {
		if (this.getOptions().includeDeleted) return;
		this.where({ deletedAt: null });
	};

	schema.pre('find', excludeDeleted);
	schema.pre('findOne', excludeDeleted);
	schema.pre('findOneAndUpdate', excludeDeleted);
	schema.pre('countDocuments', excludeDeleted);
	schema.pre('updateOne', excludeDeleted);
	schema.pre('updateMany', excludeDeleted);
	schema.pre('deleteOne', excludeDeleted);
	schema.pre('deleteMany', excludeDeleted);
}

export default softDeletePlugin;
