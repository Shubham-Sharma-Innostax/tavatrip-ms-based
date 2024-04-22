const { tavaLogger } = require('../../../helpers')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient

const getpromocodes = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']

	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const getPromocodes =
			await prisma.$queryRaw`SELECT * FROM function_3c44637a_ebdc_4c96_a07b_98aaa37d396b ();`
		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: { output: getPromocodes } },
			templateType
		)
		res.json({ output: getPromocodes })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

const updatepromocode = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']

	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const updatePromocodesResponse = await prisma.promoCode.update({
			where: {
				id: params.id,
			},
			data: body,
		})

		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: updatePromocodesResponse },
			templateType
		)
		res.json({ output: updatePromocodesResponse })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}
module.exports = {
	getpromocodes,
	updatepromocode,
}
