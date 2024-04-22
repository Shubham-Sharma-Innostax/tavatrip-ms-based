const axios = require('axios')
const moment = require('moment')
const { sendticketingemail } = require('../../../helpers/service.js')
const prismaClient = require('../prismaClient')
const {
	callGetBookingDetailsAPI,
} = require('../../../services/tbo/getBookingDetails.js')
const { callTBOTicketAPI } = require('../../../services/tbo/ticket.js')
const { tavaLogger } = require('../../../helpers/tavaLogger.js')
const {
	flightCancel,
} = require('../../../services/tbo/helpers/callFlightCancel.js')
const {
	callPaymentCallback,
} = require('../../infrastructure/payment/payment_callback.controllers.js')
const { prisma } = prismaClient

const bookCallback = async (req, res, next) => {
	const finalResponse = []
	const templateType = 'travel'
	const bookingRequest = req
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const CallPaymentCallbackRESTAPIEndpoint = {
			input: bookingRequest,
			params: bookingRequest,
			secrets: process.env,
			headers,
		}
		const queryParameters = `paymentGateway=${CallPaymentCallbackRESTAPIEndpoint.input.query.paymentGateway}&paymentSessionId=${CallPaymentCallbackRESTAPIEndpoint.input.query.paymentSessionId}&paymentId=${CallPaymentCallbackRESTAPIEndpoint.input.query.paymentId}&`
		const queryParams = queryParameters.replace(/=/g, ':').replace(/&/g, ',')

		const pairs = queryParams.split(',')
		const jsonObj = {}
		for (let pair of pairs) {
			const [key, value] = pair.split(':')
			jsonObj[key] = value
		}
		const createQueryString = (filters) => {
			const queryString = Object.keys(filters)
				.filter(
					(each) =>
						filters[each] &&
						filters[each] != 'undefined' &&
						filters[each] != 'null'
				)
				.map((each) => `${each}=${filters[each]}`)
				.join('&')
			return queryString ? `${queryString}` : ''
		}

		let paymentCallbackResponse = await callPaymentCallback(
			corelationId,
			req,
			templateType
		)
		const IfPaymentCapturedTrue = {
			input: paymentCallbackResponse,
			params: bookingRequest,
			secrets: process.env,
			headers,
		}
		let capturedTrueExternalOutput
		if (IfPaymentCapturedTrue.input.output.status === 'CAPTURED') {
			const checkResponse = async () => {
				const paymentCaptureInputData = {
					...IfPaymentCapturedTrue,
				}
				delete paymentCaptureInputData.params
				delete paymentCaptureInputData.secrets
				delete paymentCaptureInputData.headers
				const paymentCaptureInternalOutput = paymentCaptureInputData
				const UpdateBookingRecordFields = {
					input: paymentCaptureInternalOutput,
					params: bookingRequest,
					secrets: process.env,
					headers,
				}
				const parseInputData = (inputData) => {
					const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
					const formattedOutput = []
					let match
					while ((match = regex.exec(inputData)) !== null) {
						const [, key, value, operator] = match
						formattedOutput.push({
							key,
							value,
							operator,
						})
					}
					return formattedOutput
				}
				const formattedWhereQuery = `"tavaBookingId"='${UpdateBookingRecordFields.params.query.tavaBookingId}'`
				const formattedSetQuery = `"paymentId"= '${UpdateBookingRecordFields.params.query.paymentId}',"paymentStatus"= 'CAPTURED',"paymentSessionId"= '${UpdateBookingRecordFields.params.query.paymentSessionId}'`
				const outputWhereData = parseInputData(formattedWhereQuery)
				const outputSetData = parseInputData(formattedSetQuery)

				let queryWhere = ''
				let querySet = ''
				let preOperatorWhere = ''

				outputWhereData.forEach((item) => {
					if (!item.value.includes('undefined')) {
						queryWhere += ` ${queryWhere ? preOperatorWhere : ''} "${
							item.key
						}" = '${item.value}'`
					}
					preOperatorWhere = item.operator
				})
				outputSetData.forEach((item) => {
					if (!item.value.includes('undefined')) {
						querySet += `"${item.key}" = '${item.value}'`
					}
				})

				querySet = querySet.replaceAll(`'"`, `',"`)
				const updateInfo =
					await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
						`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
					)}`

				const GetBookingMultiRecord = {
					input: paymentCaptureInternalOutput,
					params: bookingRequest,
					secrets: process.env,
					headers,
					updateInfo: updateInfo,
				}
				const multiRecordParseInputData = (inputData) => {
					const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
					const multiRecordFormattedOutput = []
					let match
					while ((match = regex.exec(inputData)) !== null) {
						const [, key, value, operator] = match
						multiRecordFormattedOutput.push({
							key,
							value,
							operator,
						})
					}
					return multiRecordFormattedOutput
				}
				const multiRecordFormattedQuery = `"tavaBookingId" = '${GetBookingMultiRecord.params.query.tavaBookingId}'`
				const multiRecordOutputData = multiRecordParseInputData(
					multiRecordFormattedQuery
				)
				let multiRecordQuery = ''
				let multiRecordPreOperator = ''
				multiRecordOutputData.forEach((item) => {
					if (!item.value.includes('undefined')) {
						multiRecordQuery += ` ${
							multiRecordQuery ? multiRecordPreOperator : ''
						} "${item.key}" = '${item.value}'`
					}
					multiRecordPreOperator = item.operator
				})
				const isFormattedQueryExist = multiRecordQuery
					? `WHERE ${multiRecordQuery}`
					: ''
				const multiRecordSortObj = []
				let multiRecordSortObjExp = ''
				if (multiRecordSortObj.length) {
					const orderByClause = multiRecordSortObj
						.map((order) => {
							const [key, value] = Object.entries(order)[0]
							return `"${key}" ${value.toUpperCase()}`
						})
						.join(', ')
					multiRecordSortObjExp = `ORDER BY ${orderByClause}`
				}
				const getMultiObjectByQuery =
					await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
						`SELECT * FROM "Booking"  ${isFormattedQueryExist} ${multiRecordSortObjExp} OFFSET 0 ROWS FETCH NEXT '20' ROWS ONLY`
					)}`

				const BookingResult = getMultiObjectByQuery

				const bookMap = {
					input: BookingResult,
					params: bookingRequest,
					secrets: process.env,
					headers,
				}

				const bookExternalOutput = []
				for (let iterator of bookMap.input) {
					const internalOutput = iterator
					const checkResponse = async () => {
						const IfTBO = {
							input: internalOutput,
							params: bookingRequest,
							secrets: process.env,
							headers,
						}
						let tboExternalOutput
						if (IfTBO.input.provider === 'TBO') {
							const checkResponse = async () => {
								const inputData = {
									...IfTBO,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers
								const internalOutput = inputData

								const tboBookMap = {
									input: [internalOutput.input],
									params: bookingRequest,
									secrets: process.env,
									headers,
								}
								const tboBookingResponse = []
								for (let each of tboBookMap.input) {
									const internalOutput = each
									const checkResponse = async () => {
										const isTBOLCC = {
											input: internalOutput,
											params: bookingRequest,
											secrets: process.env,
											headers,
										}
										let tboLCCExternalOutput
										if (each.bookingJSON.journeyDetails[0].isLCC) {
											const checkResponse = async () => {
												const inputData = {
													...isTBOLCC,
												}
												delete inputData.params
												delete inputData.secrets
												delete inputData.headers
												const internalOutput = inputData

												const tboTicketRequest = {
													input: internalOutput,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}

												const tboTicket = async function () {
													const data = tboTicketRequest
													const returnRequest = async () => {
														const journeyDetails =
															each.bookingJSON.journeyDetails
														const bookingJSON = {
															journeyDetails,
															bookingResponse: {},
															ticketingJSON: each.ticketingJSON,
														}

														await prisma.$executeRaw`UPDATE "Booking" SET "bookingJSON" = ${bookingJSON}, "paymentStatus" = 'CAPTURED', "ticketingStatus" = 'NA' WHERE id = ${each?.id}`
														return each?.ticketingJSON
													}

													const ticketRequest = await returnRequest()

													try {
														const ticketResponse = await callTBOTicketAPI(
															corelationId,
															ticketRequest,
															templateType,
															data
														)

														if (ticketResponse) {
															return ticketResponse
														} else {
															console.log(
																'timeout of 300 sec exceeded - /Ticket'
															)
															const getbookingDetailsRequest = {
																EndUserIp:
																	data.input.input.ticketingJSON.EndUserIp,
																TokenId: data.input.input.ticketingJSON.TokenId,
																TraceId: data.input.input.ticketingJSON.TraceId,
															}

															return new Promise(async (resolve) => {
																let count = 0
																let intervalId

																intervalId = setInterval(async () => {
																	console.log(count)
																	const getBookingResponse =
																		await callGetBookingDetailsAPI(
																			corelationId,
																			getbookingDetailsRequest,
																			templateType,
																			data
																		)
																	if (
																		getBookingResponse?.Response?.Error
																			?.ErrorCode === 0
																	) {
																		clearInterval(intervalId)
																		const data = {
																			Response: {
																				timeout: true,
																				response: getBookingResponse,
																			},
																		}
																		resolve(data)
																	}

																	count++

																	if (count >= 10) {
																		clearInterval(intervalId)
																		const data = {
																			Response: {
																				timeout: true,
																				response: getBookingResponse,
																			},
																		}
																		resolve(data)
																	}
																}, 10000)
															})
														}
													} catch (error) {
														console.error('Error in fetching data', error)
													}
												}
												const ticketResponse = await tboTicket()

												const ticketErrorResponse = {
													input: ticketResponse,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}
												let ticketErrorExternalOutput
												if (
													ticketErrorResponse.input.Response?.Error
														?.ErrorCode !== 0 &&
													ticketErrorResponse.input.Response?.timeout != true
												) {
													const checkResponse = async () => {
														const inputData = { ...ticketErrorResponse }
														delete inputData.params
														delete inputData.secrets
														delete inputData.headers
														const internalOutput = inputData
														const UpdateRecordFieldsbyQuery = {
															input: internalOutput,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														const parseInputData = (inputData) => {
															const regex =
																/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
															const formattedOutput = []
															let match
															while ((match = regex.exec(inputData)) !== null) {
																const [, key, value, operator] = match
																formattedOutput.push({ key, value, operator })
															}
															return formattedOutput
														}
														const formattedWhereQuery = `"id"='${each.id}'`
														const formattedSetQuery = `"status"= 'FAILED',"ticketingStatus"= 'FAILED'`
														const outputWhereData =
															parseInputData(formattedWhereQuery)
														const outputSetData =
															parseInputData(formattedSetQuery)

														let queryWhere = ''
														let querySet = ''
														let preOperatorWhere = ''

														outputWhereData.forEach((item) => {
															if (!item.value.includes('undefined')) {
																queryWhere += ` ${
																	queryWhere ? preOperatorWhere : ''
																} "${item.key}" = '${item.value}'`
															}
															preOperatorWhere = item.operator
														})
														outputSetData.forEach((item) => {
															if (!item.value.includes('undefined')) {
																querySet += `"${item.key}" = '${item.value}'`
															}
														})

														querySet = querySet.replaceAll(`'"`, `',"`)
														const updateBookingInfo =
															await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
															)}`

														const refundRequest = {
															input: updateBookingInfo,
															params: bookingRequest,
															secrets: process.env,
															headers,
															internalOutput: internalOutput,
														}

														const mapRefundQueueData = async function () {
															return {
																tavaBookingId: each.tavaBookingId,
																isCompleted: false,
																refundAmount:
																	each.bookingJSON.journeyDetails[0].price.grandTotal.toString(),
																source: each.provider,
																createdAt: new Date().toISOString(),
																updatedAt: new Date().toISOString(),
																remarks:
																	refundRequest?.internalOutput?.input
																		?.Response,
																bookingId: each.id,
																paymentId: each.paymentId,
																currency:
																	refundRequest?.params?.query?.currency,
															}
														}
														const refundQueue = await mapRefundQueueData()

														const CreateSingleRefundRecord = {
															input: refundQueue,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														const createdRecord =
															await prisma.RefundQueue.create({
																data: CreateSingleRefundRecord.input,
															})
														const ReturnSuccessResponse = {
															created: createdRecord,
															params: bookingRequest,
															secrets: process.env,
															headers,
															response: internalOutput,
														}
														const updatedReturnSuccessRes = {
															...ReturnSuccessResponse,
														}

														if (
															updatedReturnSuccessRes?.output?.responseType ===
															'xml'
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
													ticketErrorExternalOutput = resultCheck

													return resultCheck
												}

												const ticketSuccessfulResponse = {
													input: ticketResponse,
													params: bookingRequest,
													secrets: process.env,
													headers,
													internalOutput: internalOutput,
												}
												let ticketSuccessfulExternalOutput
												if (
													ticketSuccessfulResponse.input.Response?.Error
														?.ErrorCode === 0 &&
													ticketSuccessfulResponse.input.Response?.timeout !=
														true
												) {
													const checkResponse = async () => {
														const inputData = { ...ticketSuccessfulResponse }
														delete inputData.params
														delete inputData.secrets
														delete inputData.headers
														const internalOutput = inputData

														const successTicketResponse = {
															input: internalOutput,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}

														const mapTicketResponse = async function () {
															const bookingData =
																successTicketResponse.input.internalOutput
															const tavaId = bookingData.input.tavaBookingId
															const tboTicketRes = JSON.parse(
																JSON.stringify(
																	successTicketResponse.input.input.Response
																).replaceAll("'", '')
															)

															const { IsPriceChanged } = tboTicketRes.Response

															function responseMapper() {
																let ticketingFinalRes = {
																	ticketingRequest:
																		bookingData.input.ticketingJSON,
																	ticketingResponse: tboTicketRes?.Response,
																}
																ticketingFinalRes =
																	JSON.stringify(ticketingFinalRes)
																const ticketStatus =
																	tboTicketRes?.Response?.FlightItinerary
																		?.Status === 5
																		? 'CONFIRMED'
																		: 'FAILED'
																const bookingStatus =
																	tboTicketRes?.Response?.FlightItinerary
																		?.Status === 5
																		? 'CONFIRMED'
																		: 'FAILED'
																const failureReason = tboTicketRes?.Error
																// need to add name logic
																return {
																	dbData: {
																		result: {
																			bookingId:
																				tboTicketRes?.Response?.FlightItinerary
																					?.BookingId,
																			PNR: tboTicketRes?.Response
																				?.FlightItinerary?.PNR,
																			status: ticketStatus,
																			createdAt: bookingData.input.createdAt,
																			bookingStatus,
																			failureReason,
																		},
																		config: {
																			id: bookingData.input.id,
																			providerBookingId:
																				tboTicketRes?.Response?.FlightItinerary
																					?.BookingId,
																			ticketingJson: ticketingFinalRes,
																			tavaBookingId: tavaId,
																			userEmail:
																				bookingData?.input?.userEmail ||
																				each?.bookingJSON?.journeyDetails[0]
																					.travelerDetails[0].email,
																		},
																	},
																	conditionalData: {
																		IsPriceChanged,
																		response: tboTicketRes,
																	},
																}
															}
															return responseMapper()
														}

														const ticketMappedResponse =
															await mapTicketResponse()

														const IsPriceChangedTrue = {
															input: ticketMappedResponse,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														let IsPriceChangedExternalOutput
														if (
															IsPriceChangedTrue.input.conditionalData
																.IsPriceChanged ||
															IsPriceChangedTrue.input.dbData.result
																.bookingStatus == 'FAILED'
														) {
															const checkResponse = async () => {
																const inputData = { ...IsPriceChangedTrue }
																delete inputData.params
																delete inputData.secrets
																delete inputData.headers
																const internalOutput = inputData

																const UpdateBookingRecordFields = {
																	input: internalOutput.input.conditionalData,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const parseInputData = (inputData) => {
																	const regex =
																		/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																	const formattedOutput = []
																	let match
																	while (
																		(match = regex.exec(inputData)) !== null
																	) {
																		const [, key, value, operator] = match
																		formattedOutput.push({
																			key,
																			value,
																			operator,
																		})
																	}
																	return formattedOutput
																}
																const formattedWhereQuery = `"id"='${each.id}'`
																const formattedSetQuery = `"status"= 'FAILED',"ticketingStatus"= 'FAILED'`
																const outputWhereData =
																	parseInputData(formattedWhereQuery)
																const outputSetData =
																	parseInputData(formattedSetQuery)

																let queryWhere = ''
																let querySet = ''
																let preOperatorWhere = ''

																outputWhereData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		queryWhere += ` ${
																			queryWhere ? preOperatorWhere : ''
																		} "${item.key}" = '${item.value}'`
																	}
																	preOperatorWhere = item.operator
																})
																outputSetData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		querySet += `"${item.key}" = '${item.value}'`
																	}
																})

																querySet = querySet.replaceAll(`'"`, `',"`)
																const updateBookingInfo =
																	await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																		`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																	)}`

																const refundRequest = {
																	input: updateBookingInfo,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	pickedValue:
																		internalOutput.input.conditionalData,
																}

																const mapRefundQueueData = async function () {
																	return {
																		tavaBookingId: each.tavaBookingId,
																		isCompleted: false,
																		refundAmount:
																			each.bookingJSON.journeyDetails[0].price.grandTotal.toString(),
																		source: each.provider,
																		createdAt: new Date().toISOString(),
																		updatedAt: new Date().toISOString(),
																		remarks: refundRequest?.pickedValue,
																		bookingId: each.id,
																		paymentId: each.paymentId,
																		currency:
																			refundRequest?.params?.query?.currency,
																	}
																}

																const refundQueue = await mapRefundQueueData()
																const CreateRefundSingleRecord = {
																	input: refundQueue,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const createdRecord =
																	await prisma.RefundQueue.create({
																		data: CreateRefundSingleRecord.input,
																	})
																const ReturnSuccessResponse = {
																	created: createdRecord,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	pickedValue:
																		internalOutput.input.conditionalData,
																}
																const updatedReturnSuccessRes = {
																	...ReturnSuccessResponse,
																}

																if (
																	updatedReturnSuccessRes?.output
																		?.responseType === 'xml'
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
															IsPriceChangedExternalOutput = resultCheck

															return resultCheck
														}
														const IsPriceChangedFalse = {
															input: ticketMappedResponse,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														let IsPriceChangedFalseExternalOutput
														if (
															!IsPriceChangedFalse.input.conditionalData
																.IsPriceChanged
														) {
															const checkResponse = async () => {
																const inputData = { ...IsPriceChangedFalse }
																delete inputData.params
																delete inputData.secrets
																delete inputData.headers
																const internalOutput = inputData
																const UpdateBookingRecordFields = {
																	input: internalOutput,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const parseInputData = (inputData) => {
																	const regex =
																		/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																	const formattedOutput = []
																	let match
																	while (
																		(match = regex.exec(inputData)) !== null
																	) {
																		const [, key, value, operator] = match
																		formattedOutput.push({
																			key,
																			value,
																			operator,
																		})
																	}
																	return formattedOutput
																}
																const formattedWhereQuery = `"id"='${UpdateBookingRecordFields.input.input.dbData.config.id}'`
																const formattedSetQuery = `"pnr"= '${UpdateBookingRecordFields.input.input.dbData.result.PNR}',"status"= 'CONFIRMED',"ticketingStatus"= 'CONFIRMED',"ticketingJSON"= '${UpdateBookingRecordFields.input.input.dbData.config.ticketingJson}',"providerBookingId"= '${UpdateBookingRecordFields.input.input.dbData.config.providerBookingId}'`
																const outputWhereData =
																	parseInputData(formattedWhereQuery)
																const outputSetData =
																	parseInputData(formattedSetQuery)

																let queryWhere = ''
																let querySet = ''
																let preOperatorWhere = ''

																outputWhereData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		queryWhere += ` ${
																			queryWhere ? preOperatorWhere : ''
																		} "${item.key}" = '${item.value}'`
																	}
																	preOperatorWhere = item.operator
																})
																outputSetData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		querySet += `"${item.key}" = '${item.value}'`
																	}
																})

																querySet = querySet.replaceAll(`'"`, `',"`)
																const updateBookingInfo =
																	await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																		`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																	)}`

																const ReturnSuccessResponse = {
																	output: internalOutput?.input?.dbData,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const updatedReturnSuccessRes = {
																	...ReturnSuccessResponse,
																}

																if (
																	updatedReturnSuccessRes?.output
																		?.responseType === 'xml'
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
															IsPriceChangedFalseExternalOutput = resultCheck

															return resultCheck
														}
													}
													const resultCheck = await checkResponse()
													ticketSuccessfulExternalOutput = resultCheck

													return resultCheck
												}
												const IfTimeout = {
													input: ticketResponse,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}
												let timeoutExternalOutput
												if (IfTimeout.input.Response?.timeout === true) {
													const checkResponse = async () => {
														const inputData = { ...IfTimeout }
														delete inputData.params
														delete inputData.secrets
														delete inputData.headers
														const internalOutput = inputData

														const ticketRequest = {
															input: internalOutput,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}

														const checkError = async function () {
															const response =
																ticketRequest?.input?.input?.Response?.response
																	?.Response
															let data = {
																error: true,
																res: '',
															}
															if (
																response?.Error?.ErrorCode === 0 &&
																response?.FlightItinerary?.Passenger[0].Ticket
																	?.TicketId !== undefined
															) {
																;(data.error = false), (data.res = response)

																return data
															} else {
																;(data.error = true), (data.res = response)

																return data
															}
														}
														const res = await checkError()

														const errorFalse = {
															input: res,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														let errorFalseExternalOutput
														if (!errorFalse.input.error) {
															const checkResponse = async () => {
																const inputData = { ...errorFalse }
																delete inputData.params
																delete inputData.secrets
																delete inputData.headers
																const internalOutput = inputData

																const tbotimeouTicketRequest = {
																	input: internalOutput,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}

																const tboTimeoutMapper = async function () {
																	const bookingData =
																		tbotimeouTicketRequest?.input?.input
																	const getBookingDetailsResponse = JSON.parse(
																		JSON.stringify(bookingData?.res).replaceAll(
																			"'",
																			''
																		)
																	)

																	function responseMapper() {
																		return {
																			dbData: {
																				result: {
																					bookingId:
																						bookingData?.res?.FlightItinerary
																							?.BookingId,
																					PNR: bookingData?.res?.FlightItinerary
																						.PNR,
																					status: 'CONFIRMED',
																					updatedAt: new Date().toISOString(),
																					ticketingStatus: 'CONFIRMED',
																				},
																				config: {
																					id: each.id,
																					providerBookingId:
																						bookingData?.res?.FlightItinerary
																							?.BookingId,
																					ticketingJson: JSON.stringify(
																						getBookingDetailsResponse
																					),
																					tavaBookingId: each?.tavaBookingId,
																					userEmail:
																						each?.bookingJSON?.journeyDetails[0]
																							.travelerDetails[0].email,
																					timeout: true,
																				},
																			},
																		}
																	}

																	return responseMapper()
																}
																const tbotimeouTicketResponse =
																	await tboTimeoutMapper()

																const UpdateBookingRecordFields = {
																	input: tbotimeouTicketResponse,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const parseInputData = (inputData) => {
																	const regex =
																		/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																	const formattedOutput = []
																	let match
																	while (
																		(match = regex.exec(inputData)) !== null
																	) {
																		const [, key, value, operator] = match
																		formattedOutput.push({
																			key,
																			value,
																			operator,
																		})
																	}
																	return formattedOutput
																}
																const formattedWhereQuery = `"id"='${UpdateBookingRecordFields.input.dbData.config.id}'`
																const formattedSetQuery = `"status"= '${UpdateBookingRecordFields.input.dbData.result.status}',"pnr"= '${UpdateBookingRecordFields.input.dbData.result.PNR}',"providerBookingId"= '${UpdateBookingRecordFields.input.dbData.config.providerBookingId}',"ticketingJSON"= '${UpdateBookingRecordFields.input.dbData.config.ticketingJson}',"ticketingStatus"= '${UpdateBookingRecordFields.input.dbData.result.ticketingStatus}',"updatedAt"= '${UpdateBookingRecordFields.input.dbData.result.updatedAt}'`
																const outputWhereData =
																	parseInputData(formattedWhereQuery)
																const outputSetData =
																	parseInputData(formattedSetQuery)

																let queryWhere = ''
																let querySet = ''
																let preOperatorWhere = ''

																outputWhereData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		queryWhere += ` ${
																			queryWhere ? preOperatorWhere : ''
																		} "${item.key}" = '${item.value}'`
																	}
																	preOperatorWhere = item.operator
																})
																outputSetData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		querySet += `"${item.key}" = '${item.value}'`
																	}
																})

																querySet = querySet.replaceAll(`'"`, `',"`)
																const updateInfo =
																	await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																		`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																	)}`
																const ReturnSuccessResponse = {
																	output: tbotimeouTicketResponse,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const updatedReturnSuccessRes = {
																	...ReturnSuccessResponse,
																}

																if (
																	updatedReturnSuccessRes?.output
																		?.responseType === 'xml'
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
															errorFalseExternalOutput = resultCheck

															return resultCheck
														}
														const errorTrue = {
															input: res,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														let errorTrueExternalOutput
														if (errorTrue.input.error) {
															const checkResponse = async () => {
																const inputData = { ...errorTrue }
																delete inputData.params
																delete inputData.secrets
																delete inputData.headers
																const internalOutput = inputData
																const UpdateRecordFieldsbyQuery = {
																	input: internalOutput,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const parseInputData = (inputData) => {
																	const regex =
																		/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																	const formattedOutput = []
																	let match
																	while (
																		(match = regex.exec(inputData)) !== null
																	) {
																		const [, key, value, operator] = match
																		formattedOutput.push({
																			key,
																			value,
																			operator,
																		})
																	}
																	return formattedOutput
																}
																const formattedWhereQuery = `"id"='${each.id}'`
																const formattedSetQuery = `"status"= 'FAILED',"ticketingStatus"= 'FAILED'`
																const outputWhereData =
																	parseInputData(formattedWhereQuery)
																const outputSetData =
																	parseInputData(formattedSetQuery)

																let queryWhere = ''
																let querySet = ''
																let preOperatorWhere = ''

																outputWhereData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		queryWhere += ` ${
																			queryWhere ? preOperatorWhere : ''
																		} "${item.key}" = '${item.value}'`
																	}
																	preOperatorWhere = item.operator
																})
																outputSetData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		querySet += `"${item.key}" = '${item.value}'`
																	}
																})

																querySet = querySet.replaceAll(`'"`, `',"`)
																const updateInfo =
																	await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																		`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																	)}`

																const timeoutRefundRequest = {
																	input: updateInfo,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	internalOutput: internalOutput,
																}

																const refundQueueMapper = async function () {
																	return {
																		tavaBookingId: each.tavaBookingId,
																		isCompleted: false,
																		refundAmount:
																			each.bookingJSON.journeyDetails[0].price.grandTotal.toString(),
																		source: each.provider,
																		createdAt: new Date().toISOString(),
																		updatedAt: new Date().toISOString(),
																		remarks:
																			timeoutRefundRequest?.internalOutput
																				?.input.res,
																		bookingId: each.id,
																		paymentId: each.paymentId,
																		currency:
																			timeoutRefundRequest?.params?.query
																				?.currency,
																	}
																}
																const refundQueue = await refundQueueMapper()
																const CreateSingleRefundQueueRecord = {
																	input: refundQueue,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const createdRecord =
																	await prisma.RefundQueue.create({
																		data: CreateSingleRefundQueueRecord.input,
																	})
																const ReturnSuccessResponse = {
																	created: createdRecord,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	internalOutput: internalOutput,
																}
																const updatedReturnSuccessRes = {
																	...ReturnSuccessResponse,
																}

																if (
																	updatedReturnSuccessRes?.output
																		?.responseType === 'xml'
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
															errorTrueExternalOutput = resultCheck

															return resultCheck
														}
													}
													const resultCheck = await checkResponse()
													timeoutExternalOutput = resultCheck

													return resultCheck
												}
											}
											const resultCheck = await checkResponse()
											tboLCCExternalOutput = resultCheck

											return resultCheck
										}
										const isTBONonLCC = {
											input: internalOutput,
											params: bookingRequest,
											secrets: process.env,
											headers,
										}
										let tboNonLCCExternalOutput
										if (!each.bookingJSON.journeyDetails[0].isLCC) {
											const checkResponse = async () => {
												const inputData = {
													...isTBONonLCC,
												}
												delete inputData.params
												delete inputData.secrets
												delete inputData.headers
												const internalOutput = inputData

												const tboBookRequest = {
													input: internalOutput,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}

												const tboBookMapper = async function () {
													const data = tboBookRequest
													const mapRequestBody = (input) => {
														input = input.input.bookingJSON.journeyDetails[0]
														const passengersDetails = input.travelerDetails.map(
															(item) => {
																const getDocumentDetails =
																	item.documents.find(
																		(document) =>
																			document.documentType
																				.toLowerCase()
																				.includes('student') ||
																			document.documentType
																				.toLowerCase()
																				.includes('senior') ||
																			document.documentType
																				.toLowerCase()
																				.includes('armed')
																	) || ''
																const { number, documentType } =
																	getDocumentDetails
																const passportDetails =
																	item.documents.find(
																		(document) =>
																			document.documentType === 'PASSPORT'
																	) || []
																const updatedPasengersDetails = {
																	Title: item.title,
																	FirstName: item.givenName,
																	LastName: item.familyName,
																	PaxType: {
																		ADULT: 1,
																		CHILD: 2,
																		INFANT: 3,
																	}[item.travelerType],
																	DocumentDetails: getDocumentDetails
																		? [
																				{
																					DocumentTypeId: documentType,
																					DocumentNumber: number,
																				},
																		  ]
																		: [],
																	DateOfBirth: moment(
																		item.dateOfBirth,
																		'YYYY-MM-DD HHmm'
																	).format('yyyy-MM-DD'),
																	Gender: {
																		male: 1,
																		female: 2,
																		MALE: 1,
																		FEMALE: 2,
																	}[item.gender],
																	PassportNo: passportDetails?.number,
																	PassportExpiry: passportDetails?.expiryDate
																		? moment(
																				passportDetails?.expiryDate,
																				'YYYY-MM-DD HHmm'
																		  ).format('yyyy-MM-DDTHH:mm:ss')
																		: '',
																	PassportIssueDate:
																		passportDetails?.issuanceDate
																			? moment(
																					passportDetails?.issuanceDate,
																					'YYYY-MM-DD HHmm'
																			  ).format('yyyy-MM-DDTHH:mm:ss')
																			: '',

																	Fare: item.Fare,
																	AddressLine1: item?.address || 'IN',
																	AddressLine2: item?.AddressLine1 || '',
																	City: item?.City || 'gurgaon',
																	CountryCode: item?.countryCode,
																	CountryName: item?.countryName,
																	CellCountryCode: item?.phoneCountryCode,
																	ContactNo: item?.phoneNumber?.replaceAll(
																		'+91',
																		''
																	),
																	Nationality: item?.nationality,
																	Email: item?.email,
																	IsLeadPax: item?.isPrimary,
																	FFAirlineCode: null,
																	FFNumber: item?.ffNumber || '',
																	GSTCompanyAddress:
																		item?.GSTCompanyAddress || '',
																	GSTCompanyContactNumber:
																		item?.GSTCompanyContactNumber || '',
																	GSTCompanyName: item?.GSTCompanyName || '',
																	GSTNumber: item?.GSTCompanyName || '',
																	GSTCompanyEmail: item?.GSTCompanyEmail || '',
																	Baggage: item?.Baggage || [],
																	MealDynamic: item?.MealDynamic || [],
																	SeatDynamic: item?.SeatDynamic || [],
																}
																const isEmpty = (value) =>
																	value == null ||
																	(Array.isArray(value)
																		? value.length === 0
																		: Object.keys(value).length === 0)
																;[
																	'Meal',
																	'MealDynamic',
																	'Seat',
																	'SeatDynamic',
																	'SeatPreference',
																].forEach((key) => {
																	if (!isEmpty(item[key]))
																		updatedPasengersDetails[key] = item[key]
																})
																return updatedPasengersDetails
															}
														)
														return {
															isLCC: input.isLCC,
															ResultIndex: input.ResultIndex,
															Passengers: passengersDetails,
															TokenId: input.TokenId,
															TraceId: input.TraceId,
															EndUserIp: input.EndUserIp,
														}
													}

													const bookRequest = mapRequestBody(data.input)

													tavaLogger(
														corelationId,
														'Request',
														`${data.secrets.TBO_BASE_URL}/Book?`,
														bookRequest,
														templateType
													)

													const callBook = async () => {
														try {
															const response = await axios.post(
																`${data.secrets.TBO_BASE_URL}/Book?`,
																bookRequest,
																{
																	headers: {},
																	timeout: 300000,
																}
															)
															tavaLogger(
																corelationId,
																'Response',
																`${data.secrets.TBO_BASE_URL}/Book?`,
																response,
																templateType
															)
															return response.data
														} catch (error) {
															console.log(
																'Error occurred in :  `${data.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/Book?`',
																error
															)
															if (error?.response || axios?.isCancel(error)) {
																tavaLogger(
																	corelationId,
																	'Error',
																	`${data.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/Book?`,
																	error,
																	templateType
																)
															} else {
																console.log('An error occurred', error)
																tavaLogger(
																	corelationId,
																	'Error',
																	`${data.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/Book?`,
																	error,
																	templateType
																)
															}
														}
													}

													const bookResponse = await callBook()
													if (bookResponse) {
														return bookResponse
													} else {
														console.log(
															'timeout of 300 sec exceeded - in /Book'
														)
														const data = {
															Response: {
																timeout: true,
																response: bookResponse,
															},
														}
														return data
													}
												}
												const tboBookResponse = await tboBookMapper()
												const bookErrorResponse = {
													input: tboBookResponse,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}
												let bookErrorExternalOutput
												if (
													bookErrorResponse.input.Response?.Error?.ErrorCode !==
														0 ||
													bookErrorResponse.input.Response?.timeout === true
												) {
													const checkResponse = async () => {
														const inputData = { ...bookErrorResponse }
														delete inputData.params
														delete inputData.secrets
														delete inputData.headers
														const internalOutput = inputData
														const UpdateRecordFields = {
															input: internalOutput,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														const parseInputData = (inputData) => {
															const regex =
																/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
															const formattedOutput = []
															let match
															while ((match = regex.exec(inputData)) !== null) {
																const [, key, value, operator] = match
																formattedOutput.push({ key, value, operator })
															}
															return formattedOutput
														}
														const formattedWhereQuery = `"id"='${each.id}'`
														const formattedSetQuery = `"status"= 'FAILED',"ticketingStatus"= 'NA'`
														const outputWhereData =
															parseInputData(formattedWhereQuery)
														const outputSetData =
															parseInputData(formattedSetQuery)

														let queryWhere = ''
														let querySet = ''
														let preOperatorWhere = ''

														outputWhereData.forEach((item) => {
															if (!item.value.includes('undefined')) {
																queryWhere += ` ${
																	queryWhere ? preOperatorWhere : ''
																} "${item.key}" = '${item.value}'`
															}
															preOperatorWhere = item.operator
														})
														outputSetData.forEach((item) => {
															if (!item.value.includes('undefined')) {
																querySet += `"${item.key}" = '${item.value}'`
															}
														})

														querySet = querySet.replaceAll(`'"`, `',"`)
														const updateBookingInfo =
															await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
															)}`

														const refundRequest = {
															updateInfo: updateBookingInfo,
															params: bookingRequest,
															secrets: process.env,
															headers,
															input: internalOutput,
														}

														const refundQueueData = async function () {
															return {
																tavaBookingId: each.tavaBookingId,
																isCompleted: false,
																refundAmount:
																	each.bookingJSON.journeyDetails[0].price.grandTotal.toString() ||
																	'',
																source: each.provider,
																updatedAt: new Date(),
																createdAt: new Date(),
																remarks: refundRequest.input,
																bookingId: each.id,
																paymentId: each.paymentId,
																currency:
																	refundRequest?.params?.query?.currency,
															}
														}
														const refundQueue = await refundQueueData()
														const CreateSingleRefundRecord = {
															input: refundQueue,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														const createdRecord =
															await prisma.RefundQueue.create({
																data: CreateSingleRefundRecord.input,
															})
														const ReturnSuccessResponse = {
															created: createdRecord,
															params: bookingRequest,
															secrets: process.env,
															headers,
															internalOutput: internalOutput,
														}
														const updatedReturnSuccessRes = {
															...ReturnSuccessResponse,
														}

														if (
															updatedReturnSuccessRes?.output?.responseType ===
															'xml'
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
													bookErrorExternalOutput = resultCheck

													return resultCheck
												}
												const bookSuccessfulResponse = {
													input: tboBookResponse,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}
												let bookSuccessfulExternalOutput
												if (
													bookSuccessfulResponse.input.Response?.Error
														?.ErrorCode === 0
												) {
													const checkResponse = async () => {
														const inputData = { ...bookSuccessfulResponse }
														delete inputData.params
														delete inputData.secrets
														delete inputData.headers
														const internalOutput = inputData

														const IsPriceChanged = {
															input: internalOutput.input,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														let IsPriceChangedExternalOutput
														if (
															IsPriceChanged.input.Response?.Response
																?.IsPriceChanged
														) {
															const checkResponse = async () => {
																const inputData = { ...IsPriceChanged }
																delete inputData.params
																delete inputData.secrets
																delete inputData.headers
																const internalOutput = inputData

																const IsPriceChangedResponse = {
																	input: internalOutput,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}

																const IsPriceChangedResponseMapper =
																	async function () {
																		const { IsPriceChanged } =
																			IsPriceChangedResponse.input.input
																				.Response.Response
																		return {
																			IsPriceChanged,
																			response:
																				IsPriceChangedResponse.input.input
																					.Response,
																		}
																	}
																const priceChangesResponse =
																	await IsPriceChangedResponseMapper()
																const UpdateRecordFields = {
																	input: priceChangesResponse,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const parseInputData = (inputData) => {
																	const regex =
																		/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																	const formattedResponse = []
																	let match
																	while (
																		(match = regex.exec(inputData)) !== null
																	) {
																		const [, key, value, operator] = match
																		formattedResponse.push({
																			key,
																			value,
																			operator,
																		})
																	}
																	return formattedResponse
																}
																const formattedWhereQuery = `"id"='${each.id}'`
																const formattedSetQuery = `"status"= 'FAILED',"ticketingStatus"= 'NA'`
																const outputWhereData =
																	parseInputData(formattedWhereQuery)
																const outputSetData =
																	parseInputData(formattedSetQuery)

																let queryWhere = ''
																let querySet = ''
																let preOperatorWhere = ''

																outputWhereData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		queryWhere += ` ${
																			queryWhere ? preOperatorWhere : ''
																		} "${item.key}" = '${item.value}'`
																	}
																	preOperatorWhere = item.operator
																})
																outputSetData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		querySet += `"${item.key}" = '${item.value}'`
																	}
																})

																querySet = querySet.replaceAll(`'"`, `',"`)
																const updateBookingInfo =
																	await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																		`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																	)}`
																const refundRequest = {
																	input: updateBookingInfo,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	output: priceChangesResponse,
																}

																const refundQueueMapper = async function () {
																	return {
																		tavaBookingId: each.tavaBookingId,
																		isCompleted: false,
																		refundAmount:
																			each.bookingJSON.journeyDetails[0].price.grandTotal.toString() ||
																			'',
																		source: each.provider,
																		updatedAt: new Date(),
																		createdAt: new Date(),
																		remarks: refundRequest?.output,
																		bookingId: each.id,
																		paymentId: each.paymentId,
																		currency:
																			refundRequest?.params?.query?.currency,
																	}
																}
																const refundQueue = await refundQueueMapper()
																const CreateSingleRefundRecord = {
																	input: refundQueue,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const createdRecord =
																	await prisma.RefundQueue.create({
																		data: CreateSingleRefundRecord.input,
																	})
																const ReturnSuccessResponse = {
																	output: priceChangesResponse,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	created: createdRecord,
																}
																const updatedReturnSuccessRes = {
																	...ReturnSuccessResponse,
																}

																if (
																	updatedReturnSuccessRes?.output
																		?.responseType === 'xml'
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
															IsPriceChangedExternalOutput = resultCheck

															return resultCheck
														}
														const IsPriceChangedFalse = {
															input: internalOutput.input,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														let priceChangedFalseExternalOutput
														if (
															!IsPriceChangedFalse.input.Response.Response
																.IsPriceChanged
														) {
															const checkResponse = async () => {
																const inputData = { ...IsPriceChangedFalse }
																delete inputData.params
																delete inputData.secrets
																delete inputData.headers
																const internalOutput = inputData

																const tboBookingRequest = {
																	input: internalOutput,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}

																const mapBookingData = async function () {
																	const returnRequest = async (input) => {
																		input = JSON.parse(
																			JSON.stringify(input).replaceAll("'", '')
																		)
																		if (input.Response.ResponseStatus === 1) {
																			const ticketingRequest = {
																				EndUserIp:
																					each.bookingJSON.journeyDetails[0]
																						.EndUserIp,
																				TokenId:
																					each.bookingJSON.journeyDetails[0]
																						.TokenId,
																				TraceId: input.Response.TraceId,
																				PNR: input.Response.Response.PNR,
																				BookingId:
																					input.Response.Response.BookingId.toString(),
																			}
																			return {
																				id: each.id,
																				bookingJSON: JSON.stringify({
																					journeyDetails:
																						each.bookingJSON.journeyDetails,
																					bookingResponse:
																						input.Response.Response,
																					paymentRequest:
																						each.bookingJSON.paymentRequest,
																				}),
																				ticketingJSON: JSON.stringify({
																					ticketingRequest,
																					ticketingResponse: {},
																				}),
																				bookResponse: input.Response.Response,
																				updatedAt: new Date().toISOString(),
																			}
																		} else {
																			throw new Error(
																				`${input.Response.Error.ErrorMessage}`
																			)
																		}
																	}

																	return returnRequest(
																		tboBookingRequest.input.input
																	)
																}
																const bookRequest = await mapBookingData()
																const UpdateBookingRecordFields = {
																	input: bookRequest,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const parseInputData = (inputData) => {
																	const regex =
																		/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																	const FormattedOutput = []
																	let match
																	while (
																		(match = regex.exec(inputData)) !== null
																	) {
																		const [, key, value, operator] = match
																		FormattedOutput.push({
																			key,
																			value,
																			operator,
																		})
																	}
																	return FormattedOutput
																}
																const formattedWhereQuery = `"id"='${UpdateBookingRecordFields.input.id}'`
																const formattedSetQuery = `"bookingJSON"= '${UpdateBookingRecordFields.input.bookingJSON}',"ticketingJSON"= '${UpdateBookingRecordFields.input.ticketingJSON}',"pnr"= '${UpdateBookingRecordFields.input.bookResponse.PNR}',"updatedAt"= '${UpdateBookingRecordFields.input.updatedAt}',"providerBookingId"= '${UpdateBookingRecordFields.input.bookResponse.BookingId}',"status"= 'SUCCESS',"ticketingStatus"= 'NA'`
																const outputWhereData =
																	parseInputData(formattedWhereQuery)
																const outputSetData =
																	parseInputData(formattedSetQuery)

																let queryWhere = ''
																let querySet = ''
																let preOperatorWhere = ''

																outputWhereData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		queryWhere += ` ${
																			queryWhere ? preOperatorWhere : ''
																		} "${item.key}" = '${item.value}'`
																	}
																	preOperatorWhere = item.operator
																})
																outputSetData.forEach((item) => {
																	if (!item.value.includes('undefined')) {
																		querySet += `"${item.key}" = '${item.value}'`
																	}
																})

																querySet = querySet.replaceAll(`'"`, `',"`)
																const updateBookingInfo =
																	await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																		`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																	)}`
																const GetBookingSingleRecordbyId = {
																	updateInfo: updateBookingInfo,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	input: bookRequest,
																}
																const bookingTableOutput =
																	await prisma.Booking.findUnique({
																		where: {
																			id: GetBookingSingleRecordbyId.input.id,
																		},
																	})
																const ticketRequest = {
																	input: bookingTableOutput,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}

																const callTBOTicket = async function () {
																	const data = ticketRequest

																	try {
																		const ticketResponse =
																			await callTBOTicketAPI(
																				corelationId,
																				data.input.ticketingJSON
																					.ticketingRequest,
																				templateType,
																				data
																			)
																		if (ticketResponse) {
																			return ticketResponse
																		} else {
																			console.log(
																				'timeout of 300 sec exceeded - /Ticket'
																			)
																			const getbookingDetailsRequest = {
																				EndUserIp:
																					data.input.ticketingJSON
																						.ticketingRequest.EndUserIp,

																				TokenId:
																					data.input.ticketingJSON
																						.ticketingRequest.TokenId,
																				TraceId:
																					data.input.ticketingJSON
																						.ticketingRequest.TraceId,
																			}

																			return new Promise(async (resolve) => {
																				let count = 0
																				let intervalId

																				intervalId = setInterval(async () => {
																					console.log(count)
																					const getBookingResponse =
																						await callGetBookingDetailsAPI(
																							corelationId,
																							getbookingDetailsRequest,
																							templateType,
																							data
																						)
																					if (
																						getBookingResponse?.Response?.Error
																							?.ErrorCode === 0
																					) {
																						clearInterval(intervalId)
																						const data = {
																							Response: {
																								timeout: true,
																								response: getBookingResponse,
																							},
																						}
																						resolve(data)
																					}

																					count++

																					if (count >= 10) {
																						clearInterval(intervalId)
																						const data = {
																							Response: {
																								timeout: true,
																								response: getBookingResponse,
																							},
																						}
																						resolve(data)
																					}
																				}, 10000)
																			})
																		}
																	} catch (error) {
																		console.error(
																			'Error in fetching data',
																			error
																		)
																	}
																}
																const tboTicketResponse = await callTBOTicket()

																const ticketErrorResponse = {
																	input: tboTicketResponse,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	output: bookingTableOutput,
																}
																let ticketErrorExtenalOutput
																if (
																	ticketErrorResponse.input.Response?.Error
																		?.ErrorCode !== 0 &&
																	ticketErrorResponse.input.Response?.timeout !=
																		true
																) {
																	const checkResponse = async () => {
																		const inputData = {
																			...ticketErrorResponse,
																		}
																		delete inputData.params
																		delete inputData.secrets
																		delete inputData.headers
																		const internalOutput = inputData
																		const UpdateBookingRecordFields = {
																			input: internalOutput,
																			params: bookingRequest,
																			secrets: process.env,
																			headers,
																		}
																		const parseInputData = (inputData) => {
																			const regex =
																				/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																			const formattedOutput = []
																			let match
																			while (
																				(match = regex.exec(inputData)) !== null
																			) {
																				const [, key, value, operator] = match
																				formattedOutput.push({
																					key,
																					value,
																					operator,
																				})
																			}
																			return formattedOutput
																		}
																		const formattedWhereQuery = `"id"='${each.id}'`
																		const formattedSetQuery = `"ticketingStatus"= 'FAILED'`
																		const outputWhereData =
																			parseInputData(formattedWhereQuery)
																		const outputSetData =
																			parseInputData(formattedSetQuery)

																		let queryWhere = ''
																		let querySet = ''
																		let preOperatorWhere = ''

																		outputWhereData.forEach((item) => {
																			if (!item.value.includes('undefined')) {
																				queryWhere += ` ${
																					queryWhere ? preOperatorWhere : ''
																				} "${item.key}" = '${item.value}'`
																			}
																			preOperatorWhere = item.operator
																		})
																		outputSetData.forEach((item) => {
																			if (!item.value.includes('undefined')) {
																				querySet += `"${item.key}" = '${item.value}'`
																			}
																		})

																		querySet = querySet.replaceAll(`'"`, `',"`)
																		const updateBookingInfo =
																			await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																				`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																			)}`
																		const CancelRequest = {
																			updateInfo: updateBookingInfo,
																			params: bookingRequest,
																			secrets: process.env,
																			headers,
																			input: internalOutput,
																		}

																		const createCancelRequest =
																			async function () {
																				const data = CancelRequest.input.output
																				const pnr = data.pnr
																				const body = {
																					PNR: [pnr],
																					remark: CancelRequest?.input,
																				}
																				return body
																			}
																		const flightCancelRequest =
																			await createCancelRequest()
																		const CallCancelRESTAPIEndpoint = {
																			input: flightCancelRequest,
																			params: bookingRequest,
																			secrets: process.env,
																			headers,
																		}

																		const flightCancelResponse =
																			await flightCancel(
																				corelationId,
																				CallCancelRESTAPIEndpoint,
																				templateType
																			)

																		const ReturnSuccessResponse = {
																			output: flightCancelResponse,
																			params: bookingRequest,
																			secrets: process.env,
																			headers,
																		}
																		const updatedReturnSuccessRes = {
																			...ReturnSuccessResponse,
																		}

																		if (
																			updatedReturnSuccessRes?.output
																				?.responseType === 'xml'
																		) {
																			delete updatedReturnSuccessRes.headers
																			return res
																				.set('Content-Type', 'application/xml')
																				.send(
																					updatedReturnSuccessRes.output.data
																				)
																		}

																		delete updatedReturnSuccessRes.params
																		delete updatedReturnSuccessRes.secrets
																		delete updatedReturnSuccessRes.headers

																		if (
																			Object.keys(updatedReturnSuccessRes)
																				.length ||
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
																	ticketErrorExtenalOutput = resultCheck

																	return resultCheck
																}
																const ticketSuccessResponse = {
																	input: tboTicketResponse,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	output: bookingTableOutput,
																}
																let ticketSuccessExternalOutput
																if (
																	ticketSuccessResponse.input.Response?.Error
																		?.ErrorCode === 0 &&
																	ticketSuccessResponse.input.Response
																		?.timeout != true
																) {
																	const checkResponse = async () => {
																		const inputData = {
																			...ticketSuccessResponse,
																		}
																		delete inputData.params
																		delete inputData.secrets
																		delete inputData.headers
																		const internalOutput = inputData

																		const IsPriceChangedTrue = {
																			input: internalOutput.input,
																			params: bookingRequest,
																			secrets: process.env,
																			headers,
																			internalOutput: internalOutput,
																		}
																		let IsPriceChangedTrueExternalOutput
																		if (
																			IsPriceChangedTrue.input.Response
																				?.Response?.IsPriceChanged
																		) {
																			const checkResponse = async () => {
																				const inputData = {
																					...IsPriceChangedTrue,
																				}
																				delete inputData.params
																				delete inputData.secrets
																				delete inputData.headers
																				const internalOutput = inputData
																				const priceChangeRequest = {
																					input: internalOutput,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}

																				const priceChangeResponseMap =
																					async function () {
																						const { IsPriceChanged } =
																							priceChangeRequest.input.input
																								.Response.Response
																						return {
																							IsPriceChanged,
																							response:
																								priceChangeRequest.input.input
																									.Response,
																						}
																					}
																				const priceChangeResponse =
																					await priceChangeResponseMap()

																				const CancelRequest = {
																					output: priceChangeResponse,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																					input: internalOutput,
																				}

																				const createCancelRequest =
																					async function () {
																						const pnr =
																							CancelRequest?.output?.response
																								?.Response?.PNR ||
																							CancelRequest?.input
																								?.internalOutput?.output?.pnr
																						const body = {
																							PNR: [pnr],
																							remark: CancelRequest?.output,
																						}
																						return body
																					}
																				const flightCancelRequest =
																					await createCancelRequest()
																				const CallCancelRESTAPIEndpoint = {
																					input: flightCancelRequest,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}

																				let cancelResponse = await flightCancel(
																					corelationId,
																					CallCancelRESTAPIEndpoint,
																					templateType
																				)

																				const ReturnSuccessResponse = {
																					output1: priceChangeResponse,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																					output: cancelResponse,
																				}
																				const updatedReturnSuccessRes = {
																					...ReturnSuccessResponse,
																				}

																				if (
																					updatedReturnSuccessRes?.output
																						?.responseType === 'xml'
																				) {
																					delete updatedReturnSuccessRes.headers
																					return res
																						.set(
																							'Content-Type',
																							'application/xml'
																						)
																						.send(
																							updatedReturnSuccessRes.output
																								.data
																						)
																				}

																				delete updatedReturnSuccessRes.params
																				delete updatedReturnSuccessRes.secrets
																				delete updatedReturnSuccessRes.headers

																				if (
																					Object.keys(updatedReturnSuccessRes)
																						.length ||
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
																			IsPriceChangedTrueExternalOutput =
																				resultCheck

																			return resultCheck
																		}
																		const IsPriceChangedFalse = {
																			input: internalOutput.input,
																			params: bookingRequest,
																			secrets: process.env,
																			headers,
																		}
																		let IsPriceChangedFalseExternalOutput
																		if (
																			!IsPriceChangedFalse.input.Response
																				?.Response?.IsPriceChanged
																		) {
																			const checkResponse = async () => {
																				const inputData = {
																					...IsPriceChangedFalse,
																				}
																				delete inputData.params
																				delete inputData.secrets
																				delete inputData.headers
																				const internalOutput = inputData

																				const tboTicketResponse = {
																					input: internalOutput,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}

																				const bookingDataMapper =
																					async function () {
																						const bookingData = each
																						const tavaId = each.tavaBookingId
																						const tboTicketRes = JSON.parse(
																							JSON.stringify(
																								tboTicketResponse.input.input
																									.Response
																							).replaceAll("'", '')
																						)

																						function responseMapper(input) {
																							let ticketingFinalRes = {
																								ticketingRequest:
																									bookingData.ticketingJSON,
																								ticketingResponse:
																									tboTicketRes?.Response,
																							}
																							ticketingFinalRes =
																								JSON.stringify(
																									ticketingFinalRes
																								)
																							const ticketStatus =
																								tboTicketRes?.Response
																									?.FlightItinerary?.Status ===
																								5
																									? 'CONFIRMED'
																									: 'FAILED'
																							const bookingStatus =
																								tboTicketRes?.Response
																									?.FlightItinerary?.Status ===
																								5
																									? 'CONFIRMED'
																									: 'FAILED'
																							const failureReason =
																								tboTicketRes?.Error
																							// need to add name logic
																							return {
																								result: {
																									bookingId:
																										tboTicketRes?.Response
																											?.FlightItinerary
																											?.BookingId,
																									PNR: tboTicketRes?.Response
																										?.FlightItinerary?.PNR,
																									status: ticketStatus,
																									createdAt:
																										bookingData.createdAt,
																									bookingStatus,
																									failureReason,
																								},
																								config: {
																									id: bookingData.id,
																									providerBookingId:
																										bookingData.providerBookingId,
																									ticketingJson:
																										ticketingFinalRes,
																									tavaBookingId: tavaId,
																									userEmail:
																										bookingData.userEmail ||
																										bookingData?.bookingJSON
																											?.journeyDetails[0]
																											.travelerDetails[0].email,
																								},
																							}
																						}
																						return responseMapper()
																					}
																				const bookindData =
																					await bookingDataMapper()
																				const UpdateBookingRecordFields = {
																					input: bookindData,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}
																				const parseInputData = (inputData) => {
																					const regex =
																						/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																					const formattedOutput = []
																					let match
																					while (
																						(match = regex.exec(inputData)) !==
																						null
																					) {
																						const [, key, value, operator] =
																							match
																						formattedOutput.push({
																							key,
																							value,
																							operator,
																						})
																					}
																					return formattedOutput
																				}
																				const formattedWhereQuery = `"id"='${UpdateBookingRecordFields.input.config.id}'`
																				const formattedSetQuery = `"pnr"= '${UpdateBookingRecordFields.input.result.PNR}',"ticketingJSON"= '${UpdateBookingRecordFields.input.config.ticketingJson}',"ticketingStatus"= 'CONFIRMED',"providerBookingId"= '${UpdateBookingRecordFields.input.result.bookingId}',"status"= 'CONFIRMED'`
																				const outputWhereData =
																					parseInputData(formattedWhereQuery)
																				const outputSetData =
																					parseInputData(formattedSetQuery)

																				let queryWhere = ''
																				let querySet = ''
																				let preOperatorWhere = ''

																				outputWhereData.forEach((item) => {
																					if (
																						!item.value.includes('undefined')
																					) {
																						queryWhere += ` ${
																							queryWhere ? preOperatorWhere : ''
																						} "${item.key}" = '${item.value}'`
																					}
																					preOperatorWhere = item.operator
																				})
																				outputSetData.forEach((item) => {
																					if (
																						!item.value.includes('undefined')
																					) {
																						querySet += `"${item.key}" = '${item.value}'`
																					}
																				})

																				querySet = querySet.replaceAll(
																					`'"`,
																					`',"`
																				)
																				const updateBookingInfo =
																					await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																						`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																					)}`
																				const ReturnSuccessResponse = {
																					output: bookindData,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}
																				const updatedReturnSuccessRes = {
																					...ReturnSuccessResponse,
																				}

																				if (
																					updatedReturnSuccessRes?.output
																						?.responseType === 'xml'
																				) {
																					delete updatedReturnSuccessRes.headers
																					return res
																						.set(
																							'Content-Type',
																							'application/xml'
																						)
																						.send(
																							updatedReturnSuccessRes.output
																								.data
																						)
																				}

																				delete updatedReturnSuccessRes.params
																				delete updatedReturnSuccessRes.secrets
																				delete updatedReturnSuccessRes.headers

																				if (
																					Object.keys(updatedReturnSuccessRes)
																						.length ||
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
																			IsPriceChangedFalseExternalOutput =
																				resultCheck

																			return resultCheck
																		}
																	}
																	const resultCheck = await checkResponse()
																	ticketSuccessExternalOutput = resultCheck

																	return resultCheck
																}
																const IfTimeoutTrue = {
																	input: tboTicketResponse,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																	output: bookingTableOutput,
																}
																let timeoutTrueExternalOutput
																if (
																	IfTimeoutTrue.input.Response?.timeout === true
																) {
																	const checkResponse = async () => {
																		const inputData = {
																			...IfTimeoutTrue,
																		}
																		delete inputData.params
																		delete inputData.secrets
																		delete inputData.headers
																		const internalOutput = inputData

																		const TicketFail = {
																			input: internalOutput.input?.Response,
																			params: bookingRequest,
																			secrets: process.env,
																			headers,
																			internalOutput: internalOutput,
																		}
																		let TicketFailExternalOutput
																		if (
																			!(
																				TicketFail.input.response?.Response
																					?.FlightItinerary?.Passenger &&
																				TicketFail.input.response?.Response
																					?.FlightItinerary?.Passenger[0]
																					?.Ticket
																			)
																		) {
																			const checkResponse = async () => {
																				const inputData = {
																					...TicketFail,
																				}
																				delete inputData.params
																				delete inputData.secrets
																				delete inputData.headers
																				const internalOutput = inputData
																				const UpdateRecordFieldsbyQuery = {
																					input: internalOutput,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}
																				const parseInputData = (inputData) => {
																					const regex =
																						/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																					const formattedResponse = []
																					let match
																					while (
																						(match = regex.exec(inputData)) !==
																						null
																					) {
																						const [, key, value, operator] =
																							match
																						formattedResponse.push({
																							key,
																							value,
																							operator,
																						})
																					}
																					return formattedResponse
																				}
																				const formattedWhereQuery = `"id"='${each.id}'`
																				const formattedSetQuery = `"ticketingStatus"= 'FAILED'`
																				const outputWhereData =
																					parseInputData(formattedWhereQuery)
																				const outputSetData =
																					parseInputData(formattedSetQuery)

																				let queryWhere = ''
																				let querySet = ''
																				let preOperatorWhere = ''

																				outputWhereData.forEach((item) => {
																					if (
																						!item.value.includes('undefined')
																					) {
																						queryWhere += ` ${
																							queryWhere ? preOperatorWhere : ''
																						} "${item.key}" = '${item.value}'`
																					}
																					preOperatorWhere = item.operator
																				})
																				outputSetData.forEach((item) => {
																					if (
																						!item.value.includes('undefined')
																					) {
																						querySet += `"${item.key}" = '${item.value}'`
																					}
																				})

																				querySet = querySet.replaceAll(
																					`'"`,
																					`',"`
																				)
																				const updateBookingInfo =
																					await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																						`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																					)}`

																				const TBOCancelRequest = {
																					updateInfo: updateBookingInfo,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																					input: internalOutput,
																				}

																				const createCancelRequest =
																					async function () {
																						const pnr =
																							TBOCancelRequest?.input?.input
																								?.response?.Response
																								?.FlightItinerary?.PNR ||
																							TBOCancelRequest?.input
																								?.internalOutput?.output?.pnr
																						const body = {
																							PNR: [pnr],
																							remark:
																								TBOCancelRequest?.input?.input
																									?.response?.Response,
																						}
																						return body
																					}
																				const cancelRequest =
																					await createCancelRequest()
																				const CallCancelRESTAPIEndpoint = {
																					input: cancelRequest,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}

																				let cancelResponse = await flightCancel(
																					corelationId,
																					CallCancelRESTAPIEndpoint,
																					templateType
																				)

																				const ReturnSuccessResponse = {
																					output: cancelResponse,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}
																				const updatedReturnSuccessRes = {
																					...ReturnSuccessResponse,
																				}

																				if (
																					updatedReturnSuccessRes?.output
																						?.responseType === 'xml'
																				) {
																					delete updatedReturnSuccessRes.headers
																					return res
																						.set(
																							'Content-Type',
																							'application/xml'
																						)
																						.send(
																							updatedReturnSuccessRes.output
																								.data
																						)
																				}

																				delete updatedReturnSuccessRes.params
																				delete updatedReturnSuccessRes.secrets
																				delete updatedReturnSuccessRes.headers

																				if (
																					Object.keys(updatedReturnSuccessRes)
																						.length ||
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
																			TicketFailExternalOutput = resultCheck

																			return resultCheck
																		}
																		const TicketPass = {
																			input: internalOutput.input?.Response,
																			params: bookingRequest,
																			secrets: process.env,
																			headers,
																		}
																		let TicketPassExternalOutput
																		if (
																			TicketPass.input.response?.Response
																				?.FlightItinerary.Passenger &&
																			TicketPass.input.response?.Response
																				?.FlightItinerary?.Passenger[0]?.Ticket
																		) {
																			const checkResponse = async () => {
																				const inputData = {
																					...TicketPass,
																				}
																				delete inputData.params
																				delete inputData.secrets
																				delete inputData.headers
																				const internalOutput = inputData

																				const tboTimeoutTicketResponse = {
																					input: internalOutput,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}

																				const bookingDataMapper =
																					async function () {
																						const bookingData =
																							tboTimeoutTicketResponse.input
																								?.input?.response?.Response ||
																							tboTimeoutTicketResponse.input
																								?.input?.Response
																						const getBookingDetailsResponse =
																							JSON.parse(
																								JSON.stringify(
																									bookingData
																								).replaceAll("'", '')
																							)

																						function responseMapper() {
																							return {
																								dbData: {
																									result: {
																										bookingId:
																											bookingData
																												?.FlightItinerary
																												?.BookingId,
																										PNR: bookingData
																											?.FlightItinerary.PNR,
																										status: 'CONFIRMED',
																										updatedAt:
																											new Date().toISOString(),
																										ticketingStatus:
																											'CONFIRMED',
																									},
																									config: {
																										id: each.id,
																										providerBookingId:
																											bookingData
																												?.FlightItinerary
																												?.BookingId,
																										ticketingJson:
																											JSON.stringify(
																												getBookingDetailsResponse
																											),
																										tavaBookingId:
																											each?.tavaBookingId,
																										userEmail:
																											each?.bookingJSON
																												?.journeyDetails[0]
																												.travelerDetails[0]
																												.email,
																										timeout: true,
																									},
																								},
																							}
																						}

																						return responseMapper()
																					}
																				const bookindData =
																					await bookingDataMapper()
																				const UpdateBookingRecordFields = {
																					input: bookindData,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}
																				const parseInputData = (inputData) => {
																					const regex =
																						/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
																					const formattedResponse = []
																					let match
																					while (
																						(match = regex.exec(inputData)) !==
																						null
																					) {
																						const [, key, value, operator] =
																							match
																						formattedResponse.push({
																							key,
																							value,
																							operator,
																						})
																					}
																					return formattedResponse
																				}
																				const formattedWhereQuery = `"id"='${each.id}'`
																				const formattedSetQuery = `"pnr"= '${UpdateBookingRecordFields.input.dbData.result.PNR}',"status"= '${UpdateBookingRecordFields.input.dbData.result.status}',"ticketingStatus"= '${UpdateBookingRecordFields.input.dbData.result.ticketingStatus}',"ticketingJSON"= '${UpdateBookingRecordFields.input.dbData.config.ticketingJson}',"providerBookingId"= '${UpdateBookingRecordFields.input.dbData.config.providerBookingId}'`
																				const outputWhereData =
																					parseInputData(formattedWhereQuery)
																				const outputSetData =
																					parseInputData(formattedSetQuery)

																				let queryWhere = ''
																				let querySet = ''
																				let preOperatorWhere = ''

																				outputWhereData.forEach((item) => {
																					if (
																						!item.value.includes('undefined')
																					) {
																						queryWhere += ` ${
																							queryWhere ? preOperatorWhere : ''
																						} "${item.key}" = '${item.value}'`
																					}
																					preOperatorWhere = item.operator
																				})
																				outputSetData.forEach((item) => {
																					if (
																						!item.value.includes('undefined')
																					) {
																						querySet += `"${item.key}" = '${item.value}'`
																					}
																				})

																				querySet = querySet.replaceAll(
																					`'"`,
																					`',"`
																				)
																				const updateBookingInfo =
																					await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
																						`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
																					)}`
																				const ReturnSuccessResponse = {
																					output: bookindData,
																					params: bookingRequest,
																					secrets: process.env,
																					headers,
																				}
																				const updatedReturnSuccessRes = {
																					...ReturnSuccessResponse,
																				}

																				if (
																					updatedReturnSuccessRes?.output
																						?.responseType === 'xml'
																				) {
																					delete updatedReturnSuccessRes.headers
																					return res
																						.set(
																							'Content-Type',
																							'application/xml'
																						)
																						.send(
																							updatedReturnSuccessRes.output
																								.data
																						)
																				}

																				delete updatedReturnSuccessRes.params
																				delete updatedReturnSuccessRes.secrets
																				delete updatedReturnSuccessRes.headers

																				if (
																					Object.keys(updatedReturnSuccessRes)
																						.length ||
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
																			TicketPassExternalOutput = resultCheck

																			return resultCheck
																		}
																	}
																	const resultCheck = await checkResponse()
																	timeoutTrueExternalOutput = resultCheck

																	return resultCheck
																}
															}
															const resultCheck = await checkResponse()
															priceChangedFalseExternalOutput = resultCheck

															return resultCheck
														}
													}
													const resultCheck = await checkResponse()
													bookSuccessfulExternalOutput = resultCheck

													return resultCheck
												}
											}
											const resultCheck = await checkResponse()
											tboNonLCCExternalOutput = resultCheck

											return resultCheck
										}
									}
									const resultCheck = await checkResponse()
									tboBookingResponse.push(resultCheck)
								}

								const tboMapResponse = {
									input: tboBookingResponse,
									params: bookingRequest,
									secrets: process.env,
									headers,
								}

								const checkBookingConfirm = async function () {
									const data = tboMapResponse.input

									if (data && data[0]?.output?.dbData?.config?.timeout) {
										const bookings = {
											response: {
												timeout: true,
												res: data,
											},
										}
										return bookings
									}

									const isSuccessful = data.every((item) => {
										const response = item?.output?.result
										return (
											response?.status === 'CONFIRMED' &&
											response?.bookingStatus === 'CONFIRMED'
										)
									})

									if (!isSuccessful) {
										const bookings = {
											response: {
												error: true,
												res: data,
											},
										}
										return bookings
									} else {
										const len = data.length
										let ticketingData = []
										let allTicketStatusCheck = true
										let allPnr = ''
										let passengerDetails = ''
										let invoiceAmount = 0
										let name = ''
										let segments = ''
										let userEmail = data[0].output.config.userEmail
										let bookingDate = data[0].output.result.createdAt
										let rules = ''
										for (let i = 0; i < len; i++) {
											const allData = data[i].output
											const ticketingDetails = JSON.parse(
												allData.config.ticketingJson
											)
											ticketingData.push(ticketingDetails.ticketingResponse)
											if (allData.result.status !== 'CONFIRMED') {
												allTicketStatusCheck = false
											}
											if (i < len - 1) {
												allPnr += allPnr += allData.result.PNR + ' & '
											} else {
												allPnr += allData.result.PNR
											}
											if (i === 0) {
												const paxDetails =
													ticketingDetails.ticketingResponse.FlightItinerary
														.Passenger
												name =
													paxDetails[0].Title + ' ' + paxDetails[0].FirstName
												for (let k = 0; k < paxDetails.length; k++) {
													let gender = ''
													if (paxDetails[k].Gender === 1) {
														gender = 'Male'
													} else if (paxDetails[k].Gender === 2) {
														gender = 'Female'
													} else {
														gender = 'Other'
													}
													passengerDetails +=
														paxDetails[k].Title +
														' ' +
														paxDetails[k].FirstName +
														' ' +
														paxDetails[k].LastName +
														' ' +
														'(' +
														gender +
														')' +
														'\n'
												}
											}
											invoiceAmount += parseInt(
												ticketingDetails.ticketingResponse.FlightItinerary
													.InvoiceAmount
											)
											segments =
												ticketingDetails.ticketingResponse.FlightItinerary
													.Segments
											let ruleArray =
												ticketingDetails.ticketingResponse.FlightItinerary
													.MiniFareRules ||
												ticketingDetails.ticketingResponse.FlightItinerary
													.FareRules
											let journeyPointMap = new Map()
											for (let k = 0; k < ruleArray.length; k++) {
												if (!journeyPointMap.has(ruleArray[k].JourneyPoints)) {
													journeyPointMap.set(ruleArray[k].JourneyPoints, {
														reissueRules: 'REISSUE/CHANGE FEE : ',
														cancellationRules: 'CANCELLATION FEE : ',
													})
												}
												let editableEntity = journeyPointMap.get(
													ruleArray[k].JourneyPoints
												)
												if (ruleArray[k].Type === 'Reissue') {
													editableEntity.reissueRules +=
														ruleArray[k].Details +
														' from ' +
														ruleArray[k].From +
														' ' +
														ruleArray[k].Unit +
														' '
													ruleArray[k].To
														? (editableEntity.reissueRules +=
																' to ' +
																ruleArray[k].To +
																' ' +
																ruleArray[k].Unit +
																'. ')
														: (editableEntity.reissueRules += 'and before. ')
												} else if (ruleArray[k].Type === 'Cancellation') {
													editableEntity.cancellationRules +=
														ruleArray[k].Details +
														' from ' +
														ruleArray[k].From +
														' ' +
														ruleArray[k].Unit +
														' '
													ruleArray[k].To
														? (editableEntity.cancellationRules +=
																' to ' +
																ruleArray[k].To +
																' ' +
																ruleArray[k].Unit +
																'. ')
														: (editableEntity.cancellationRules +=
																'and before. ')
												}
												journeyPointMap.set(
													ruleArray[k].JourneyPoints,
													editableEntity
												)
											}
											journeyPointMap.forEach((value, key) => {
												rules +=
													'<< ' +
													key +
													' >>' +
													' : ' +
													value.reissueRules +
													value.cancellationRules
											})
											if (rules.includes('from  and before.')) {
												rules.replace(/from  and before./g, '')
											}
										}
										return {
											response: {
												name: name,
												passengerDetails: passengerDetails,
												invoiceAmount: invoiceAmount,
												allPnr: allPnr,
												bookingDate: bookingDate,
												userEmail: userEmail,
												allTicketStatus: allTicketStatusCheck,
												fareRules: rules,
												ticketData: ticketingData,
												tavaBookingId:
													data[0].created?.tavaBookingId ||
													data[0].output.config.tavaBookingId,
											},
											eventData: {
												startDate: moment(segments[0].Origin.DepTime).format(
													'YYYYMMDDTHHmmss'
												),
												endDate: moment(
													segments[segments.length - 1].Destination.ArrTime
												).format('YYYYMMDDTHHmmss'),
												location: segments[0].Origin.Airport.CityName,
											},
										}
									}
								}
								const tboFinalBookingResponse = await checkBookingConfirm()

								const AllTicketPass = {
									input: tboFinalBookingResponse,
									params: bookingRequest,
									secrets: process.env,
									headers,
								}
								let AllTicketPassExternalOutput
								if (AllTicketPass.input.response?.allTicketStatus) {
									const checkResponse = async () => {
										const inputData = {
											...AllTicketPass,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput = inputData
										const AllTicketRequest = {
											input: internalOutput,
											params: bookingRequest,
											secrets: process.env,
											headers,
										}

										const mapPNRs = async function () {
											const ticketData =
												AllTicketRequest.input.input.response.ticketData
											let allPnr = []
											for (let t = 0; t < ticketData.length; t++) {
												allPnr[t] = ticketData[t].PNR
											}
											return allPnr
										}
										const pnrs = await mapPNRs()
										const pnrMap = {
											input: pnrs,
											params: bookingRequest,
											secrets: process.env,
											headers,
										}
										const pnrMapExternalOutput = []
										for (let each of pnrMap.input) {
											const internalOutput = each
											const checkResponse = async () => {
												const GetMultiRecordsAndCountbyQuery = {
													input: internalOutput,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}
												const parseInputData = (inputData) => {
													const regex =
														/"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
													const formattedResponse = []
													let match
													while ((match = regex.exec(inputData)) !== null) {
														const [, key, value, operator] = match
														formattedResponse.push({
															key,
															value,
															operator,
														})
													}
													return formattedResponse
												}
												const formattedQuery = `"pnr" = '${GetMultiRecordsAndCountbyQuery.input}'`
												const outputData = parseInputData(formattedQuery)
												let query = ''
												let preOperator = ''
												outputData.forEach((item) => {
													if (!item.value.includes('undefined')) {
														query += ` ${query ? preOperator : ''} "${
															item.key
														}" = '${item.value}'`
													}
													preOperator = item.operator
												})
												const isFormattedQueryExist = query
													? `WHERE ${query}`
													: ''
												const sortObj = []
												let sortObjExp = ''
												if (sortObj.length) {
													const orderByClause = sortObj
														.map((order) => {
															const [key, value] = Object.entries(order)[0]
															return `"${key}" ${value.toUpperCase()}`
														})
														.join(', ')
													sortObjExp = `ORDER BY ${orderByClause}`
												}
												const size = 20 || 10
												const page = 1 || 1
												const skip = (page - 1) * size
												const getBookingMultiRecordsAndCount =
													await prisma.$queryRawUnsafe(
														`SELECT * FROM "Booking" ${isFormattedQueryExist} ${sortObjExp} LIMIT ${size} OFFSET ${skip};`
													)
												let rowsCount = await prisma.$queryRawUnsafe(
													`SELECT count(*) from "Booking" ${isFormattedQueryExist}`
												)
												rowsCount = Number(rowsCount[0].count)
												const { bookingResults, countInfo } = {
													countInfo: {
														count: rowsCount,
														totalPage: Math.ceil(rowsCount / size),
														currentPage: page,
														size: size,
													},
													bookingResults: getBookingMultiRecordsAndCount,
												}
												const bookingTableResults = {
													input: bookingResults,
													params: bookingRequest,
													secrets: process.env,
													headers,
													countInfo: countInfo,
												}

												const createGetBoookingDetailRequest =
													async function () {
														const rawData = bookingTableResults.input
														const data = rawData[0]
														return {
															EndUserIp:
																data.ticketingJSON.ticketingRequest.EndUserIp,
															TokenId:
																data.ticketingJSON.ticketingRequest.TokenId,
															TraceId:
																data.ticketingJSON.ticketingRequest.TraceId,
															PNR: data.pnr,
														}
													}
												const getBoookingDetailRequest =
													await createGetBoookingDetailRequest()
												const CallGetBookingDetailRESTAPI = {
													input: getBoookingDetailRequest,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}

												let getBookingDetailResponse =
													await callGetBookingDetailsAPI(
														corelationId,
														CallGetBookingDetailRESTAPI.input,
														templateType,
														CallGetBookingDetailRESTAPI
													)

												const ReturnSuccessResponse = {
													output: getBookingDetailResponse,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}
												const updatedReturnSuccessRes = {
													...ReturnSuccessResponse,
												}

												if (
													updatedReturnSuccessRes?.output?.responseType ===
													'xml'
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
											pnrMapExternalOutput.push(resultCheck)
										}
										const PNRMapResponse = {
											input: pnrMapExternalOutput,
											params: bookingRequest,
											secrets: process.env,
											headers,
											internalOutput: internalOutput,
										}

										const filterResponse = async function () {
											const bookingResponse = PNRMapResponse.input
											const internalOutput = {
												internalOutput: PNRMapResponse.internalOutput,
											}
											return {
												ticketingResponse: {
													input: internalOutput,
												},
												bookingResponse: bookingResponse,
											}
										}
										const finalFilterResponse = await filterResponse()
										const ReturnSuccessResponse = {
											output: finalFilterResponse,
											params: bookingRequest,
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
									AllTicketPassExternalOutput = resultCheck

									return resultCheck
								}

								const AllTicketFail = {
									input: tboFinalBookingResponse,
									params: bookingRequest,
									secrets: process.env,
									headers,
								}
								let allTicketFailExternalOutput
								if (AllTicketFail.input.response?.error) {
									const checkResponse = async () => {
										const inputData = {
											...AllTicketFail,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput = inputData

										const ReturnSuccessResponse = {
											response: internalOutput.input?.response.res,
											params: bookingRequest,
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
									allTicketFailExternalOutput = resultCheck

									return resultCheck
								}
								const tboBookingTimout = {
									input: tboFinalBookingResponse,
									params: bookingRequest,
									secrets: process.env,
									headers,
								}
								let tboTimeoutExternalOutput
								if (tboBookingTimout.input.response?.timeout) {
									const checkResponse = async () => {
										const inputData = {
											...tboBookingTimout,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput = inputData

										const timeoutBookingResposne = {
											input: internalOutput.input?.response?.res,
											params: bookingRequest,
											secrets: process.env,
											headers,
										}

										const mapTimeoutResponse = async function () {
											const response = timeoutBookingResposne.input[0]?.output
											function responseMapper() {
												return {
													dbData: {
														result: response?.dbData?.result,
														config: {
															ticketingJson: JSON.parse(
																response?.dbData?.config?.ticketingJson
															),
															tavaBookingId:
																response?.dbData?.config?.tavaBookingId,
															timeout: true,
														},
													},
												}
											}

											return responseMapper()
										}
										const timeoutResponse = await mapTimeoutResponse()
										const ReturnSuccessResponse = {
											timeoutRespone: timeoutResponse,
											params: bookingRequest,
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
									tboTimeoutExternalOutput = resultCheck

									return resultCheck
								}
							}
							const resultCheck = await checkResponse()
							tboExternalOutput = resultCheck

							return resultCheck
						}
						const IfAmadeus = {
							input: internalOutput,
							params: bookingRequest,
							secrets: process.env,
							headers,
						}
						let amadeusExternalOutput
						if (
							IfAmadeus.input.provider === 'AMADEUS' ||
							IfAmadeus.input.provider === 'AM'
						) {
							const checkResponse = async () => {
								const inputData = {
									...IfAmadeus,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers
								const internalOutput = inputData

								const IfRecordFound = {
									input: internalOutput.input,
									params: bookingRequest,
									secrets: process.env,
									headers,
								}
								let recordFoundExternalOutput
								if (IfRecordFound.input.length != 0) {
									const checkResponse = async () => {
										const inputData = {
											...IfRecordFound,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput = inputData

										const AmadeusMap = {
											input: [internalOutput.input],
											params: bookingRequest,
											secrets: process.env,
											headers,
										}
										const amadeusMapExternalOutput = []
										for (let it of AmadeusMap.input) {
											const internalOutput = it
											const checkResponse = async () => {
												const CallAMBookingRESTAPIEndpoint = {
													input: internalOutput,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}

												let amadeusBookingResponse
												try {
													const cacheKey = ''
													const cacheExpireTime = 0
													const isCacheRequired_92046372_6f2e_444e_a2a4_f8942740e368 = false
													tavaLogger(
														corelationId,
														'Request',
														`${CallAMBookingRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-booking?`,
														CallAMBookingRESTAPIEndpoint.input,
														templateType
													)
													const fetchData = async () =>
														await axios
															.post(
																`${CallAMBookingRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-booking?`,
																CallAMBookingRESTAPIEndpoint.input,
																{
																	headers: {
																		'x-request-id': `${CallAMBookingRESTAPIEndpoint.headers['x-request-id']}`,
																	},
																}
															)
															.then(async (res) => {
																tavaLogger(
																	corelationId,
																	'Response',
																	`${CallAMBookingRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-booking?`,
																	res,
																	templateType
																)
																return res.data
															})
													amadeusBookingResponse =
														isCacheRequired_92046372_6f2e_444e_a2a4_f8942740e368
															? await fetchOrStoreDataInCache(
																	fetchData,
																	cacheKey,
																	cacheExpireTime
															  )
															: await fetchData()
												} catch (error) {
													console.log(
														'Error occurred in :  `${CallAMBookingRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-booking?`',
														error
													)
													if (error.response) {
														const { status, data } = error?.response
														tavaLogger(
															corelationId,
															'Error',
															`${CallAMBookingRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-booking?`,
															error,
															templateType
														)
														throw res.status(status).json(data)
													}
													throw error
												}
												const bookingSuccessResponse = {
													input: amadeusBookingResponse,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}
												let successExternalOutput
												if (
													bookingSuccessResponse.input.response?.created
														?.status === 'SUCCESS'
												) {
													const checkResponse = async () => {
														const inputData = { ...bookingSuccessResponse }
														delete inputData.params
														delete inputData.secrets
														delete inputData.headers
														const internalOutput = inputData
														const CallAMTicketRESTAPIEndpoint = {
															input: internalOutput,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}

														let amadeusTicketResponse
														try {
															const cacheKey = ''
															const cacheExpireTime = 0
															const isCacheRequired = false
															tavaLogger(
																corelationId,
																'Request',
																`${CallAMTicketRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-ticket?`,
																CallAMTicketRESTAPIEndpoint.input.input.response
																	.created,
																templateType
															)
															const fetchData = async () =>
																await axios
																	.post(
																		`${CallAMTicketRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-ticket?`,
																		CallAMTicketRESTAPIEndpoint.input.input
																			.response.created,
																		{
																			headers: {
																				'x-request-id': `${CallAMTicketRESTAPIEndpoint.headers['x-request-id']}`,
																			},
																		}
																	)
																	.then(async (res) => {
																		tavaLogger(
																			corelationId,
																			'Response',
																			`${CallAMTicketRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-ticket?`,
																			res,
																			templateType
																		)
																		return res.data
																	})
															amadeusTicketResponse = isCacheRequired
																? await fetchOrStoreDataInCache(
																		fetchData,
																		cacheKey,
																		cacheExpireTime
																  )
																: await fetchData()
														} catch (error) {
															console.log(
																'Error occurred in :  `${CallAMTicketRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-ticket?`',
																error
															)
															if (error.response) {
																const { status, data } = error?.response
																tavaLogger(
																	corelationId,
																	'Error',
																	`${CallAMTicketRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/amadeus-ticket?`,
																	error,
																	templateType
																)
																throw res.status(status).json(data)
															}
															throw error
														}
														const AmadeusTicketConfirmed = {
															input: amadeusTicketResponse,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														let successExternalOutput
														if (
															AmadeusTicketConfirmed.input.output
																?.ticketingStatus === 'CONFIRMED'
														) {
															const checkResponse = async () => {
																const inputData = { ...AmadeusTicketConfirmed }
																delete inputData.params
																delete inputData.secrets
																delete inputData.headers
																const internalOutput = inputData
																const ReturnSuccessResponse = {
																	internalOutput: internalOutput,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const updatedReturnSuccessRes = {
																	...ReturnSuccessResponse,
																}

																if (
																	updatedReturnSuccessRes?.output
																		?.responseType === 'xml'
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
															successExternalOutput = resultCheck

															return resultCheck
														}
														const AmadeusticketFailed = {
															input: amadeusTicketResponse,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														let failedExternalOutput
														if (
															!(
																AmadeusticketFailed.input.output
																	?.ticketingStatus === 'CONFIRMED'
															)
														) {
															const checkResponse = async () => {
																const inputData = { ...AmadeusticketFailed }
																delete inputData.params
																delete inputData.secrets
																delete inputData.headers
																const internalOutput = inputData
																const CancelRequest = {
																	input: internalOutput,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}

																const createCancelRequest = async function () {
																	const pnr =
																		CancelRequest?.input?.input?.updated?.pnr
																	const body = {
																		PNR: [pnr],
																		remark:
																			CancelRequest?.input?.input
																				?.ticketResponse?.input[
																				'soap:Envelope'
																			]['soap:Body'],
																	}
																	return body
																}
																const flightCancelRequest =
																	await createCancelRequest()
																const CallCancelRESTAPIEndpoint = {
																	input: flightCancelRequest,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}

																const flightCancelResponse = await flightCancel(
																	corelationId,
																	CallCancelRESTAPIEndpoint,
																	templateType
																)

																const ReturnSuccessResponse = {
																	output: flightCancelResponse,
																	params: bookingRequest,
																	secrets: process.env,
																	headers,
																}
																const updatedReturnSuccessRes = {
																	...ReturnSuccessResponse,
																}

																if (
																	updatedReturnSuccessRes?.output
																		?.responseType === 'xml'
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
															failedExternalOutput = resultCheck

															return resultCheck
														}
													}
													const resultCheck = await checkResponse()
													successExternalOutput = resultCheck

													return resultCheck
												}
												const bookingErrorResponse = {
													input: amadeusBookingResponse,
													params: bookingRequest,
													secrets: process.env,
													headers,
												}
												let bookingErrorExternalResponse
												if (
													!(
														bookingErrorResponse.input.response?.created
															?.status === 'SUCCESS'
													)
												) {
													const checkResponse = async () => {
														const inputData = { ...bookingErrorResponse }
														delete inputData.params
														delete inputData.secrets
														delete inputData.headers
														const internalOutput = inputData
														const bookingFailedRequest = {
															input: internalOutput,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														const mapRefundQueueData = async function () {
															return {
																tavaBookingId: iterator.tavaBookingId,
																isCompleted: false,
																refundAmount:
																	it.bookingJSON.journeyDetails[0].price.grandTotal.toString(),
																source: iterator.provider,
																createdAt: new Date().toISOString(),
																updatedAt: new Date().toISOString(),
																remarks: bookingFailedRequest.input,
																bookingId: it.id,
																paymentId: it.paymentId,
																currency:
																	bookingFailedRequest?.params?.query?.currency,
															}
														}
														const refundQueueData = await mapRefundQueueData()
														const CreateRefundQueueSingleRecord = {
															input: refundQueueData,
															params: bookingRequest,
															secrets: process.env,
															headers,
														}
														const createdRecord =
															await prisma.RefundQueue.create({
																data: CreateRefundQueueSingleRecord.input,
															})
														const ReturnSuccessResponse = {
															created: createdRecord,
															params: bookingRequest,
															secrets: process.env,
															headers,
															internalOutput: internalOutput,
														}
														const updatedReturnSuccessRes = {
															...ReturnSuccessResponse,
														}

														if (
															updatedReturnSuccessRes?.output?.responseType ===
															'xml'
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
													bookingErrorExternalResponse = resultCheck

													return resultCheck
												}
											}
											const resultCheck = await checkResponse()
											amadeusMapExternalOutput.push(resultCheck)
										}
										const ReturnSuccessResponse = {
											externalOutput: amadeusMapExternalOutput,
											params: bookingRequest,
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
									recordFoundExternalOutput = resultCheck

									return resultCheck
								}
								const IfRecordNotFound = {
									input: internalOutput.input,
									params: bookingRequest,
									secrets: process.env,
									headers,
								}
								let recordNotFoundExternalOutput
								if (IfRecordNotFound.input.length == 0) {
									const checkResponse = async () => {
										const inputData = {
											...IfRecordNotFound,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput = inputData
										const ThrowErrorResponse = {
											internalOutput: internalOutput,
											params: bookingRequest,
											secrets: process.env,
											headers,
										}
										const error = new Error()
										error.statusCode = '400'
										error.message = ThrowErrorResponse.internalOutput
										throw error
									}
									const resultCheck = await checkResponse()
									recordNotFoundExternalOutput = resultCheck
									return res.send(resultCheck)
								}
							}
							const resultCheck = await checkResponse()
							amadeusExternalOutput = resultCheck

							return resultCheck
						}
					}
					const resultCheck = await checkResponse()
					bookExternalOutput.push(resultCheck)
				}
				const bookMapResponse = {
					input: bookExternalOutput,
					params: bookingRequest,
					secrets: process.env,
					headers,
				}

				const flightBookingStatusCheck = async function () {
					const data = bookMapResponse.input

					const getResponse = (item) => {
						return (
							item?.output?.ticketingResponse?.input?.internalOutput?.input
								?.response ||
							item?.externalOutput?.[0]?.internalOutput?.input?.output ||
							item?.timeoutRespone?.dbData?.result
						)
					}
					const trueFalseIndexes = data.map((item) => {
						const response = getResponse(item)
						return (
							(response?.status === 'CONFIRMED' &&
								response?.ticketingStatus === 'CONFIRMED') ||
							response?.allTicketStatus === true
						)
					})

					const allFalse = trueFalseIndexes.every((value) => value === false)
					if (!allFalse) {
						return {
							response: {
								tavaBookingId: bookMapResponse.params.query.tavaBookingId,
							},
							data: data,
							error: false,
						}
					} else {
						return {
							error: true,
							data: data,
						}
					}
				}
				const flighStatus = await flightBookingStatusCheck()
				const errorResponse = {
					input: flighStatus,
					params: bookingRequest,
					secrets: process.env,
					headers,
				}
				let errorResponseExternalOutput
				if (errorResponse.input.error) {
					const checkResponse = async () => {
						const inputData = {
							...errorResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers
						const internalOutput = inputData

						const ReturnSuccessResponse = {
							output: internalOutput.input.data,
							params: bookingRequest,
							secrets: process.env,
							headers,
						}
						const updatedReturnSuccessRes = { ...ReturnSuccessResponse }

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
					errorResponseExternalOutput = resultCheck

					return resultCheck
				}
				const successResponse = {
					input: flighStatus,
					params: bookingRequest,
					secrets: process.env,
					headers,
				}
				let successExternalOutputResponse
				if (!successResponse.input.error) {
					const checkResponse = async () => {
						const inputData = {
							...successResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers
						const internalOutput = inputData
						const finalBookResponse = {
							input: internalOutput,
							params: bookingRequest,
							secrets: process.env,
							headers,
						}

						const responseProcessor = async function () {
							const res =
								finalBookResponse?.input.input.data ||
								finalBookResponse?.input?.input
							return res
						}
						const finalResponse = await responseProcessor()

						const EmailSubflow = {
							input: internalOutput,
							params: bookingRequest,
							secrets: process.env,
							headers,
							output: finalResponse,
						}
						const created = await sendticketingemail(
							EmailSubflow,
							res,
							next,
							corelationId,
							url
						)
						const ReturnSuccessResponse = {
							output: finalResponse,
							params: bookingRequest,
							secrets: process.env,
							headers,
						}
						const updatedReturnSuccessRes = { ...ReturnSuccessResponse }

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
					successExternalOutputResponse = resultCheck

					return resultCheck
				}
			}
			const resultCheck = await checkResponse()
			capturedTrueExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		const IfPaymentCapturedFalse = {
			input: paymentCallbackResponse,
			params: bookingRequest,
			secrets: process.env,
			headers,
		}
		let externalOutput
		if (IfPaymentCapturedFalse.input.output.status !== 'CAPTURED') {
			const checkResponse = async () => {
				const inputData = {
					...IfPaymentCapturedFalse,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers
				const internalOutput = inputData
				const UpdateRecordFieldsbyQuery = {
					input: internalOutput,
					params: bookingRequest,
					secrets: process.env,
					headers,
				}
				const parseInputData = (inputData) => {
					const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
					const formattedOutput = []
					let match
					while ((match = regex.exec(inputData)) !== null) {
						const [, key, value, operator] = match
						formattedOutput.push({
							key,
							value,
							operator,
						})
					}
					return formattedOutput
				}
				const formattedWhereQuery = `"paymentSessionId"='${UpdateRecordFieldsbyQuery.params.query.paymentSessionId}'`
				const formattedSetQuery = `"status"= 'Pending',"paymentStatus"= '${UpdateRecordFieldsbyQuery.input.input.output.status}',"ticketingStatus"= 'NA'`
				const outputWhereData = parseInputData(formattedWhereQuery)
				const outputSetData = parseInputData(formattedSetQuery)

				let queryWhere = ''
				let querySet = ''
				let preOperatorWhere = ''

				outputWhereData.forEach((item) => {
					if (!item.value.includes('undefined')) {
						queryWhere += ` ${queryWhere ? preOperatorWhere : ''} "${
							item.key
						}" = '${item.value}'`
					}
					preOperatorWhere = item.operator
				})
				outputSetData.forEach((item) => {
					if (!item.value.includes('undefined')) {
						querySet += `"${item.key}" = '${item.value}'`
					}
				})

				querySet = querySet.replaceAll(`'"`, `',"`)
				const updateInfo_00d4f63c_d381_44a6_bb6f_cc0ec1237662 =
					await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
						`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
					)}`
				const ThrowErrorResponse = {}
				const error = new Error()
				error.statusCode = '400'
				error.message = 'Payment Not Captured'
				throw error
			}
			const resultCheck = await checkResponse()
			externalOutput = resultCheck
			return res.send(resultCheck)
		}
		return res.json(
			'Node has completed its execution without any response. No response node (e.g., success response, error response) connected to the service.'
		)
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}
module.exports = { bookCallback }
