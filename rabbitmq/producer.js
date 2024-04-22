const { randomUUID } = require('crypto')

class Producer {
	constructor(
		channel,
		replyQueueName,
		eventEmitter,
		connection,
		isInitialized
	) {
		this.channel = channel
		this.replyQueueName = replyQueueName
		this.eventEmitter = eventEmitter
		this.connection = connection
		this.isInitialized = isInitialized
	}
	async produceMessages({ data, queueName }) {
		const uuid = randomUUID()
		try {
			this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
				replyTo: this.replyQueueName,
				correlationId: uuid,
				expiration: 10000,
			})

			return new Promise((resolve) => {
				this.eventEmitter.once(uuid, (value) => {
					const reply = JSON.parse(value.content.toString())
					resolve(reply)
				})
			})
		} catch (error) {
			this.isInitialized = false
			await this.connection.close()
			console.error(
				`Error sending message to queue "${queueName}":`,
				error.message
			)
			return new Error({ error: { statusCode: 404, message: error.message } })
		}
	}
}

module.exports = Producer
