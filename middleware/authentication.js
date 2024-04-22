const RABBITMQ_IDP_QUEUE = process.env.RABBITMQ_IDP_QUEUE
const RabbitMQClient = require('../rabbitmq/client')

const authentication = async (req, res, next) => {
	const data = {
		service: 'authorize',
		authTable: 'Users',
		externalDBUrl: process.env.DATABASE_URL,
		headers: req.headers,
		body: req.body,
	}

	const isAuthenticate = await RabbitMQClient.produce({
		data,
		queueName: RABBITMQ_IDP_QUEUE,
	})
	if (isAuthenticate.response.error)
		return res.json(isAuthenticate.response.error)
	else next()
}

module.exports = authentication
