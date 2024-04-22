// client.js
const { connect } = require('amqplib')
const EventEmitter = require('events')
const Consumer = require('./consumer')
const Producer = require('./producer')
const serverUrl = process.env.RABBITMQ_SERVER

class RabbitMQClient {
	constructor() {
		this.isInitialized = false
		this.replyQueueName = ''
		this.eventEmitter = new EventEmitter()
		this.channel = null
		this.connection = null
	}

	static getInstance() {
		if (!this.instance) {
			this.instance = new RabbitMQClient()
		}
		return this.instance
	}

	async initialize() {
		if (this.isInitialized) {
			return
		}
		try {
			const connectionOptions = {
				timeout: 15000,
				heartbeat: 10,
			}
			this.connection = await connect(serverUrl, connectionOptions)
			this.channel = await this.connection.createChannel()
			const { queue: replyQueueName } = await this.channel.assertQueue('', {
				autoDelete: true,
			})
			this.replyQueueName = replyQueueName
			this.producer = new Producer(
				this.channel,
				replyQueueName,
				this.eventEmitter,
				this.connection,
				this.isInitialized
			)
			this.consumer = new Consumer(
				this.channel,
				replyQueueName,
				this.eventEmitter
			)
			console.log('RabbitMq initialized!')
			this.consumer.consumeMessages()
			this.isInitialized = true
			this.connection.on('error', (error) => {
				this.isInitialized = false
				console.error('RabbitMQ connection error:', error.message)
				this.initialize()
			})
			this.connection.on('close', (error) => {
				this.isInitialized = false
				console.error('RabbitMQ connection close:', error.message)
				this.initialize()
			})
		} catch (error) {
			console.error('RabbitMQ error during initialization...', error)
			return new Error({ error: { statusCode: 503, message: error.message } })
		}
	}

	async produce(data) {
		if (!this.isInitialized) await this.initialize()
		return await this.producer.produceMessages(data)
	}
}

module.exports = RabbitMQClient.getInstance()
