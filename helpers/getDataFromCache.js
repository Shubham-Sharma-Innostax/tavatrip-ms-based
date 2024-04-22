const redis = require('redis')

const getDataFromCache = async (type) => {
	let redisClient

	await (async () => {
		redisClient = redis.createClient()
		await redisClient.connect()
	})()

	try {
		const cachedData = await getCacheData(type)
		if (cachedData !== null) {
			console.log(`Return data from cache for type: ${type}`)
			return cachedData
		}
	} catch (error) {
		console.error(error)
		return null
	}

	async function getCacheData(type) {
		try {
			if (redisClient.isReady) {
				const cacheResults = await redisClient.get(type)
				if (cacheResults) return JSON.parse(cacheResults)
			}
			return null
		} catch (error) {
			console.error(error)
			return null
		}
	}
}

module.exports = { getDataFromCache }
