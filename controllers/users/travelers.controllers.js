const { tavaLogger } = require('../../helpers')
const prismaClient = require('../../prismaClient')
const { prisma } = prismaClient
const RabbitMQClient = require('../../rabbitmq/client')
const { idpAuthentication } = require('../../services/tbo/idpAuthentication')

const deletetraveler = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const authentication = idpAuthentication(req, 'authorize')

		if (authentication.response.error) throw authentication.response.error

		const travellerDelateResponse = await prisma.travelers.delete({
			where: {
				id: params.id,
			},
		})

		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: travellerDelateResponse },
			templateType
		)
		return res.json({ output: travellerDelateResponse })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

const updatetraveler = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const travellerUpdateResponse = await prisma.travelers.update({
			where: {
				id: params.id,
			},
			data: body,
		})

		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: travellerUpdateResponse },
			templateType
		)
		return res.json({ output: travellerUpdateResponse })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

module.exports = {
	deletetraveler,
	updatetraveler,
}
