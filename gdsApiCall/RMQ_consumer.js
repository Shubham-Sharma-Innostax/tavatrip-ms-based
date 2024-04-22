const amqp = require('amqplib')

function consumeMessage() {
	return new Promise((resolve, reject) => {
		amqp
			.connect(
				process.env.TBO_MQ_SERVER
			)
			.then((connection) => {
				return connection.createChannel()
			})
			.then((channel) => {
				const responseQueue = process.env.RES_QUEUE_TBO
				//let responses = []
				
				channel.consume(
					responseQueue,
					(msg) => {
						let resData = JSON.parse(msg.content.toString())
						console.log(`Received response rabbitmq_consumer`, resData)
						//responses.push(resData)
						channel.close()
						resolve(resData)
					},
					{ noAck: true }
				)
			})
			.catch((error) => {
				reject(error)
			})
	})
}

module.exports = {
	consumeMessage,
}
