const { tavaLogger } = require('../../../helpers')
const fs = require('fs')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const RabbitMQClient = require('../../../rabbitmq/client')
const axios = require('axios')
const ejs = require('ejs')
const { convert } = require('html-to-text')
const qs = require('qs')

const sendotp = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const request = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const formattedRequestBody = {
			input: request.body,
			params: request,
			secrets: process.env,
			headers,
		}

		if (formattedRequestBody.input.provider === 'phone') {
			const checkResponse = async () => {
				const twilioRequestMapper = async function () {
					const returnRequest = async (input) => {
						const { phone } = input.input
						const {
							TWILIO_ACCOUNT_SID,
							TWILIO_AUTH_TOKEN,
							TWILIO_SERVICE_SID,
						} = process.env
						const data = qs.stringify({
							To: phone,
							Channel: 'sms',
						})
						const config = {
							method: 'post',
							maxBodyLength: Infinity,
							url: `https://verify.twilio.com/v2/Services/${TWILIO_SERVICE_SID}/Verifications`,
							headers: {
								'Content-Type': 'application/x-www-form-urlencoded',
								Authorization: `Basic ${Buffer.from(
									TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN
								).toString('base64')}`,
							},
							data: data,
						}
						return await axios
							.request(config)
							.then((response) => {
								if (response.data) return 'OTP sent!'
								else return 'Error while sending OTP. Please try again later.'
							})
							.catch((error) => {
								console.log({ error })
								const err = new Error()
								err.statusCode = error.code
								err.message = 'Error while sending OTP. Please try again later.'
								return err
							})
					}
					return await returnRequest(formattedRequestBody)
				}
				const twilioRequestMapperResponse = await twilioRequestMapper()
				const ReturnSuccessResponse = {
					output: twilioRequestMapperResponse,
					params: request,
					secrets: process.env,
					headers,
				}
				const updatedReturnSuccessRes = {
					...ReturnSuccessResponse,
				}

				if (updatedReturnSuccessRes?.output?.responseType === 'xml') {
					delete updatedReturnSuccessRes.headers
					return res
						.set('Content-Type', 'application/xml')
						.send(updatedReturnSuccessRes.output.data)
				}

				delete updatedReturnSuccessRes.params
				delete updatedReturnSuccessRes.secrets
				delete updatedReturnSuccessRes.headers

				if (
					Object.keys(updatedReturnSuccessRes).length ||
					finalResponse.length
				) {
					tavaLogger(
						corelationId,
						'Response',
						url,
						{
							status: 200,
							data: updatedReturnSuccessRes,
						},
						templateType
					)
					return finalResponse.length
						? { output: finalResponse }
						: updatedReturnSuccessRes
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			return res.send(resultCheck)
		}

		if (formattedRequestBody.input.provider === 'email') {
			const checkResponse = async () => {
				const userDetails =
					await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
						`SELECT * FROM "Users" WHERE "email" = '${formattedRequestBody.input.email}' OFFSET 0 ROWS FETCH NEXT '20' ROWS ONLY`
					)}`

				const returnRequestMapper = async function () {
					const returnRequest = async (input) => {
						const value = input?.[0]
						if (value) {
							return {
								code: Math.floor(100000 + Math.random() * 900000),
								email: value.email,
								timestamp: new Date().toUTCString(),
							}
						} else {
							const err = new Error()
							err.statusCode = 404
							err.message = `No user found with this email.`
							throw err
						}
					}
					return returnRequest(userDetails)
				}
				const returnRequestMapperResponse = await returnRequestMapper()

				const updatedInfo =
					await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
						`UPDATE "Users" SET "verificationCode"= '${returnRequestMapperResponse.code}',"codeTimestamp"= '${returnRequestMapperResponse.timestamp}' WHERE "email"='${returnRequestMapperResponse.email}'`
					)}`
				const createEmailMessage = {
					input: updatedInfo,
					params: request,
					secrets: process.env,
					headers,
					output: returnRequestMapperResponse,
				}

				const emailMessage = {
					from: 'developer@innostax.com',
					to: createEmailMessage.output.email,
					subject: 'Verification Code',
					html: ``,
				}
				const fileContent = fs.readFileSync(
					__dirname.split(`\controllers`)[0] +
						`/htmlfiles/createEmailMessage.ejs`,
					`utf8`
				)

				const htmlText = ejs.render(fileContent, { createEmailMessage })
				let htmlContent = String(htmlText)
				if (htmlText.startsWith('&lt;'))
					htmlContent = convert(htmlContent, { wordwrap: 130 })
				let attachments = []
				const SendEmailMessage = {
					emailMessage: emailMessage,
					params: request,
					secrets: process.env,
					headers,
				}
				const emailServer = {
					host: process.env.EMAIL_HOST,
					port: process.env.EMAIL_PORT,
					auth: {
						user: process.env.EMAIL_USERNAME,
						pass: process.env.EMAIL_PASSWORD,
					},
				}

				const messageContent = {
					...SendEmailMessage.emailMessage,
					emailServer: emailServer,
					html: htmlContent,
					attachments: [...attachments],
				}
				const queueName = process.env.RABBITMQ_EMAIL_QUEUE

				const rabitMQResponse = await RabbitMQClient.produce({
					data: messageContent,
					queueName: queueName,
				})
				if (rabitMQResponse.emailResponse.error || rabitMQResponse.error)
					return res.json(
						rabitMQResponse.emailResponse.error || rabitMQResponse.error
					)
				const ReturnSuccessResponse = {}
				const updatedReturnSuccessRes = {
					...ReturnSuccessResponse,
				}

				if (updatedReturnSuccessRes?.output?.responseType === 'xml') {
					delete updatedReturnSuccessRes.headers
					return res
						.set('Content-Type', 'application/xml')
						.send(updatedReturnSuccessRes.output.data)
				}

				delete updatedReturnSuccessRes.params
				delete updatedReturnSuccessRes.secrets
				delete updatedReturnSuccessRes.headers

				if (
					Object.keys(updatedReturnSuccessRes).length ||
					finalResponse.length
				) {
					tavaLogger(
						corelationId,
						'Response',
						url,
						{
							status: 200,
							data: updatedReturnSuccessRes,
						},
						templateType
					)
					return finalResponse.length
						? { output: finalResponse }
						: updatedReturnSuccessRes
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			return res.send(resultCheck)
		}
	} catch (error) {
		const templateType = 'travel'
		const { url, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Error', url, error, templateType)
		if (error?.statusCode && error?.message)
			return res.status(error.statusCode).json(error)
		const ReturnErrorResponse = {}
		const createErrorData = ReturnErrorResponse
		delete createErrorData.params
		delete createErrorData.secrets
		delete createErrorData.headers
		if (!res.headersSent)
			return Object.keys(createErrorData).length ? createErrorData : error
		const ReturnErrResponse = {}
		const createErrData = ReturnErrResponse
		delete createErrData.params
		delete createErrData.secrets
		delete createErrData.headers
		if (!res.headersSent)
			return Object.keys(createErrData).length ? createErrData : error
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

module.exports = {
	sendotp,
}
