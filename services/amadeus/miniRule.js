const axios = require('axios')
const { xml2js } = require('xml-js')
const { tavaLogger } = require('../../helpers')

const callMiniRuleAPI = async (
	corelationId,
	requestData,
	templateType,
	url,
	resData
) => {
	const xmlToJson = (data = '') =>
		xml2js(data, {
			compact: true,
			textKey: '_text',
			cdataKey: '_text',
		})

	let miniRuleAPIResponse
	let responseType = 'json'
	tavaLogger(
		corelationId,
		'Request',
		url,
		requestData.input,
		templateType
	)
	try {
		miniRuleAPIResponse = await axios(
			`${requestData.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
			{
				method: 'post',
				headers: {
					SOAPAction: `http://webservices.amadeus.com/TMRXRQ_23_1_1A`,
				},
				data: requestData.input,
			}
		).then(async (res) => {
			tavaLogger(corelationId, 'Response', url, res, templateType)
			return responseType === 'json'
				? xmlToJson(res.data)
				: {
						data: res.data,
						responseType: responseType,
				  }
		})
	} catch (error) {
		if (error.response) {
			const { status, data } = error?.response
			tavaLogger(corelationId, 'Error', url, error, templateType)
			throw resData.status(status).json(xmlToJson(data))
		}
		throw error
	}

	return miniRuleAPIResponse
}

module.exports = { callMiniRuleAPI }
