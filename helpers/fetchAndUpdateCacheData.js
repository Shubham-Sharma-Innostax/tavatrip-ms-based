const redis = require('redis')

const fetchOrStoreDataInCache = async (fetchData, type, cacheExpireTime) => {
	let redisClient
	const currentDateTime = new Date()
	const eodDateTime = new Date(currentDateTime).setHours(23, 59, 59, 999)

	let secondsUntilEndOfDay = Math.max(
		0,
		Math.floor((eodDateTime - currentDateTime) / 1000)
	)
	cacheExpireTime = cacheExpireTime || secondsUntilEndOfDay

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
		const results = await fetchData()
		if (results.error) {
			return BadRequest(results.error)
		}
		if (results && redisClient.isReady)
			await redisClient.set(type, JSON.stringify(results), {
				EX: cacheExpireTime,
				NX: true,
			})

		return results
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

module.exports = { fetchOrStoreDataInCache }
