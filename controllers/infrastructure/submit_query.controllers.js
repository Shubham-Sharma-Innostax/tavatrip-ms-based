const { tavaLogger } = require('../../helpers')
const prismaClient = require('../../prismaClient')
const { prisma } = prismaClient

const submitqueries = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const createRecordSubmitQuery = await prisma.queries.create({
			data: {
				...body,
				status: 'OPEN',
			},
		})
		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: { output: createRecordSubmitQuery } },
			templateType
		)
		return res.json('successfully run')
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}
module.exports = {
	submitqueries,
}
