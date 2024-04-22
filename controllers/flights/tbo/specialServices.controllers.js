const { tavaLogger } = require('../../../helpers')
const {
	fetchOrStoreDataInCache,
} = require('../../../helpers/fetchAndUpdateCacheData')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../../services/tbo/authentication')
const { callSSR } = require('../../../services/tbo/flightAPIHandler')

const specialService = async (req, res, next) => {
	const templateType = 'travel'
	const specialServiceRequest = req
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const TBOSpecialService = {
			input: specialServiceRequest.body,
			params: specialServiceRequest,
			secrets: process.env,
			headers,
		}
		if (TBOSpecialService.input.source == 'TBO') {
			const AuthRequest = {
				input: TBOSpecialService,
				params: specialServiceRequest,
				secrets: process.env,
				headers,
			}

			const authResquest = await createAuthRequest(
				AuthRequest.secrets,
				AuthRequest.input.input.data
			)

			const CallAuthRESTAPIEndpoint = {
				input: authResquest,
				params: specialServiceRequest,
				secrets: process.env,
				headers,
			}

			let authResponse = await callAuthRESTAPI(
				corelationId,
				CallAuthRESTAPIEndpoint,
				templateType
			)

			const AuthAPIData = {
				input: authResponse,
				params: specialServiceRequest,
				secrets: process.env,
				headers,
			}

			const createSSRequest = async function () {
				const returnSSRRequest = (input) => {
					const { TokenId } = input.input
					const { TraceId, EndUserIp, ResultIndex, ipAddress } =
						input.params.body.data
					return {
						TokenId,
						TraceId,
						EndUserIp,
						ResultIndex,
						ipAddress,
					}
				}

				return returnSSRRequest(AuthAPIData)
			}
			const ssRequest = await createSSRequest()
			const CallSSRESTAPI = {
				input: ssRequest,
				params: specialServiceRequest,
				secrets: process.env,
				headers,
			}

			const ssAPIResponse = await callSSR(
				corelationId,
				CallSSRESTAPI.input,
				templateType
			)

			const SSResponseData = {
				input: ssAPIResponse,
				params: specialServiceRequest,
				secrets: process.env,
				headers,
			}

			const mapFinalResponse = async function () {
				const body = {
					...SSResponseData?.params?.body,
				}
				delete body.data
				delete body.commission
				return {
					...SSResponseData.input,
					...body,
				}
			}
			const finalResponse = await mapFinalResponse()
			const GetRule = {
				input: ssRequest,
				params: specialServiceRequest,
				secrets: process.env,
				headers,
			}
			const commissionOutput = await prisma.$queryRawUnsafe(
				`SELECT "serviceType","carrierCode","providerName","commission","commissionType","source","destination","effectiveStartDate","effectiveEndDate","notes","createdAt","updatedAt" FROM "commissions" WHERE "carrierCode"= '${GetRule.params.body.commission.carrierCode}' AND "providerName"= '${GetRule.params.body.commission.providerName}' AND "source"= '${GetRule.params.body.commission.source}' AND "destination"= '${GetRule.params.body.commission.destination}'`
			)
			const ReturnSuccessResponse = {
				output: finalResponse,
				params: specialServiceRequest,
				secrets: process.env,
				headers,
				commission: commissionOutput,
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
	} catch (error) {
		const templateType = 'travel'
		const { url, headers } = req
		let corelationId = headers['x-request-id']
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

module.exports = {
	specialService,
}
