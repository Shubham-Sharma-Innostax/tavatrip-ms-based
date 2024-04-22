const axios = require('axios')
const { tavaLogger } = require('../../helpers')

async function callSignout(
	corelationId,
	CallSignoutSoapAPIEndpoint,
	signoutRequest,
	templateType
) {
	let signoutResponse
	try {
		const cacheKey = ''
		const cacheExpireTime = 0
		const isCacheRequired = false
		tavaLogger(
			corelationId,
			'Request',
			`${CallSignoutSoapAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-signout?`,
			signoutRequest,
			templateType
		)
		const callAmadeusSignoutAPI = async () =>
			await axios
				.post(
					`${CallSignoutSoapAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-signout?`,
					signoutRequest,
					{
						headers: {
							'x-request-id': `${CallSignoutSoapAPIEndpoint.headers['x-request-id']}`,
						},
					}
				)
				.then(async (res) => {
					tavaLogger(
						corelationId,
						'Response',
						`${CallSignoutSoapAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-signout?`,
						res,
						templateType
					)
					return res.data
				})
		signoutResponse = isCacheRequired
			? await fetchOrStoreDataInCache(
					callAmadeusSignoutAPI,
					cacheKey,
					cacheExpireTime
			  )
			: await callAmadeusSignoutAPI()
	} catch (error) {
		console.log(
			'Error occurred in :  `${CallSignoutSoapAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-signout?`',
			error
		)
		if (error.response) {
			const { status, data } = error?.response
			tavaLogger(
				corelationId,
				'Error',
				`${CallSignoutSoapAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-signout?`,
				error,
				templateType
			)
		}
		throw error
	}
	return signoutResponse
}

module.exports = { callSignout }
