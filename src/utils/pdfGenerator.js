import PDFDocument from 'pdfkit';


function formatPaymentMethodLabel(method) {
	if (method == null || method === '') return '—';
	const m = String(method).toLowerCase();
	if (m === 'qr') return 'QR';
	return m.charAt(0).toUpperCase() + m.slice(1);
}

/** Advance y; add a page if we are too low on the current page. */
function advanceY(doc, y, step = 14) {
	const next = y + step;
	if (next > 700) {
		doc.addPage();
		return 40 + step;
	}
	return next;
}

function generateInvoice(order, res) {
	const doc = new PDFDocument({ size: 'A4', margin: 40 });
	doc.pipe(res);

	const formatCurrency = (amount) => `Rs ${amount.toFixed(2)}`;
	const formatDateTime = (dateInput) => {
		const date = new Date(dateInput);
		if (Number.isNaN(date.getTime())) return '—';
		return date.toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const createdByName = (() => {
		const cb = order.createdBy;
		if (!cb) return '—';
		if (typeof cb === 'object' && cb.name) return cb.name;
		return '—';
	})();

	let y = generateHeader(doc, order);
	y = generateCustomerInformation(
		doc,
		order,
		formatDateTime,
		createdByName,
		y,
	);
	y = generateInvoiceTable(doc, order, formatCurrency, y);
	generateFooter(doc, y, order);

	doc.end();
}

function generateHeader(doc, order) {
	let y = 40;

	// Brand Title
	doc.font('Helvetica-Bold')
		.fontSize(22)
		.fillColor('#000000')
		.text('Aslams', 40, y);

	y += 28;

	// Brand Address
	doc.font('Helvetica').fontSize(9);
	doc.text('No 10, Hill Street, Dehiwala', 40, y);
	y += 12;
	doc.text('+94 112 123 456  |  aslams@gmail.com', 40, y);
	y += 8;

	// Invoice / Quote Number (right aligned)
	const isQuote = !!order.isQuote;

	if (!isQuote) {
		doc.font('Helvetica-Bold')
			.fontSize(14)
			.fillColor('#808080')
			.text('Invoice: ', 350, 40, {
				continued: true,
			})
			.fillColor('#000000')
			.text(order.orderNumber);
	}

	return y;
}

function generateCustomerInformation(
	doc,
	order,
	formatDateTime,
	createdByName,
	startY,
) {
	const customer = order.customerId || {};
	const issued = order.createdAt
		? formatDateTime(order.createdAt)
		: formatDateTime(Date.now());

	let y = startY + 12;

	// Horizontal separator
	doc.moveTo(40, y)
		.lineTo(555, y)
		.strokeColor('#DDDDDD')
		.lineWidth(0.5)
		.stroke();
	y += 10;

	// Left column: date & time
	doc.font('Helvetica-Bold')
		.fontSize(9)
		.fillColor('#808080')
		.text('Date & time:', 40, y);
	doc.font('Helvetica')
		.fontSize(9)
		.fillColor('#000000')
		.text(issued, 105, y, { width: 220 });

	// Right column: Customer
	doc.font('Helvetica-Bold')
		.fontSize(9)
		.fillColor('#808080')
		.text('Customer:', 350, y);
	doc.font('Helvetica')
		.fontSize(9)
		.fillColor('#000000')
		.text(customer.name || 'Walk-in Customer', 405, y);

	y += 14;

	// Created by
	doc.font('Helvetica-Bold')
		.fontSize(9)
		.fillColor('#808080')
		.text('Created by:', 40, y);
	doc.font('Helvetica')
		.fontSize(9)
		.fillColor('#000000')
		.text(createdByName, 105, y);

	if (customer.phone) {
		doc.font('Helvetica').fontSize(9).text(customer.phone, 405, y);
	}

	y += 14;

	// Payment Method
	const paymentLabel =
		order.paymentMethod === 'split'
			? 'Split payment'
			: formatPaymentMethodLabel(order.paymentMethod || 'cash');
	doc.font('Helvetica-Bold')
		.fontSize(9)
		.fillColor('#808080')
		.text('Payment:', 40, y);
	doc.font('Helvetica')
		.fontSize(9)
		.fillColor('#000000')
		.text(paymentLabel, 100, y);

	y += 14;

	if (customer.email) {
		doc.font('Helvetica').fontSize(9).text(customer.email, 405, y);
		y += 12;
	}

	return y;
}

function generateInvoiceTable(doc, order, formatCurrency, startY) {
	let y = startY + 8;

	// Table Header Background
	doc.rect(40, y, 515, 22).fill('#EEEEEE');

	// Table Header Text
	doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
	generateTableRow(doc, y + 6, 'Description', 'Qty', 'Rate', 'Total');

	y += 30;
	doc.font('Helvetica').fontSize(9);

	const formatQty = (qty) =>
		Number.isInteger(Number(qty)) ? String(qty) : Number(qty).toFixed(2);
	const qtyWithUnit = (item) =>
		`${formatQty(item.quantity)} ${item.unit || 'pcs'}`;

	// Table Items — line total shown without tax; tax is added in summary below
	for (let i = 0; i < order.items.length; i++) {
		const item = order.items[i];
		const lineTotalExclTax = item.unitPrice * item.quantity;

		const descHeight = doc.heightOfString(`${item.name} - ${item.sku}`, {
			width: 200,
		});
		const rowHeight = Math.max(descHeight, 14);

		generateTableRow(
			doc,
			y,
			`${item.name}\n${item.sku}`,
			qtyWithUnit(item),
			formatCurrency(item.unitPrice),
			formatCurrency(lineTotalExclTax),
		);

		// Dotted separator
		doc.lineWidth(0.5)
			.dash(2, { space: 2 })
			.moveTo(40, y + rowHeight + 4)
			.lineTo(555, y + rowHeight + 4)
			.strokeColor('#CCCCCC')
			.stroke()
			.undash();

		y += rowHeight + 10;

		// Page break for very long orders
		if (y > 700) {
			doc.addPage();
			y = 40;
		}
	}

	// Summary Section — Subtotal, then Discount, then Tax
	const summaryY = y + 12;
	let nextY = summaryY;

	doc.font('Helvetica-Bold').fontSize(9);
	doc.text('Subtotal', 350, nextY);
	doc.font('Helvetica').fontSize(9);
	doc.text(formatCurrency(order.subtotal), 450, nextY, {
		width: 90,
		align: 'right',
	});
	nextY += 16;

	if (order.discountAmount > 0) {
		doc.font('Helvetica-Bold').fontSize(9);
		doc.text('Discount', 350, nextY);
		doc.font('Helvetica').fontSize(9);
		doc.text('-' + formatCurrency(order.discountAmount), 450, nextY, {
			width: 90,
			align: 'right',
		});
		nextY += 16;
	}

	doc.font('Helvetica-Bold').fontSize(9);
	const taxLabel =
		order.orderTaxRate != null && order.orderTaxRate > 0
			? `Tax (${order.orderTaxRate}% at order time)`
			: 'Tax';
	doc.text(taxLabel, 350, nextY);
	doc.font('Helvetica').fontSize(9);
	doc.text(formatCurrency(order.taxAmount || 0), 450, nextY, {
		width: 90,
		align: 'right',
	});
	nextY += 16;

	if (Number(order.shippingCost) > 0) {
		doc.font('Helvetica-Bold').fontSize(9);
		doc.text('Shipping', 350, nextY);
		doc.font('Helvetica').fontSize(9);
		doc.text(formatCurrency(order.shippingCost), 450, nextY, {
			width: 90,
			align: 'right',
		});
		nextY += 16;
	}

	if (order.creditUsed > 0) {
		doc.font('Helvetica-Bold').fontSize(9);
		doc.text('Credit Used', 350, nextY);
		doc.font('Helvetica').fontSize(9);
		doc.text('-' + formatCurrency(order.creditUsed), 450, nextY, {
			width: 90,
			align: 'right',
		});
		nextY += 16;
	}

	// Separator before total
	doc.moveTo(350, nextY)
		.lineTo(555, nextY)
		.strokeColor('#000000')
		.lineWidth(0.5)
		.stroke();

	doc.font('Helvetica-Bold').fontSize(12);
	doc.text('Total', 350, nextY + 6);
	doc.text(formatCurrency(order.totalAmount), 430, nextY + 6, {
		width: 110,
		align: 'right',
	});

	let contentEndY = nextY + 26;

	if (
		order.paymentMethod === 'split' &&
		Array.isArray(order.payments) &&
		order.payments.length > 0
	) {
		contentEndY = advanceY(doc, contentEndY, 6);
		doc.font('Helvetica-Bold').fontSize(9).fillColor('#808080');
		doc.text('Split payment details', 350, contentEndY);
		contentEndY = advanceY(doc, contentEndY, 12);

		doc.font('Helvetica').fontSize(9).fillColor('#000000');
		for (let i = 0; i < order.payments.length; i++) {
			const p = order.payments[i];
			const methodLabel = formatPaymentMethodLabel(p.method);
			const ref =
				p.reference && String(p.reference).trim()
					? `  •  Ref: ${String(p.reference).trim()}`
					: '';
			const leftText = `${i + 1}. ${methodLabel}${ref}`;
			doc.text(leftText, 350, contentEndY, { width: 200 });
			doc.text(formatCurrency(Number(p.amount) || 0), 450, contentEndY, {
				width: 90,
				align: 'right',
			});
			contentEndY = advanceY(doc, contentEndY, 14);
		}

		const splitSum = order.payments.reduce(
			(s, p) => s + (Number(p.amount) || 0),
			0,
		);
		if (Number.isFinite(splitSum) && order.totalAmount != null) {
			const delta = Math.abs(
				Math.round((splitSum - order.totalAmount) * 100) / 100,
			);
			if (delta > 0.02) {
				doc.font('Helvetica-Oblique')
					.fontSize(8)
					.fillColor('#666666');
				doc.text(
					`(Lines total ${formatCurrency(splitSum)} vs invoice ${formatCurrency(order.totalAmount)})`,
					350,
					contentEndY,
					{ width: 205 },
				);
				contentEndY = advanceY(doc, contentEndY, 12);
				doc.fillColor('#000000');
				doc.font('Helvetica').fontSize(9);
			}
		}

		contentEndY = advanceY(doc, contentEndY, 4);
	}

	if (
		order.cashTendered != null &&
		order.cashChange != null &&
		Number.isFinite(order.cashTendered) &&
		Number.isFinite(order.cashChange)
	) {
		doc.font('Helvetica').fontSize(9).fillColor('#000000');
		const tenderLabel =
			order.paymentMethod === 'split'
				? 'Cash tendered (for cash portion)'
				: 'Cash tendered';
		const changeLabel =
			order.paymentMethod === 'split' ? 'Change (cash)' : 'Change';
		doc.text(tenderLabel, 350, contentEndY);
		doc.text(formatCurrency(order.cashTendered), 450, contentEndY, {
			width: 90,
			align: 'right',
		});
		contentEndY = advanceY(doc, contentEndY, 14);
		doc.text(changeLabel, 350, contentEndY);
		doc.text(formatCurrency(order.cashChange), 450, contentEndY, {
			width: 90,
			align: 'right',
		});
		contentEndY = advanceY(doc, contentEndY, 14);
	}

	return contentEndY;
}

function generateFooter(doc, contentEndY, order) {
	// Place footer dynamically after content, but ensure it's near bottom
	const footerY = Math.max(contentEndY + 30, 720);
	const isQuote = !!order?.isQuote;

	doc.font('Helvetica').fontSize(8).fillColor('#808080');
	doc.text(
		isQuote
			? 'This is a computer-generated quotation and does not require a signature.'
			: 'This is a computer-generated invoice and does not require a signature.',
		40,
		footerY,
		{ width: 515, align: 'center' },
	);

	doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
	doc.text('Thanks for shopping with us!', 40, footerY + 18, {
		align: 'center',
		width: 515,
	});

	doc.font('Helvetica').fontSize(10).fillColor('#808080');
	doc.text('Come back for your next fabric adventure!', 40, footerY + 36, {
		align: 'center',
		width: 515,
	});
}

function generateTableRow(doc, y, description, quantity, rate, total) {
	doc.text(description, 50, y, { width: 200 });
	doc.text(quantity, 260, y, { width: 80, align: 'center' });
	doc.text(rate, 350, y, { width: 90, align: 'right' });
	doc.text(total, 450, y, { width: 90, align: 'right' });
}

function generatePOHeader(doc, po) {
	let y = 40;

	// Brand Title
	doc.font('Helvetica-Bold')
		.fontSize(22)
		.fillColor('#000000')
		.text('Aslams', 40, y);

	y += 28;

	// Brand Address
	doc.font('Helvetica').fontSize(9);
	doc.text('No 10, Hill Street, Dehiwala', 40, y);
	y += 12;
	doc.text('+94 112 123 456  |  aslams@gmail.com', 40, y);
	y += 8;

	// PO Number (right aligned)
	doc.font('Helvetica-Bold')
		.fontSize(14)
		.fillColor('#808080')
		.text('Purchase Order: ', 320, 40, {
			continued: true,
		})
		.fillColor('#000000')
		.text(po.poNumber);

	return y;
}

function generateSupplierInformation(
	doc,
	po,
	formatDateTime,
	createdByName,
	startY,
) {
	const supplier = po.supplierId || {};
	const issued = po.createdAt
		? formatDateTime(po.createdAt)
		: formatDateTime(Date.now());

	let y = startY + 12;

	// Horizontal separator
	doc.moveTo(40, y)
		.lineTo(555, y)
		.strokeColor('#DDDDDD')
		.lineWidth(0.5)
		.stroke();
	y += 10;

	// Left column: date & time
	doc.font('Helvetica-Bold')
		.fontSize(9)
		.fillColor('#808080')
		.text('Date & time:', 40, y);
	doc.font('Helvetica')
		.fontSize(9)
		.fillColor('#000000')
		.text(issued, 105, y, { width: 220 });

	// Right column: Supplier
	doc.font('Helvetica-Bold')
		.fontSize(9)
		.fillColor('#808080')
		.text('Supplier:', 350, y);
	doc.font('Helvetica')
		.fontSize(9)
		.fillColor('#000000')
		.text(supplier.name || 'Unknown Supplier', 405, y);

	y += 14;

	// Created by
	doc.font('Helvetica-Bold')
		.fontSize(9)
		.fillColor('#808080')
		.text('Created by:', 40, y);
	doc.font('Helvetica')
		.fontSize(9)
		.fillColor('#000000')
		.text(createdByName, 105, y);

	if (supplier.phone) {
		doc.font('Helvetica').fontSize(9).text(supplier.phone, 405, y);
	}

	y += 14;

	// Status
	const statusLabel = (po.status || 'draft').replace('_', ' ').toUpperCase();
	doc.font('Helvetica-Bold')
		.fontSize(9)
		.fillColor('#808080')
		.text('Status:', 40, y);
	doc.font('Helvetica')
		.fontSize(9)
		.fillColor('#000000')
		.text(statusLabel, 105, y);

	if (supplier.email) {
		doc.font('Helvetica').fontSize(9).text(supplier.email, 405, y);
		y += 12;
	}

	return y;
}

function generatePOTable(doc, po, formatCurrency, startY) {
	let y = startY + 8;

	// Table Header Background
	doc.rect(40, y, 515, 22).fill('#EEEEEE');

	// Table Header Text
	doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
	generateTableRow(doc, y + 6, 'Description', 'Qty', 'Unit Cost', 'Total');

	y += 30;
	doc.font('Helvetica').fontSize(9);

	const formatQty = (qty) =>
		Number.isInteger(Number(qty)) ? String(qty) : Number(qty).toFixed(2);

	// Table Items
	for (let i = 0; i < po.items.length; i++) {
		const item = po.items[i];
		const lineTotal = item.unitPrice * item.orderedQty;

		const descHeight = doc.heightOfString(`${item.name} - ${item.sku}`, {
			width: 200,
		});
		const rowHeight = Math.max(descHeight, 14);

		generateTableRow(
			doc,
			y,
			`${item.name}\n${item.sku}`,
			formatQty(item.orderedQty),
			formatCurrency(item.unitPrice),
			formatCurrency(lineTotal),
		);

		// Dotted separator
		doc.lineWidth(0.5)
			.dash(2, { space: 2 })
			.moveTo(40, y + rowHeight + 4)
			.lineTo(555, y + rowHeight + 4)
			.strokeColor('#CCCCCC')
			.stroke()
			.undash();

		y += rowHeight + 10;

		// Page break for very long orders
		if (y > 700) {
			doc.addPage();
			y = 40;
		}
	}

	// Summary Section
	const summaryY = y + 12;
	let nextY = summaryY;

	// Separator before total
	doc.moveTo(350, nextY)
		.lineTo(555, nextY)
		.strokeColor('#000000')
		.lineWidth(0.5)
		.stroke();

	doc.font('Helvetica-Bold').fontSize(12);
	doc.text('Total', 350, nextY + 6);
	doc.text(formatCurrency(po.totalAmount || 0), 430, nextY + 6, {
		width: 110,
		align: 'right',
	});

	let contentEndY = nextY + 26;

	if (po.notes) {
		contentEndY = advanceY(doc, contentEndY, 14);
		doc.font('Helvetica-Bold').fontSize(9).fillColor('#808080');
		doc.text('Notes:', 40, contentEndY);
		doc.font('Helvetica').fontSize(9).fillColor('#000000');
		contentEndY += 12;
		doc.text(po.notes, 40, contentEndY, { width: 515 });
		contentEndY += doc.heightOfString(po.notes, { width: 515 }) + 10;
	}

	return contentEndY;
}

function generatePOFooter(doc, contentEndY) {
	// Place footer dynamically after content, but ensure it's near bottom
	const footerY = Math.max(contentEndY + 30, 720);

	doc.font('Helvetica').fontSize(8).fillColor('#808080');
	doc.text(
		'This is a computer-generated purchase order and does not require a signature.',
		40,
		footerY,
		{ width: 515, align: 'center' },
	);
}

function generatePurchaseOrder(po, res) {
	const doc = new PDFDocument({ size: 'A4', margin: 40 });
	doc.pipe(res);

	const formatCurrency = (amount) => `Rs ${amount.toFixed(2)}`;
	const formatDateTime = (dateInput) => {
		const date = new Date(dateInput);
		if (Number.isNaN(date.getTime())) return '—';
		return date.toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const createdByName = (() => {
		const cb = po.createdBy;
		if (!cb) return '—';
		if (typeof cb === 'object' && cb.name) return cb.name;
		return '—';
	})();

	let y = generatePOHeader(doc, po);
	y = generateSupplierInformation(
		doc,
		po,
		formatDateTime,
		createdByName,
		y,
	);
	y = generatePOTable(doc, po, formatCurrency, y);
	generatePOFooter(doc, y);

	doc.end();
}

export { generateInvoice, generatePurchaseOrder };
