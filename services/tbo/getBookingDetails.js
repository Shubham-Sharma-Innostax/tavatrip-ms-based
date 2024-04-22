const axios = require('axios')
const { tavaLogger } = require('../../helpers')
const {simulateAPICall} = require('../../gdsApiCall/simulateApiCall')

const callGetBookingDetailsAPI = async (
	corelationId,
	getbookingDetailsRequest,
	templateType,
	data
) => {
	tavaLogger(
		corelationId,
		'Request',
		`${data.secrets.TBO_BASE_URL}/GetBookingDetails?`,
		getbookingDetailsRequest,
		templateType
	)

	try {
		const response = await simulateAPICall(getbookingDetailsRequest, 'FLIGHT', 'getBookingDetails')
	    tavaLogger( 
			corelationId,
			'Response',
			`${data.secrets.TBO_BASE_URL}/GetBookingDetails?`,
			response,
			templateType
		)

		return response
	} catch (error) {
		console.log(
			'Error occurred in :  `${data.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/GetBookingDetails?`',
			error
		)
		if (error?.response || axios?.isCancel(error)) {
			tavaLogger(
				corelationId,
				'Error',
				`${data.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/GetBookingDetails?`,
				error,
				templateType
			)
		} else {
			console.log('An error occurred', error)
			tavaLogger(
				corelationId,
				'Error',
				`${data.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/GetBookingDetails?`,
				error,
				templateType
			)
		}
	}
}

module.exports = { callGetBookingDetailsAPI }
