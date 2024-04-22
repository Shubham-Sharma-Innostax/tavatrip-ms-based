const axios = require('axios')
const { xml2js } = require('xml-js')
const { tavaLogger } = require('../../helpers')

const callMPTBSearchAPI = async (
	corelationId,
	CallMPTBSearchSOAPAPI,
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

	let searchAPIResponse
	let responseType = 'json'
	tavaLogger(
		corelationId,
		'Request',
		url,
		CallMPTBSearchSOAPAPI.input,
		templateType
	)
	try {
		searchAPIResponse = await axios(
			`${CallMPTBSearchSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
			{
				method: 'post',
				headers: {
					SOAPAction: `http://webservices.amadeus.com/FMPTBQ_23_2_1A`,
				},
				data: CallMPTBSearchSOAPAPI.input,
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

	return searchAPIResponse
}

module.exports = { callMPTBSearchAPI }
