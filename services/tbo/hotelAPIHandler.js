const axios = require('axios');
const { tavaLogger } = require('../../helpers');
const {simulateAPICall} = require('../../gdsApiCall/simulateApiCall')

const TIMEOUT = 300000 // 5 minutes timeout

const makeRequest = async (corelationId, url, requestData, templateType, serviceType, apiType) => {
    try {
        tavaLogger(corelationId, 'Request', url, requestData, templateType);

        // const response = await axios.post(url, requestData, {
        //     headers: {},
        //     timeout: TIMEOUT, 
        // });

        const response = await simulateAPICall(requestData, serviceType, apiType)
        console.log("🚀 ~ makeRequest ~ response:", response)

        tavaLogger(corelationId, 'Response', url, response, templateType);
        return response;
    } catch (error) {
        const logMessage = `Error occurred in: ${url}`;

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

const callGetHotelInfo = async (corelationId, request, templateType) => {
    const url = `${process.env.TBO_HOTELS_BASE_URL}/GetHotelInfo`;
    return await makeRequest(corelationId, url, request, templateType, 'HOTEL', 'getHotelInfo');
};

const callGetHotelRoom = async (corelationId, request, templateType) => {
    const url = `${process.env.TBO_HOTELS_BASE_URL}/GetHotelRoom`;
    return await makeRequest(corelationId, url, request, templateType, 'HOTEL', 'getHotelRoom');
};

const callGetHotelSearch = async (corelationId, request, templateType) => {
    const url = `${process.env.TBO_HOTELS_BASE_URL}/GetHotelResult`;
    return makeRequest(corelationId, url, request, templateType, 'HOTEL', 'getHotelResult');
};

const callBlockRoom = async (corelationId, request, templateType) => {
    const url = `${process.env.TBO_HOTELS_BASE_URL}/BlockRoom`;
    return makeRequest(corelationId, url, request, templateType, 'HOTEL', 'blockRoom');
};

const callBook = async (corelationId, request, templateType) => {
    const url = `${process.env.TBO_HOTELS_BASE_URL}/Book`; 
    return makeRequest(corelationId, url, request, templateType, 'HOTEL', 'hotelBook');
};

const callGetBookingDetail = async (corelationId, request, templateType) => {
    const url = `${process.env.TBO_HOTELS_BASE_URL}/GetBookingDetail`; 
    return makeRequest(corelationId, url, request, templateType, 'HOTEL', 'hotelGetBookingDetail');
};

const callGenerateVoucher = async (corelationId, request, templateType) => {
    const url = `${process.env.TBO_HOTELS_BASE_URL}/GenerateVoucher`; 
    return makeRequest(corelationId, url, request, templateType, 'HOTEL', 'generateVoucher');
};

const callSendChangeRequest = async (corelationId, request, templateType) => {
    const url = `${process.env.TBO_HOTELS_BASE_URL}/SendChangeRequest`; 
    return makeRequest(corelationId, url, request, templateType, 'HOTEL', 'hotelSendChangeRequest');
};

const callGetChangeRequestStatus = async (corelationId, request, templateType) => {
    const url = `${process.env.TBO_HOTELS_BASE_URL}/GetChangeRequest`; 
    return makeRequest(corelationId, url, request, templateType, 'HOTEL', 'hotelGetChangeRequest'); 
};

module.exports = {
	callGetHotelInfo,
	callGetHotelRoom,
	callGetHotelSearch,
	callBlockRoom,
	callBook,
	callGetBookingDetail,
	callGenerateVoucher,
	callSendChangeRequest,
	callGetChangeRequestStatus,
}
