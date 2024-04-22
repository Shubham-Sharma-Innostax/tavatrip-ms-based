const redis = require('redis')

const setDataInCache = async (data, type, cacheExpireTime) => {
	let redisClient

	await (async () => {
		redisClient = redis.createClient()
		await redisClient.connect()
	})()

	try {
		const results = data
		if (results.error) {
			return BadRequest(results.error)
		}
		if (results && redisClient.isReady)
			await redisClient.set(type, JSON.stringify(results), {
				EX: cacheExpireTime,
			})

		return results
	} catch (error) {
		console.error(error)
		return null
	}
}

module.exports = { setDataInCache }
