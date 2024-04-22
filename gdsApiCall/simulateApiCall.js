const { consumeMessage } = require('./RMQ_consumer');
const { publishMessage } = require('./RMQ_publisher');


const callRESTAPI = async (requestBody, serviceType, apiType) => {
    let apiRes;
    try {
        await publishMessage(requestBody, serviceType, apiType);
        apiRes = await consumeMessage();
    } catch (error) {
        console.log(`Error occurred in: SERVICE --> ${serviceType} ; API TYPE : ${apiType} API call?`, error);
        throw error;
    }
    //console.log(`${serviceType} API call RESPONSE :: `, apiRes);
    return apiRes;
};

async function simulateAPICall(requestBody, serviceType, apiType) {
    try {
        const response = await callRESTAPI(requestBody, serviceType, apiType);
        //console.log('Received response:', response);
        return response
    } catch (error) {
        console.error('Error:', error);
    }
}

module.exports = { simulateAPICall };
