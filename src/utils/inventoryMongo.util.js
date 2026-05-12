'use strict';

/**
 * MongoDB filter for: (quantity - reservedQuantity) >= minAvailable
 * Use with productId + storeId for atomic findOneAndUpdate / updateOne.
 */
function availableAtLeast(minAvailable) {
	return {
		$expr: {
			$gte: [
				{
					$subtract: [
						'$quantity',
						{ $ifNull: ['$reservedQuantity', 0] },
					],
				},
				minAvailable,
			],
		},
	};
}

export { availableAtLeast };
