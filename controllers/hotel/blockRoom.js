const { callBlockRoom } = require('../../services/tbo/hotelAPIHandler')
const { tavaLogger } = require('../../helpers/tavaLogger')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../services/tbo/authentication')

const hotelBlockRoom = async (req, res, next) => {
	const { body, url, params, headers } = req
	const templateType = 'travel'
	const corelationId = headers['x-request-id'] || ''

	try {
		// Log the request
		tavaLogger(corelationId, 'Request', url, req, templateType)

		// Authenticate and get token
		const tboAuthRequest = await createAuthRequest(process.env, body)
		const authResponse = await callAuthRESTAPI(
			corelationId,
			{ input: tboAuthRequest, params, secrets: process.env, headers },
			templateType
		)

		// Block room request
		const blockRoomRequest = { ...body, TokenId: authResponse.TokenId }
		const blockRoomResponse = await callBlockRoom(
			corelationId,
			blockRoomRequest,
			templateType
		)

		// Log the response
		tavaLogger(
			corelationId,
			'Response',
			url,
			{
				status: 200,
				data: {
					PriceAndCancellationPolicyDetails: {
						PriceAndCancellationPolicyDetail: blockRoomResponse,
					},
				},
			},
			templateType
		)

		// Send the response
		return res.json({
			PriceAndCancellationPolicyDetails: {
				PriceAndCancellationPolicyDetail: blockRoomResponse,
			},
		})
	} catch (error) {
		// Log and handle errors
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}

module.exports = {
	hotelBlockRoom,
}
