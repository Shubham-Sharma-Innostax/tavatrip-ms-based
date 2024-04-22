const { tavaLogger } = require('../../helpers')
const axios = require('axios')
const {simulateAPICall} = require('../../gdsApiCall/simulateApiCall')

const callTBOTicketAPI = async (
	corelationId,
	ticketRequest,
	templateType,
	data
) => {
	tavaLogger(
		corelationId,
		'Request',
		`${data.secrets.TBO_BASE_URL}/Ticket?`,
		ticketRequest,
		templateType
	)

	try {
		const response = await simulateAPICall(ticketRequest, 'FLIGHT', 'ticket')
		tavaLogger(
			corelationId, 
			'Response',
			`${data.secrets.TBO_BASE_URL}/Ticket?`,
			response,
			templateType
		)
		return response
	} catch (error) {
		console.log(
			`Error occurred in : ${data.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/Ticket?`,
			error
		)
		if (error?.response || axios?.isCancel(error)) {
			tavaLogger(
				corelationId,
				'Error',
				`${data.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/Ticket?`,
				error,
				templateType
			)
		} else {
			console.log('An error occurred', error)
			tavaLogger(
				corelationId,
				'Error',
				`${data.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/Ticket?`,
				error,
				templateType
			)
		}
	}
}

module.exports = { callTBOTicketAPI }
