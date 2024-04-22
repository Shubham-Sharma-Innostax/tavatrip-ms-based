const { tavaLogger } = require('../../../helpers')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')

const callPaymentCallback = async (corelationId, request, templateType) => {
	const { body, url, params, method, headers } = request
	try {
		if (params.query.paymentGateway == 'RAZORPAY') {
			const RAZPRPAY_API_BASE_URL = 'https://api.razorpay.com/v1'
			let razorpayResponse
			try {
				tavaLogger(
					corelationId,
					'Request',
					`${RAZPRPAY_API_BASE_URL}/payments/$${params.query.paymentId}`,
					templateType
				)
				razorpayResponse = await axios
					.get(`${RAZPRPAY_API_BASE_URL}/payments/$${params.query.paymentId}`, {
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
							`${RAZPRPAY_API_BASE_URL}/payments/$${params.query.paymentId}`,
							res,
							templateType
						)
						return res.data
					})
			} catch (error) {
				console.log(
					`Error occurred in: ${RAZPRPAY_API_BASE_URL}/payments/${params.query.paymentId}`,
					error
				)
				if (error.response) {
					const { status, data } = error?.response
					tavaLogger(
						corelationId,
						'Error',
						`${RAZPRPAY_API_BASE_URL}/payments/$${params.query.paymentId}`,
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
			const updatePaymentSession = await prisma.paymentSession.update({
				where: {
					id: params.query.paymentSessionId,
				},
				data: {
					session_status: razorpayResponse.status.toUpperCase(),
					paymentId: razorpayResponse.id,
					paymentMethod: razorpayResponse.method,
				},
			})
			razorpayResponse.status = razorpayResponse.status.toUpperCase()
			return { output: razorpayResponse }
		} else if (params.query.paymentGateway == 'CARD') {
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return error
	}
}

module.exports = { callPaymentCallback }
