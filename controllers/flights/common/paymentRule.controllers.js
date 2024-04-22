const { tavaLogger } = require('../../../helpers')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient

const deletepaymentrule = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']

	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const deletePaymentRule = await prisma.payment.delete({
			where: {
				id: params.id,
			},
		})
		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: deletePaymentRule },
			templateType
		)
		return res.json({ output: finalResponse })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

module.exports = {
	deletepaymentrule,
}
