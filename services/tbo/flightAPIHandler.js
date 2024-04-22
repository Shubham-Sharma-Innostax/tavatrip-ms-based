const axios = require('axios')
const { tavaLogger } = require('../../helpers')
const { simulateAPICall } = require('../../gdsApiCall/simulateApiCall') 
const TIMEOUT = 300000 // 5 minutes timeout

const makeRequest = async (
	corelationId, 
	url,
	requestData, 
	templateType,
	serviceType,
	apiType
) => {
	try {
		tavaLogger(corelationId, 'Request', url, requestData, templateType)

		// const response = await axios.post(url, requestData, {
		//     headers: {},
		//     timeout: TIMEOUT,
		// });
		const response = await simulateAPICall(requestData, serviceType, apiType)

		tavaLogger(corelationId, 'Response', url, response, templateType)
		return response
	} catch (error) {
		const logMessage = `Error occurred in: ${url}`

		if (axios.isCancel(error)) {
			console.log(`${logMessage} - Request was cancelled.`)
		} else if (error.response) {
			console.log(`${logMessage} - Response status: ${error.response.status}`)
		} else {
			console.log(`${logMessage} - ${error.message}`)
		}

		tavaLogger(corelationId, 'Error', url, error, templateType)
		throw error // Rethrow the error for the caller to handle
	}
}

const callSearch = async (corelationId, request, templateType) => {
	const url = `${process.env.TBO_BASE_URL}/Search`
 
	return makeRequest(
		corelationId,
		url,
		request,
		templateType,
		'FLIGHT',
		'search'
	)
}

const callSendChangeRequest = async (corelationId, request, templateType) => {
	const url = `${process.env.TBO_BOOK_BASE_URL}/SendChangeRequest`
	return makeRequest(
		corelationId,
		url, 
		request,
		templateType,
		'FLIGHT',
		'flightSendChangeRequest'
	)
}
const callGetChangeRequestStatus = async (
	corelationId,
	request,
	templateType
) => {
	const url = `${process.env.TBO_BOOK_BASE_URL}/GetChangeRequestStatus`
	return makeRequest( 
		corelationId,
		url,
		request,
		templateType,
		'FLIGHT',
		'flightGetChangeRequest'
	)
}

const callGetCancellationCharges = async (
	corelationId,
	request,
	templateType 
) => {
	const url = `${process.env.TBO_BOOK_BASE_URL}/GetCancellationCharges`
	return makeRequest(
		corelationId,
		url,
		request,
		templateType,
		'FLIGHT',
		'flightCancellationCharges'
	)
}

const callGetCalendarFare = async (corelationId, request, templateType) => {
	const url = `${process.env.TBO_BASE_URL}/GetCalendarFare`
	return makeRequest(corelationId, url, request, templateType)
}

const callReleasePNRRequest = async (corelationId, request, templateType) => {
	const url = `${process.env.TBO_BOOK_BASE_URL}/ReleasePNRRequest`
	return makeRequest( 
		corelationId,
		url,
		request,
		templateType,
		'FLIGHT',
		'releasePnrRequest'
	)
}

const callSSR = async (corelationId, request, templateType) => {
	const url = `${process.env.TBO_BOOK_BASE_URL}/SSR`
	return makeRequest(corelationId, url, request, templateType, 'FLIGHT', 'ssr') 
}
const callTicketReissue = async (corelationId, request, templateType) => {
	const url = `${process.env.TBO_BOOK_BASE_URL}/TicketReissue`
	return makeRequest(corelationId, url, request, templateType)
}
module.exports = {
	callSearch,
	callSendChangeRequest,
	callGetChangeRequestStatus,
	callGetCancellationCharges,
	callGetCalendarFare,
	callReleasePNRRequest,
	callSSR,
	callTicketReissue,
}
