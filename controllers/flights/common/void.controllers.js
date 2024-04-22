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
const {
	callSendChangeRequest,
	callGetChangeRequestStatus,
} = require('../../../services/tbo/flightAPIHandler')

const void_ = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const ticketCancelRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const PNRIsPresence = {
			input: ticketCancelRequest,
			params: ticketCancelRequest,
			secrets: process.env,
			headers,
		}
		let isPresenceExternalOutput
		if (!(PNRIsPresence.params.body.length === 0)) {
			const checkResponse = async () => {
				const inputData = {
					...PNRIsPresence,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const PNRCancelMap = {
					input: inputData.input,
					params: ticketCancelRequest,
					secrets: process.env,
					headers,
				}
				const cancelMapExternalOutput = []
				for (let subValue of PNRCancelMap.input.body) {
					const checkResponse = async () => {
						const GetBookingMultiRecords = {
							input: subValue,
							params: ticketCancelRequest,
							secrets: process.env,
							headers,
						}
						const getBookingMultiRecords =
							await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
								`SELECT * FROM "Booking" WHERE "pnr" = '${GetBookingMultiRecords.input.pnr}' OFFSET 0 ROWS FETCH NEXT '20' ROWS ONLY`
							)}`

						const AMTicketVoid = {
							input: getBookingMultiRecords,
							params: ticketCancelRequest,
							secrets: process.env,
							headers,
						}
						if (
							AMTicketVoid.input.length &&
							(AMTicketVoid.input[0].provider === 'AM' ||
								AMTicketVoid.input[0].provider === 'AMADEUS')
						) {
							const checkResponse = async () => {
								const inputData = {
									...AMTicketVoid,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers

								const AMTicketCancelData = {
									input: inputData.input[0],
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
								}

								const requestMapper = async function () {
									const mapVoidrequest = (input) => {
										const { pnr, tavaBookingId, ticketingJSON, id, paymentId } =
											input
										const rawTicketNumbers = JSON.parse(
											ticketingJSON
										).ticketJSON.ticketsnumber.map((ticket) => ticket.number)
										const ticketNumbers = rawTicketNumbers.map((ele) => {
											return ele.replaceAll('-', '')
										})
										return {
											ticketJson: {
												ticketNumbers,
												status: 'CONFIRMED',
												marketIataCode: 'IN',
											},
											pnr,
											tavaBookingId,
											id,
											paymentId,
											currency: subValue.currency,
										}
									}
									return mapVoidrequest(AMTicketCancelData.input)
								}
								const output = await requestMapper()
								const CallATCRESTAPIEndpoint = {
									input: output,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
								}

								let atcRefundResponse
								try {
									const cacheKey = ''
									const cacheExpireTime = 0
									const isCacheRequired = false
									tavaLogger(
										corelationId,
										'Request',
										`${CallATCRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/processRefund?`,
										CallATCRESTAPIEndpoint.input,
										templateType
									)
									const fetchData = async () =>
										await axios
											.post(
												`${CallATCRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/processRefund?`,
												CallATCRESTAPIEndpoint.input,
												{
													headers: {
														'x-request-id': `${CallATCRESTAPIEndpoint.headers['x-request-id']}`,
													},
												}
											)
											.then(async (res) => {
												tavaLogger(
													corelationId,
													'Response',
													`${CallATCRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/processRefund?`,
													res,
													templateType
												)
												return res.data
											})
									atcRefundResponse = isCacheRequired
										? await fetchOrStoreDataInCache(
												fetchData,
												cacheKey,
												cacheExpireTime
										  )
										: await fetchData()
								} catch (error) {
									console.log(
										'Error occurred in :  `${CallATCRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/processRefund?`',
										error
									)
									if (error.response) {
										const { status, data } = error?.response
										tavaLogger(
											corelationId,
											'Error',
											`${CallATCRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/processRefund?`,
											error,
											templateType
										)
										throw res.status(status).json(data)
									}
									throw error
								}
								const ReturnSuccessResponse = {
									output: atcRefundResponse,
									params: ticketCancelRequest,
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
							externalOutput_5633bae6_47a3_4cf9_a391_55f8791f5327 = resultCheck

							return resultCheck
						}
						const TBOTicketCancel = {
							input: getBookingMultiRecords,
							params: ticketCancelRequest,
							secrets: process.env,
							headers,
						}
						let tboTicketCancelExternalOutput
						if (
							TBOTicketCancel.input.length &&
							TBOTicketCancel.input[0].provider === 'TBO'
						) {
							const checkResponse = async () => {
								const inputData = {
									...TBOTicketCancel,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers

								const AuthRequest = {
									input: inputData.input,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
								}

								const tboAuthRequest = await createAuthRequest(
									AuthRequest.secrets,
									AuthRequest.input[0].bookingJSON.journeyDetails[0]
								)

								const CallAuthRESTAPIEndpoint = {
									input: tboAuthRequest,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
								}

								const authAPIResponse = await callAuthRESTAPI(
									corelationId,
									CallAuthRESTAPIEndpoint,
									templateType
								)

								const TBOAuthData = {
									input: authAPIResponse,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
									internalOutput: inputData.input,
								}

								const createSendChangeRequest = async function () {
									function inputMapper(input, output) {
										return {
											BookingId: output.providerBookingId,
											RequestType: 1,
											CancellationType: 3,
											Remarks: subValue?.remark || 'Test remarks',
											EndUserIp: output.bookingJSON.journeyDetails[0].EndUserIp,
											TokenId: input.TokenId,
										}
									}

									return inputMapper(
										TBOAuthData.input,
										TBOAuthData.internalOutput[0]
									)
								}
								const sendChangeRequest = await createSendChangeRequest()

								const CallSendChangesRESTAPI = {
									input: sendChangeRequest,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
								}

								const sendChangesResponse = await callSendChangeRequest(
									corelationId,
									CallSendChangesRESTAPI.input,
									templateType
								)

								const AuthAndSendChangeResponseData = {
									output: authAPIResponse,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
									input: sendChangesResponse,
									internalOutput: inputData.input,
								}

								const createGetChangeRequestStatus = async function () {
									function responseMapper(input, internalOutput, auth) {
										if (input.Response.ResponseStatus != 2) {
											const ticketCRInfo = input.Response.TicketCRInfo

											// Get unique statuses and check if all items have the same status
											const uniqueStatuses = [
												...new Set(ticketCRInfo.map((ticket) => ticket.Status)),
											]
											const allMatchedStatus = uniqueStatuses.length === 1

											// Calculate total cancellation charge and refunded amount
											const totalCancellationCharge = ticketCRInfo.reduce(
												(acc, ticket) => acc + ticket.CancellationCharge,
												0
											)
											const totalRefundedAmount = ticketCRInfo.reduce(
												(acc, ticket) => acc + ticket.RefundedAmount,
												0
											)

											const result = {
												changeRequestIds: ticketCRInfo.map(
													(ticket) => ticket.ChangeRequestId
												),
												ticketIds: ticketCRInfo.map(
													(ticket) => ticket.TicketId
												),
												status: allMatchedStatus ? 'SUCCESSFUL' : 'PROCESSING',
												finalStatus: allMatchedStatus
													? uniqueStatuses[0]
													: null,
												totalCancellationCharge: totalCancellationCharge,
												totalRefundedAmount: totalRefundedAmount,
												updateDate: new Date().toISOString(),
												id: internalOutput.id,
												remark: AuthAndSendChangeResponseData.params.body.find(
													(each) => each.pnr === internalOutput.pnr
												)?.remark,
												source: internalOutput.provider,
												paidAmount:
													internalOutput.bookingJSON.journeyDetails[0].price.grandTotal.toString(),
												tavaBookingId: internalOutput.tavaBookingId,
												pnr: internalOutput.pnr,
												response: input.Response,
											}

											const getChangeRequest = ticketCRInfo.map((ticket) => ({
												ChangeRequestId: ticket.ChangeRequestId,
												EndUserIp:
													internalOutput.bookingJSON.journeyDetails[0]
														.EndUserIp,
												TokenId: auth.TokenId,
											}))

											return { result, getChangeRequest }
										} else return { ...input, ...internalOutput }
									}
									return responseMapper(
										AuthAndSendChangeResponseData.input,
										AuthAndSendChangeResponseData.internalOutput[0],
										AuthAndSendChangeResponseData.output
									)
								}
								const getChangeRequest = await createGetChangeRequestStatus()
								const GetChangeRequestMap = {
									input: getChangeRequest,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
								}
								const getChangeRequestExternalOutput = []
								for (let each of GetChangeRequestMap.input.getChangeRequest ||
									[]) {
									const checkResponse = async () => {
										const CallGetChangeRESTAPI = {
											input: each,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
										}

										const getChangeResponse = await callGetChangeRequestStatus(
											corelationId,
											CallGetChangeRESTAPI.input,
											templateType
										)

										const ReturnSuccessResponse = {
											output: getChangeResponse,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
										}
										const updatedReturnSuccessRes = {
											...ReturnSuccessResponse,
										}

										if (
											updatedReturnSuccessRes?.output?.responseType === 'xml'
										) {
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
									getChangeRequestExternalOutput.push(resultCheck)
								}
								const GetChangesRequestData = {
									input: getChangeRequestExternalOutput,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
									output: getChangeRequest,
								}

								const checkAPIResponseStatus = async function () {
									function processJSON(input, output) {
										const ticketCRInfo = input.map(
											(item) => item.output.Response
										)

										// Get unique statuses and check if all items have the same status
										const uniqueStatuses = [
											...new Set(
												ticketCRInfo.map((ticket) => ticket.ResponseStatus)
											),
										]
										const allMatchedStatus = uniqueStatuses.length === 1

										// Calculate total cancellation charge and refunded amount
										const totalCancellationCharge = ticketCRInfo.reduce(
											(acc, ticket) => acc + ticket.CancellationCharge,
											0
										)
										const totalRefundedAmount = ticketCRInfo.reduce(
											(acc, ticket) => acc + ticket.RefundedAmount,
											0
										)

										const result = {
											changeRequestIds: ticketCRInfo.map(
												(ticket) => ticket.ChangeRequestId
											),
											ticketIds: ticketCRInfo.map((ticket) => ticket.TicketId),
											finalStatus: allMatchedStatus ? uniqueStatuses[0] : null,
											totalCancellationCharge: totalCancellationCharge,
											totalRefundedAmount: totalRefundedAmount,
										}

										return {
											result,
											output,
										}
									}

									return processJSON(
										GetChangesRequestData.input,
										GetChangesRequestData.output
									)
								}
								const apiStatus = await checkAPIResponseStatus()

								const TicketCancelWithStatus = {
									input: apiStatus,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
									internalOutput: inputData.input,
								}
							
								if (TicketCancelWithStatus.input.result.finalStatus === 1) {
									const checkResponse = async () => {
										const inputData = {
											...TicketCancelWithStatus,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput = inputData
										const ticketCancelData = {
											input: internalOutput,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
										}

										const cancelResponseMapper = async function () {
											const refundRequest = (input) => {
												return { ...input.output.result }
											}

											return refundRequest(ticketCancelData.input.input)
										}
										const finalResponse = await cancelResponseMapper()
										const RefundData = {
											input: finalResponse,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
											internalOutput: internalOutput,
										}

										const createRefundQueueData = async function () {
											const updateStatus =
												await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
													`UPDATE "Booking" SET "updatedAt" = '${RefundData.input.updateDate}', status = 'CANCELED' , "cancelationStatus" = 'SUCCESS' WHERE   "id" = '${RefundData.input.id}'`
												)}`

											const refundRequestdata = (input) => {
												const remarks = {
													requestRemarks: input?.remark || '',
													cancellationStatus:
														'All tickets have been successfully cancelled',
													changeRequestIds: input.changeRequestIds,
													ticketIds: input.ticketIds,
												}
												return {
													tavaBookingId: input.tavaBookingId,
													isCompleted: false,
													refundAmount: input.totalRefundedAmount.toString(),
													source: input.source,
													createdAt: new Date().toISOString(),
													updatedAt: new Date().toISOString(),
													remarks: remarks,
													bookingId:
														RefundData?.internalOutput?.internalOutput[0]?.id,
													paymentId:
														RefundData?.internalOutput?.internalOutput[0]
															?.paymentId,
													currency: subValue.currency,
												}
											}

											return refundRequestdata(RefundData.input)
										}
										const refundQueue = await createRefundQueueData()
										const CreateSingleRecord = {
											input: refundQueue,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
										}
										const created = await prisma.RefundQueue.create({
											data: CreateSingleRecord.input,
										})
										const ReturnSuccessResponse = {
											cancellation: finalResponse,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
											created: created,
										}
										const updatedReturnSuccessRes = {
											...ReturnSuccessResponse,
										}

										if (
											updatedReturnSuccessRes?.output?.responseType === 'xml'
										) {
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
								
									return resultCheck
								} else if (
									TicketCancelWithStatus?.input?.result?.finalStatus !== 1 &&
									TicketCancelWithStatus?.input?.output?.result?.response?.ResponseStatus != 2
								) {
									const checkResponse = async () => {
										const inputData = {
											...TicketCancelWithStatus,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers

										const RunJavaScriptCode = {
											input: inputData,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
										}

										const ticketCancelRequestData = {
											input: RunJavaScriptCode.input.input.output.result,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
											internalOutput: inputData,
										}

										const createRefundEntry = async function () {
											const updateStatus =
												await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
													`UPDATE "Booking" SET "updatedAt" = '${ticketCancelRequestData.input.updateDate}', status = 'CANCELED' , "cancelationStatus" = 'PROCESSING' WHERE   "id" = '${ticketCancelRequestData.input.id}'`
												)}`

											const refundRequestdata = (input) => {
												const remarks = {
													requestRemarks: input?.remark || '',
													cancellationStatus:
														'Unable to complete cancellation. Some tickets are not canceled.',
													changeRequestIds: input.changeRequestIds,
													ticketIds: input.ticketIds,
												}
												return {
													tavaBookingId: input.tavaBookingId,
													isCompleted: false,
													refundAmount: input.totalRefundedAmount.toString(),
													source: input.source,
													createdAt: new Date().toISOString(),
													updatedAt: new Date().toISOString(),
													remarks: remarks,
													bookingId:
													ticketCancelRequestData?.internalOutput
															?.internalOutput[0]?.id,
													paymentId:
													ticketCancelRequestData?.internalOutput
															?.internalOutput[0]?.paymentId,
													currency: subValue.currency,
												}
											}
											return refundRequestdata(ticketCancelRequestData.input)
										}
										const refundEntryOutput = await createRefundEntry()
										const createSingleRecord = {
											input: refundEntryOutput,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
										}
										const created = await prisma.refundQueue.create({
											data: createSingleRecord.input,
										})
										const ReturnSuccessResponse = {
											cancellation: RunJavaScriptCode.input.input.output.result,
											created: created,
										}

										tavaLogger(
											corelationId,
											'Response',
											url,
											{
												status: 200,
												data: { output: ReturnSuccessResponse },
											},
											templateType
										)
										return { output: ReturnSuccessResponse }
									}
									const resultCheck = await checkResponse()
							
									return resultCheck
								}
								const TicketCancelFailResponse = {
									input: apiStatus,
									params: ticketCancelRequest,
									secrets: process.env,
									headers,
								}
								let ticketCancelFailResponseExternalOutput
								if (
									TicketCancelFailResponse.input.output.Response
										.ResponseStatus === 2
								) {
									const checkResponse = async () => {
										const inputData = {
											...TicketCancelFailResponse,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers

										const BookingUpdateData = {
											input: inputData,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
										}

										const finalResponseMapper = async function () {
											const updateStatus =
												await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
													`UPDATE "Booking" SET "updatedAt" = '${new Date().toISOString()}', status = 'CANCELED' , "cancelationStatus" = 'PROCESSING' WHERE   "id" = '${
														BookingUpdateData.input.id
													}'`
												)}`

											const responseMapping = (input) => ({
												status: 'FAILED',
												source: 'TBO',
												error: input?.output?.Response?.Error?.ErrorMessage,
												...input.input.result,
												response: input.input.output.Response,
											})

											return responseMapping(BookingUpdateData.input)
										}
										const updatedBookingData = await finalResponseMapper()
										const ReturnSuccessResponse = {
											cancellation: updatedBookingData,
											params: ticketCancelRequest,
											secrets: process.env,
											headers,
										}
										const updatedReturnSuccessRes = {
											...ReturnSuccessResponse,
										}

										if (
											updatedReturnSuccessRes?.output?.responseType === 'xml'
										) {
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
									ticketCancelFailResponseExternalOutput = resultCheck

									return resultCheck
								}
							}
							const resultCheck = await checkResponse()
							tboTicketCancelExternalOutput = resultCheck

							return resultCheck
						}
						const NoDataFound = {
							input: getBookingMultiRecords,
							params: ticketCancelRequest,
							secrets: process.env,
							headers,
						}
						let noDataFoundExternalOutput
						if (NoDataFound.input[0].length === 0) {
							const checkResponse = async () => {
								const inputData = {
									...NoDataFound,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers

								const error = new Error()
								error.statusCode = '404'
								error.message = 'No Data Found'
								throw error
							}
							const resultCheck = await checkResponse()
							noDataFoundExternalOutput = resultCheck

							return resultCheck
						}
					}
					const resultCheck = await checkResponse()
					cancelMapExternalOutput.push(resultCheck)
				}
				const ReturnSuccessResponse = {
					void: cancelMapExternalOutput,
					params: ticketCancelRequest,
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
			isPresenceExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		const PNRIsMissing = {
			input: ticketCancelRequest,
			params: ticketCancelRequest,
			secrets: process.env,
			headers,
		}
		let pnrMissingExternalOutput
		if (PNRIsMissing.params.body.length === 0) {
			const checkResponse = async () => {
				const inputData = {
					...PNRIsMissing,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers
				const error = new Error()
				error.statusCode = '400'
				error.message = 'Please enter a valid PNR to proceed'
				throw error
			}
			const resultCheck = await checkResponse()
			pnrMissingExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		return res.json(
			'Node has completed its execution without any response. No response node (e.g., success response, error response) connected to the service.'
		)
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
	void_,
}
