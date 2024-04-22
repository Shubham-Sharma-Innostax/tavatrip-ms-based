const { callGetHotelSearch } = require('../../services/tbo/hotelAPIHandler')
const { tavaLogger } = require('../../helpers/tavaLogger')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../services/tbo/authentication')

const hotelsearch = async (req, res, next) => {
	const { body, url, params, headers } = req
	const templateType = 'travel'
	const corelationId = headers['x-request-id'] || ''

	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const authRequest = { input: body, params, secrets: process.env, headers }
		const tboAuthRequest = await createAuthRequest(
			authRequest.secrets,
			authRequest.input
		)
		const CallAuthRESTAPIEndpoint = {
			input: tboAuthRequest,
			params,
			secrets: process.env,
			headers,
		}
		const authResponse = await callAuthRESTAPI(
			corelationId,
			CallAuthRESTAPIEndpoint,
			templateType
		)

		const searchRequest = { ...body, TokenId: authResponse.TokenId }
		const searchResponse = await callGetHotelSearch(
			corelationId,
			searchRequest,
			templateType
		)

		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: searchResponse },
			templateType
		)

		return res.json({ output: searchResponse })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}

module.exports = {
	hotelsearch,
}
