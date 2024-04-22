const { tavaLogger } = require('../../helpers')
const {
	fetchOrStoreDataInCache,
} = require('../../helpers/fetchAndUpdateCacheData')
const axios = require('axios')
const { simulateAPICall } = require('../../gdsApiCall/simulateApiCall') 
const createAuthRequest = async function (secrets, input) {
	return {
		ClientId: secrets.TBO_HOTELS_CLIENTID,
		UserName: secrets.TBO_HOTELS_USERNAME,
		Password: secrets.TBO_HOTELS_PASSWORD,
		EndUserIp: input.EndUserIp || input.endUserIp,
	}
}

const callAuthRESTAPI = async (
	corelationId,
	CallAuthRESTAPIEndpoint,
	templateType
) => {
	let authResponse

	try {
		const cacheKey = 'auth_token'
		const cacheExpireTime = 0
		const isCacheRequired = true

		const fetchData = async () => {
			const response = await simulateAPICall(
				CallAuthRESTAPIEndpoint,
				'FLIGHT',
				'authenticate' 
			)

			return response
		}

		authResponse = isCacheRequired
			? await fetchOrStoreDataInCache(fetchData, cacheKey, cacheExpireTime)
			: await fetchData()
	} catch (error) {
		console.log(
			`Error occurred in: ${process.env.TBO_AUTH_BASE_URL}/Authenticate?`,
			error
		)

		if (error.response) {
			const { status, data } = error.response
			tavaLogger(
				corelationId,
				'Error',
				`${CallAuthRESTAPIEndpoint.secrets.TBO_AUTH_BASE_URL}/Authenticate?`,
				error,
				templateType
			)

			throw { status, data }
		}

		throw error
	}

	return authResponse
}

module.exports = { createAuthRequest, callAuthRESTAPI }
