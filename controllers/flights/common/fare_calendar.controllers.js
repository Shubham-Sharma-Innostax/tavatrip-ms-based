const {
	fetchOrStoreDataInCache,
} = require('../../../helpers/fetchAndUpdateCacheData')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')
const aws = require('aws-sdk')
const { callGetCalendarFare } = require('../../../services/tbo/hotelAPIHandler')
const { tavaLogger } = require('../../../helpers')

const fareCalendar = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const serviceProviderStatus = await prisma.serviceProviderStatus.findMany({
			where: {
				status: true,
			},
		})
		const amadeusStatus =
			serviceProviderStatus.find((provider) => provider.provider === 'AMADEUS')
				?.status ?? false
		const tboStatus =
			serviceProviderStatus.find((provider) => provider.provider === 'TBO')
				?.status ?? false

		if (amadeusStatus) {
			res.status(200).json({})
		} else if (tboStatus) {
			// Authenticate and get token
			const tboAuthRequest = await createAuthRequest(process.env, body)
			const authResponse = await callAuthRESTAPI(
				corelationId,
				{ input: tboAuthRequest, params, secrets: process.env, headers },
				templateType
			)

			const getFareRequest = { ...body, TokenId: authResponse.TokenId }
			const blockRoomResponse = await callGetCalendarFare(
				corelationId,
				getFareRequest,
				templateType
			)

			const response = {
				source: 'TBO',
				data: blockRoomResponse,
			}
			tavaLogger(
				corelationId,
				'Error',
				`${CallRESTAPIEndpoint_e0d9a53a_d845_4b6a_8acf_8d9d9e4b7f74.secrets.TBO_BASE_URL}/GetCalendarFare?`,
				error,
				templateType
			)
			res.send(200).json(response)
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}

module.exports = {
	fareCalendar,
}
