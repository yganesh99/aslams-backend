import Setting from '../models/setting.model.js';


const SYSTEM_TAX_RATE_KEY = 'systemTaxRate';
const COMPANY_DETAILS_KEY = 'companyDetails';

function normalizeCompanyDetails(raw) {
	if (!raw || typeof raw !== 'object') return { ...DEFAULT_COMPANY_DETAILS };
	return {
		companyName:
			typeof raw.companyName === 'string' && raw.companyName.trim()
				? raw.companyName.trim()
				: DEFAULT_COMPANY_DETAILS.companyName,
		registrationNumber:
			typeof raw.registrationNumber === 'string' &&
			raw.registrationNumber.trim()
				? raw.registrationNumber.trim()
				: DEFAULT_COMPANY_DETAILS.registrationNumber,
		taxVatId:
			typeof raw.taxVatId === 'string' && raw.taxVatId.trim()
				? raw.taxVatId.trim()
				: DEFAULT_COMPANY_DETAILS.taxVatId,
		supportEmail:
			typeof raw.supportEmail === 'string' && raw.supportEmail.trim()
				? raw.supportEmail.trim().toLowerCase()
				: DEFAULT_COMPANY_DETAILS.supportEmail,
	};
}

const DEFAULT_COMPANY_DETAILS = {
	companyName: 'Aslams LLC',
	registrationNumber: 'REG-109244',
	taxVatId: 'TAX-US-99112',
	supportEmail: 'support@aslams.test',
};

/**
 * Get the system-wide tax rate (percentage). Returns 0 if not set.
 */
async function getSystemTaxRate() {
	const doc = await Setting.findOne({ key: SYSTEM_TAX_RATE_KEY });
	if (!doc || doc.value == null) return 0;
	const rate = Number(doc.value);
	return Number.isFinite(rate) && rate >= 0 ? rate : 0;
}

/**
 * Set the system-wide tax rate (percentage).
 */
async function setSystemTaxRate(rate) {
	const value = Number(rate);
	if (!Number.isFinite(value) || value < 0) {
		throw Object.assign(new Error('Tax rate must be a non-negative number'), {
			status: 400,
		});
	}
	const doc = await Setting.findOneAndUpdate(
		{ key: SYSTEM_TAX_RATE_KEY },
		{ value },
		{ new: true, upsert: true, runValidators: true },
	);
	return doc.value;
}

async function getCompanyDetails() {
	const doc = await Setting.findOne({ key: COMPANY_DETAILS_KEY });
	if (!doc || doc.value == null) return { ...DEFAULT_COMPANY_DETAILS };
	return normalizeCompanyDetails(doc.value);
}

async function setCompanyDetails(payload) {
	const value = {
		companyName: String(payload.companyName).trim(),
		registrationNumber: String(payload.registrationNumber).trim(),
		taxVatId: String(payload.taxVatId).trim(),
		supportEmail: String(payload.supportEmail).trim().toLowerCase(),
	};
	await Setting.findOneAndUpdate(
		{ key: COMPANY_DETAILS_KEY },
		{ value },
		{ new: true, upsert: true, runValidators: true },
	);
	return value;
}

export {
	getSystemTaxRate,
	setSystemTaxRate,
	getCompanyDetails,
	setCompanyDetails,
};
