const {
	callGetHotelInfo,
	callGetHotelRoom,
} = require('../../services/tbo/hotelAPIHandler')
const { tavaLogger } = require('../../helpers/tavaLogger')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../services/tbo/authentication')

const hotelPrice = async (req, res, next) => {
	const { body, url, headers } = req
	const templateType = 'travel'
	const corelationId = headers['x-request-id'] || ''

	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		// Authenticate
		const authRequest = { input: body, secrets: process.env, headers }
		const tboAuthRequest = await createAuthRequest(
			authRequest.secrets,
			authRequest.input
		)
		const CallAuthRESTAPIEndpoint = {
			input: tboAuthRequest,
			secrets: process.env,
			headers,
		}
		const authResponse = await callAuthRESTAPI(
			corelationId,
			CallAuthRESTAPIEndpoint,
			templateType
		)

		// Prepare requests for hotel info and room
		const { EndUserIp, TraceId, ResultIndex, HotelCode, CategoryId } = body
		const hotelRoomRequest = {
			TokenId: authResponse?.TokenId,
			EndUserIp,
			TraceId,
			ResultIndex,
			HotelCode,
		}
		const hotelInfoRequest = { ...hotelRoomRequest, CategoryId }

		// Get hotel info and room asynchronously
		const [getHotelInfoResponse, getHotelRoomResponse] = await Promise.all([
			callGetHotelInfo(corelationId, hotelInfoRequest, templateType),
			callGetHotelRoom(corelationId, hotelRoomRequest, templateType),
		])

		// Log response
		tavaLogger(
			corelationId,
			'Response',
			url,
			{
				status: 200,
				data: {
					HotelRoomInfo: { ...getHotelInfoResponse, ...getHotelRoomResponse },
				},
			},
			templateType
		)

		// Send combined response to client
		return res.json({
			HotelRoomInfo: { ...getHotelInfoResponse, ...getHotelRoomResponse },
		})
	} catch (error) {
		// Log and handle error
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}

module.exports = {
	hotelPrice,
}
