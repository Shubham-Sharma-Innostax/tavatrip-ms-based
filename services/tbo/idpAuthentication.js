const RabbitMQClient = require('../../rabbitmq/client')

const idpAuthentication = async (request, service) => {
	const IdPAuthentication = {
		service,
		authTable: 'Users',
		externalDBUrl: process.env.DATABASE_URL,
		headers: request.headers,
		body: request.body,
	}

	const idp_queue = process.env.RABBITMQ_IDP_QUEUE
	const output = await RabbitMQClient.produce({
		data: IdPAuthentication,
		queueName: idp_queue,
	})

	return output
}

module.exports = { idpAuthentication }
