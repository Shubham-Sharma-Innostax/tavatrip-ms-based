const { tavaLogger } = require('../../../helpers')
const {
	fetchOrStoreDataInCache,
} = require('../../../helpers/fetchAndUpdateCacheData')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const RabbitMQClient = require('../../../rabbitmq/client')
const axios = require('axios')
const _ = require('lodash')

const refund = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const queueRequest = {
			service: 'authorize',
			authTable: 'Users',
			externalDBUrl: process.env.DATABASE_URL,
			headers,
			body,
		}

		const queueResponse = await RabbitMQClient.produce({
			data: queueRequest,
			queueName: process.env.RABBITMQ_IDP_QUEUE,
		})
		if (queueResponse.response.error) throw queueResponse.response.error

		const getUser = await prisma.users.findUnique({
			where: {
				id: queueResponse.decodedUserInfo.id,
			},
		})

		if (getUser.input.role === 'ADMIN' || getUser.input.role === 'SUPERMAN') {
			const getPayment = `https://api.razorpay.com/v1/payments/${params.paymentId}?`

			const getPaymentResponse = await axios
				.get(getPayment, {
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
						getPayment,
						res,
						templateType
					)
					return res.data
				})

			const updateRequestBody = {
				amount: parseInt(getPaymentResponse.refundAmount),
			}

			let refundResponse
			try {
				const refundURL = `https://api.razorpay.com/v1/payments/${params.paymentId}/refund?`

				tavaLogger(
					corelationId,
					'Request',
					refundURL,
					updateRequestBody,
					templateType
				)
				refundResponse = await axios
					.post(refundURL, updateRequestBody, {
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
							refundURL,
							res,
							templateType
						)
						return res.data
					})
			} catch (error) {
				if (error.response) {
					const { status, data } = error?.response
					tavaLogger(
						corelationId,
						'Error',
						refundURL,
						res,
						templateType
					)
					throw res.status(status).json(data)
				}
				throw error
			}
			let bookingData
			if (body.division === 'FLIGHT') {
				bookingData = await prisma.booking.findUnique({
					where: {
						id: body.bookingId,
					},
				})
			} else if (body.division === 'HOTEL') {
				bookingData = await prisma.hotelBooking.findUnique({
					where: {
						id: body.bookingId,
					},
				})
			}

			const getPaymentSessionData = await prisma.paymentSession.findUnique({
				where: {
					id: bookingData.paymentSessionId,
				},
			})
			const updatedRefundAmount =
				Number(getPaymentSessionData.refundAmount) +
				Number(refundResponse.amount)

			const refundDetails = {
				responseArr: JSON.stringify(refundResponse),
				refundResponse,
				bookingData: getFlightBookings,
				moduleType: getPaymentSessionData.division,
				totalRefundedAmount: updatedRefundAmount,
			}

			if (
				refundResponse.entity === 'refund' &&
				refundResponse.status === 'processed'
			) {
				const updatePaymentSession = await prisma.paymentSession.update({
					where: {
						paymentId: params.paymentId,
					},
					data: {
						refundresjson: JSON.stringify(refundResponse),
						refundAmount: refundDetails.totalRefundedAmount,
					},
				})
				if (body.division === 'FLIGHT') {
					const updateBookingData = await prisma.booking.update({
						where: {
							id: body.bookingId,
						},
						data: {
							paymentStatus: 'REFUND',
						},
					})
				} else if (body.division === 'HOTEL') {
					const updateBookingData = await prisma.hotelBooking.update({
						where: {
							id: body.bookingId,
						},
						data: {
							paymentStatus: 'REFUND',
						},
					})
				}
				return res.send().json(refundResponse)
			}
		} else {
			const error = new Error()
			error.status = 403
			error.message =
				'You are not authorized to perform this action, contact system admin'
			throw error
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}
module.exports = {
	refund,
}
