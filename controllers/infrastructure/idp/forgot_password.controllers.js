const { tavaLogger } = require('../../../helpers')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const { idpAuthentication } = require('../../../services/tbo/idpAuthentication')

const forgotpassword = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const request = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const [userDetails] =
			await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
				`SELECT * FROM "Users" WHERE "email" = '${request.body.email}' limit 1`
			)}`

		if (userDetails) {
			const idpRequestMapper = async function () {
				const returnRequest = async (input, currParams) => {
					const { body } = currParams
					const { code, password } = body
					const currentDate = new Date()
					const timestamp = new Date(input.codeTimestamp)
					const timeDifference = currentDate - timestamp
					if (timeDifference > 600000) {
						const error = new Error()
						error.statusCode = 410
						error.message = 'Verification code expired'
						throw error
					} else {
						if (code === input.verificationCode) {
							return {
								headers,
								body: {
									email: input.email,
									password,
								},
							}
						} else {
							const error = new Error()
							error.statusCode = 402
							error.message = 'Wrong verification code'
							throw error
						}
					}
				}
				return returnRequest(userDetails, request)
			}
			const idpRequestMapperResponse = await idpRequestMapper()

			const idpAuthenticationResponse = await idpAuthentication(
				idpRequestMapperResponse,
				'forgot-password'
			)
			if (idpAuthenticationResponse.response.error)
				throw idpAuthenticationResponse.response.error
			const sqlQuery = {
				input: idpAuthenticationResponse,
				params: request,
				secrets: process.env,
				headers,
			}

			await prisma.$queryRaw`SELECT * FROM function_8fb1a3e8_1c66_4803_b1c6_36c5574b45a8 (${sqlQuery.input.response.Response.id});`
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

			if (Object.keys(updatedReturnSuccessRes).length || finalResponse.length) {
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
					? res.json({ output: finalResponse })
					: res.json(updatedReturnSuccessRes)
			} else return res.json('successfully run')
		}
		if (!userDetails) {
			const ReturnErrorResponse = {}
			const createErrorData = ReturnErrorResponse
			delete createErrorData.params
			delete createErrorData.secrets
			delete createErrorData.headers
			if (!res.headersSent)
				return res
					.status(400)
					.json(
						Object.keys(createErrorData).length
							? createErrorData
							: 'Error: not able to run properly'
					)
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
			return res
				.status(400)
				.json(Object.keys(createErrorData).length ? createErrorData : error)
		const ReturnErrResponse = {}
		const createErrData = ReturnErrResponse
		delete createErrData.params
		delete createErrData.secrets
		delete createErrData.headers
		if (!res.headersSent)
			return res
				.status(400)
				.json(Object.keys(createErrData).length ? createErrData : error)
	}
}

module.exports = {
	forgotpassword,
}
