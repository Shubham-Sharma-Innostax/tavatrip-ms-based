const axios = require('axios')
const { tavaLogger } = require('../../../helpers')

async function flightCancel(
	corelationId,
	CallCancelRESTAPIEndpoint,
	templateType
) {
	let cancelResponse
	try {
		const cacheKey = ''
		const cacheExpireTime = 0
		const isCacheRequired = false
		tavaLogger(
			corelationId,
			'Request',
			`${CallCancelRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/cancel/${CallCancelRESTAPIEndpoint.params.query.tavaBookingId}?`,
			CallCancelRESTAPIEndpoint.input,
			templateType
		)
		const fetchData = async () =>
			await axios
				.post(
					`${CallCancelRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/cancel/${CallCancelRESTAPIEndpoint.params.query.tavaBookingId}?`,
					CallCancelRESTAPIEndpoint.input,
					{
						headers: {
							'x-request-id': `${CallCancelRESTAPIEndpoint.headers['x-request-id']}`,
						},
					}
				)
				.then(async (res) => {
					tavaLogger(
						corelationId,
						'Response',
						`${CallCancelRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/cancel/${CallCancelRESTAPIEndpoint.params.query.tavaBookingId}?`,
						res,
						templateType
					)
					return res.data
				})
		cancelResponse = isCacheRequired
			? await fetchOrStoreDataInCache(fetchData, cacheKey, cacheExpireTime)
			: await fetchData()
	} catch (error) {
		console.log(
			'Error occurred in :  `${CallCancelRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/cancel/${CallCancelRESTAPIEndpoint.params.query.tavaBookingId}?`',
			error
		)
		if (error.response) {
			const { status, data } = error?.response
			tavaLogger(
				corelationId,
				'Error',
				`${CallCancelRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/cancel/${CallCancelRESTAPIEndpoint.params.query.tavaBookingId}?`,
				error,
				templateType
			)
		}
		throw error
	}

	return cancelResponse
}

module.exports = { flightCancel }
