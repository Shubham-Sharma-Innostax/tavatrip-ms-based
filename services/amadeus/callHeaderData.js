const axios = require('axios')
const { tavaLogger } = require('../../helpers')

async function callHeaderData(
	corelationId,
	CallAmadeusHeaderDataRESTAPIEndpoint,
	templateType
) {
	let headerResponse
	try {
		const cacheKey = 'undefined'
		const cacheExpireTime = NaN
		const isCacheRequired = undefined
		tavaLogger(
			corelationId,
			'Request',
			`${CallAmadeusHeaderDataRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-header-data?`,
			templateType
		)
		const fetchData = async () =>
			await axios
				.get(
					`${CallAmadeusHeaderDataRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-header-data?`,
					{
						headers: {
							'x-request-id': `${CallAmadeusHeaderDataRESTAPIEndpoint.headers['x-request-id']}`,
						},
					}
				)
				.then(async (res) => {
					tavaLogger(
						corelationId,
						'Response',
						`${CallAmadeusHeaderDataRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-header-data?`,
						res,
						templateType
					)
					return res.data
				})
		headerResponse = isCacheRequired
			? await fetchOrStoreDataInCache(fetchData, cacheKey, cacheExpireTime)
			: await fetchData()
	} catch (error) {
		console.log(
			'Error occurred in :  `${CallAmadeusHeaderDataRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-header-data?`',
			error
		)
		if (error.response) {
			const { status, data } = error?.response
			tavaLogger(
				corelationId,
				'Error',
				`${CallAmadeusHeaderDataRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-header-data?`,
				error,
				templateType
			)
		}
		throw error
	}
	return headerResponse
}

module.exports = { callHeaderData }
