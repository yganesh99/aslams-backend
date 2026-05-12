import * as settingService from '../services/setting.service.js';


async function getTaxRate(req, res) {
	const taxRate = await settingService.getSystemTaxRate();
	return res.json({ taxRate });
}

async function updateTaxRate(req, res) {
	const taxRate = await settingService.setSystemTaxRate(req.body.taxRate);
	return res.json({ taxRate });
}

async function getCompanyDetails(req, res) {
	const companyDetails = await settingService.getCompanyDetails();
	return res.json(companyDetails);
}

async function updateCompanyDetails(req, res) {
	const companyDetails = await settingService.setCompanyDetails(req.body);
	return res.json(companyDetails);
}

export {
	getTaxRate,
	updateTaxRate,
	getCompanyDetails,
	updateCompanyDetails,
};
