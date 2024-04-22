const fs = require('fs')
const axios = require('axios')
const ejs = require('ejs')
const { convert } = require('html-to-text')
const {
	callPaymentCallback,
} = require('../../infrastructure/payment/paymentCallback.controllers')
const { callTicketReissue } = require('../../../services/tbo/flightAPIHandler')
const { tavaLogger } = require('../../../helpers')
const prisma = require('../../../prismaClient').prisma
const RabbitMQClient = require('../../../rabbitmq/client')

const reissuanceCallback = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, method, headers } = req
	const corelationId = headers['x-request-id']

	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		if (!body.isRefundable) {
			const paymentCallbackResponse = await callPaymentCallback(
				corelationId,
				{ input: req, params: req, secrets: process.env, headers },
				templateType
			)

			if (paymentCallbackResponse.input.output.status !== 'CAPTURED') {
				const error = new Error('Payment not verified')
				error.statusCode = 400
				throw error
			}

			const tboAuthRequest = await createAuthRequest(process.env, body)
			const authResponse = await callAuthRESTAPI(
				corelationId,
				{
					input: tboAuthRequest,
					params: request,
					secrets: process.env,
					headers,
				},
				templateType
			)

			const reissuanceCallbackData = {
				TokenId: authResponse.TokenId,
				TraceId: body.TraceId,
				ResultIndex: body.ResultIndex,
				EndUserIp: body?.endUserIp || body?.EndUserIp,
			}

			const ticketReissuanceResponse = await callTicketReissue(
				corelationId,
				reissuanceCallbackData,
				templateType
			)

			if (ticketReissuanceResponse.Response.Error.ErrorCode === 0) {
				const updateReissuanceData = {
					providerBookingId:
						ticketReissuanceResponse.Response.FlightItinerary.BookingId,
					ticketingJSON: JSON.stringify(
						ticketReissuanceResponse.Response.FlightItinerary
					),
					paymentStatus: 'CAPTURED',
					status: 'CONFIRMED',
				}

				const updatedReissuanceResponse = await prisma.reissuance.update({
					where: { id: body.recordId },
					data: updateReissuanceData,
				})

				const emailMessageRequest = {
					from: process.env.FROM_EMAIL || 'tickets@tavatrip.com',
					to: body.userEmail,
					html: '',
				}

				const fileContent = fs.readFileSync(
					__dirname.split(`\controllers`)[0] +
						`/htmlfiles/createEmailMessage.ejs`,
					`utf8`
				)
				const htmlText = ejs.render(fileContent, {
					createEmailMessage: ticketReissuanceResponse,
				})
				let htmlContent = String(htmlText)
				if (htmlText.startsWith('&lt;'))
					htmlContent = convert(htmlContent, { wordwrap: 130 })

				const emailServer = {
					host: process.env.EMAIL_HOST,
					port: process.env.EMAIL_PORT,
					auth: {
						user: process.env.EMAIL_USERNAME,
						pass: process.env.EMAIL_PASSWORD,
					},
				}

				const queueRequest = {
					...emailMessageRequest,
					emailServer: emailServer,
					html: htmlContent,
					attachments: [],
				}

				const queueResponse = await RabbitMQClient.produce({
					data: queueRequest,
					queueName: process.env.RABBITMQ_EMAIL_QUEUE,
				})
				if (queueResponse.emailResponse.error || queueResponse.error)
					return res.json(
						queueResponse.emailResponse.error || queueResponse.error
					)

				tavaLogger(
					corelationId,
					'Response',
					url,
					{ status: 200, data: { output: ticketReissuanceResponse } },
					templateType
				)
				return res.json({ output: [] })
			} else {
				const refundRequest = {
					tavaBookingId: body.tavaBookingId,
					isCompleted: false,
					refundAmount: body.refundAmount,
					source: 'TBO',
					updatedAt: new Date(),
					createdAt: new Date(),
				}

				const created = await prisma.refundQueue.create({ data: refundRequest })

				const error = new Error(
					`Ticket reissuance error: Created refund Entry : ${created}`
				)
				error.statusCode = 400
				throw error
			}
		} else {
			const tboAuthRequest = await createAuthRequest(process.env, body)
			const authResponse = await callAuthRESTAPI(
				corelationId,
				{
					input: tboAuthRequest,
					params: request,
					secrets: process.env,
					headers,
				},
				templateType
			)

			const reissuanceCallbackData = {
				TokenId: authResponse.TokenId,
				TraceId: body.TraceId,
				ResultIndex: body.ResultIndex,
				EndUserIp: body?.endUserIp || body?.EndUserIp,
			}

			const ticketReissuanceResponse = await callTicketReissue(
				corelationId,
				reissuanceCallbackData,
				templateType
			)

			if (ticketReissuanceResponse.Response.Error.ErrorCode === 0) {
				const reissuanceRequest = {
					providerBookingId:
						ticketReissuanceResponse.Response.FlightItinerary.BookingId,
					ticketingJSON: JSON.stringify(
						ticketReissuanceResponse.Response.FlightItinerary
					),
					status: 'CONFIRMED',
				}

				await prisma.reissuance.update({
					where: { id: body.recordId },
					data: reissuanceRequest,
				})

				const refundEntryData = {
					tavaBookingId: body.tavaBookingId,
					isCompleted: false,
					refundAmount: body.refundAmount,
					source: 'TBO',
					updatedAt: new Date(),
					createdAt: new Date(),
					remarks: 'Redund Amount for reissuance',
				}

				const createRefundEntry = await prisma.refundQueue.create({
					data: refundEntryData,
				})

				const emailMessageRequest = {
					from: 'tickets@tavatrip.com',
					to: body.userEmail,
					html: '',
				}

				const fileContent = fs.readFileSync(
					__dirname.split(`\controllers`)[0] +
						`/htmlfiles/CreateEmailMessage_4e9ab0bb_0889_438a_b45c_5699b1e45641.ejs`,
					`utf8`
				)
				const htmlText = ejs.render(fileContent, {
					creteEmailRequest: createRefundEntry,
				})
				let htmlContent = String(htmlText)
				if (htmlText.startsWith('&lt;'))
					htmlContent = convert(htmlContent, { wordwrap: 130 })

				const emailServer = {
					host: process.env.EMAIL_HOST,
					port: process.env.EMAIL_PORT,
					auth: {
						user: process.env.EMAIL_USERNAME,
						pass: process.env.EMAIL_PASSWORD,
					},
				}

				const queueRequest = {
					...emailMessageRequest,
					emailServer: emailServer,
					html: htmlContent,
					attachments: [],
				}

				const queueResponse = await RabbitMQClient.produce({
					data: queueRequest,
					queueName: process.env.RABBITMQ_EMAIL_QUEUE,
				})
				if (queueResponse.emailResponse.error || queueResponse.error)
					return res.json(
						queueResponse.emailResponse.error || queueResponse.error
					)

				tavaLogger(
					corelationId,
					'Response',
					url,
					{ status: 200, data: { output: ticketReissuanceResponse } },
					templateType
				)
				return res.send({ output: ticketReissuanceResponse })
			} else {
				const error = new Error('Ticket reissuance error')
				error.statusCode = 500
				throw error
			}
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

module.exports = {
	reissuanceCallback,
}
