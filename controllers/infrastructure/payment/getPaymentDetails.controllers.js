const { tavaLogger } = require('../../../helpers')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')

const getPaymentDetails = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, query, headers } = req
	let corelationId = headers['x-request-id']

	try {
		const RAZPRPAY_API_BASE_URL = 'https://api.razorpay.com/v1'
		let razorpayResponse
		try {
			tavaLogger(
				corelationId,
				'Request',
				`${RAZPRPAY_API_BASE_URL}/orders/${query.oderId}/payments`,
				templateType
			)
			razorpayResponse = await axios
				.get(`${RAZPRPAY_API_BASE_URL}/orders/${query.oderId}/payments`, {
					headers: {
						Authorization: `Basic ${Buffer.from(
							process.env.RAZORPAY_KEY_ID +
								':' +
								process.env.RAZORPAY_KEY_SECRET
						).toString('base64')}`,
					},
				})
				.then(async (res) => {
					tavaLogger(
						corelationId,
						'Response',
						`${RAZPRPAY_API_BASE_URL}/orders/${query.oderId}/payments}`,
						res,
						templateType
					)
					return res.data
				})
		} catch (error) {
			console.log(
				`Error occurred in: ${RAZPRPAY_API_BASE_URL}/orders/${query.oderId}/payments`,
				error
			)
			if (error.response) {
				const { status, data } = error?.response
				tavaLogger(
					corelationId,
					'Error',
					`${RAZPRPAY_API_BASE_URL}/orders/${query.oderId}/payments`,
					error,
					templateType
				)
				const finalError = new Error()
				finalError.status = status
				finalError.message = JSON.stringify(data)
				throw finalError
			}
			throw error
		}
		res.json({ paymentResponse: razorpayResponse })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		if (error?.statusCode && error?.message)
			return res.status(error.statusCode).json(error)
		const errorMessage = error?.message
		if (errorMessage && errorMessage.includes(`Message:`)) {
			if (!res.headersSent)
				return res
					.status(400)
					.json(errorMessage.split(`Message:`)[1] || errorMessage)
		}
		if (!res.headersSent) return res.status(400).json(errorMessage)
	}
}

module.exports = { getPaymentDetails }
