const { amadeuspnrcancel } = require('../../../helpers/service.js')
const { tavaLogger } = require('../../../helpers/index.js')
const prismaClient = require('../../../prismaClient.js')
const { prisma } = prismaClient
const {
	callReleasePNRRequest,
} = require('../../../services/tbo/flightAPIHandler.js')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../../services/tbo/authentication.js')

const cancel = async (req, res, next) => {
	const finalResponse = []
	const templateType = 'travel'
	const requestPayload = req
	const { body, url, params, method, headers } = req
	try {
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const inputConfigWithPNR = {
			input: requestPayload,
			params: requestPayload,
			secrets: process.env,
			headers,
		}
		let externalOutputWithPNR
		if (!(inputConfigWithPNR.params.body.PNR.length === 0)) {
			const checkResponse = async () => {
				const inputDataWithPNR = {
					...inputConfigWithPNR,
				}
				delete inputDataWithPNR.params
				delete inputDataWithPNR.secrets
				delete inputDataWithPNR.headers
				const internalOutputWithPNR = inputDataWithPNR
				const GetRecordValueWithPNR = {
					input: internalOutputWithPNR,
					params: requestPayload,
					secrets: process.env,
					headers,
				}
				const pickedValueWithPNR = GetRecordValueWithPNR.input.input
				const CancelFlowMap = {
					input: pickedValueWithPNR,
					params: requestPayload,
					secrets: process.env,
					headers,
				}
				const externalOutputWithPNR = []
				for (let subValue of CancelFlowMap.input.body.PNR) {
					const pnrRecord = subValue
					const checkResponse = async () => {
						const GetMultiRecordsbyQueryexternalOutputWithPNR = {
							input: pnrRecord,
							params: requestPayload,
							secrets: process.env,
							headers,
						}
						const parseInputPNR = (inputData) => {
							const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
							const outputWithPNR = []
							let match
							while ((match = regex.exec(inputData)) !== null) {
								const [, key, value, operator] = match
								outputWithPNR.push({
									key,
									value,
									operator,
								})
							}
							return outputWithPNR
						}
						const formattedQueryWithPNR = `"pnr" = '${GetMultiRecordsbyQueryexternalOutputWithPNR.input}'`
						const outputBookingData = parseInputPNR(formattedQueryWithPNR)
						let getBookingQueryWithPNR = ''
						let preOperatorWithPNR = ''
						outputBookingData.forEach((item) => {
							if (!item.value.includes('undefined')) {
								getBookingQueryWithPNR += ` ${
									getBookingQueryWithPNR ? preOperatorWithPNR : ''
								} "${item.key}" = '${item.value}'`
							}
							preOperatorWithPNR = item.operator
						})
						const isFormattedQueryExistWithPNR = getBookingQueryWithPNR
							? `WHERE ${getBookingQueryWithPNR}`
							: ''
						const sortObjWithPNR = []
						let sortObjExpWithPNR = ''
						if (sortObjWithPNR.length) {
							const orderByClause = sortObjWithPNR
								.map((order) => {
									const [key, value] = Object.entries(order)[0]
									return `"${key}" ${value.toUpperCase()}`
								})
								.join(', ')
							sortObjExpWithPNR = `ORDER BY ${orderByClause}`
						}
						const getBookingInDB =
							await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
								`SELECT * FROM "Booking"  ${isFormattedQueryExistWithPNR} ${sortObjExpWithPNR} OFFSET 0 ROWS FETCH NEXT '20' ROWS ONLY`
							)}`
						const resultBookings = getBookingInDB
						const IfAmaduesBookingFoundTrue = {
							input: resultBookings,
							params: requestPayload,
							secrets: process.env,
							headers,
						}

						let cancelationResponse
						if (
							IfAmaduesBookingFoundTrue.input.length &&
							(IfAmaduesBookingFoundTrue.input[0].provider === 'AM' ||
								IfAmaduesBookingFoundTrue.input[0].provider === 'AMADEUS')
						) {
							const checkResponse = async () => {
								const inputAMBooking = {
									...IfAmaduesBookingFoundTrue,
								}
								delete inputAMBooking.params
								delete inputAMBooking.secrets
								delete inputAMBooking.headers
								const internalOutputAMBooking = inputAMBooking
								const GetRecordValueBookingData = {
									input: internalOutputAMBooking,
									params: requestPayload,
									secrets: process.env,
									headers,
								}
								const pickedBookingValue =
									GetRecordValueBookingData.input.input[0]
								const AmadeusCancelSubflow = {
									input: pickedBookingValue,
									params: requestPayload,
									secrets: process.env,
									headers,
								}
								const createdAmadeusCancelRequest = await amadeuspnrcancel(
									AmadeusCancelSubflow,
									res,
									next,
									corelationId,
									url
								)
								const GetAmadeusCancelResponse = {
									input: createdAmadeusCancelRequest,
									params: requestPayload,
									secrets: process.env,
									headers,
									pickedValue: pickedBookingValue,
								}
								const amadeusCancelRes = GetAmadeusCancelResponse

								const checkCancelationStatus = async function () {
									const resultData = (data, input) => {
										const response =
											data?.response?.response ||
											data?.response?.input?.response
										const isCancelledAndSuccessful =
											response?.status === 'CANCELED' &&
											response?.cancelationStatus === 'SUCCESS'
										const cancelData = {
											error: !isCancelledAndSuccessful,
											status: isCancelledAndSuccessful ? 'CANCELED' : 'FAILED',
											cancelationStatus: isCancelledAndSuccessful
												? 'SUCCESS'
												: 'FAILED',
											tavaBookingId: response.tavaBookingId,
											source: input.provider,
											paidAmount:
												input.bookingJSON.journeyDetails[0].price.grandTotal.toString(),
											refundAmount: isCancelledAndSuccessful
												? input.bookingJSON.journeyDetails[0].price.grandTotal.toString()
												: '',
											bookingid: input.id,
											paymentid: input.paymentId,
											pnr: input.pnr,
										}
										return cancelData
									}

									return resultData(
										amadeusCancelRes.input,
										amadeusCancelRes.pickedValue
									)
								}
								const amadeusBookingCancelationStatus =
									await checkCancelationStatus()
								const IfCancelationStatusSucessTrue = {
									input: amadeusBookingCancelationStatus,
									params: requestPayload,
									secrets: process.env,
									headers,
								}
								let refundExternalOutput
								if (!IfCancelationStatusSucessTrue.input.error) {
									const checkResponse = async () => {
										const inputCancelationStatusData = {
											...IfCancelationStatusSucessTrue,
										}
										delete inputCancelationStatusData.params
										delete inputCancelationStatusData.secrets
										delete inputCancelationStatusData.headers
										const refundDetailsOutput = inputCancelationStatusData
										const GetRefundDetail = {
											input: refundDetailsOutput,
											params: requestPayload,
											secrets: process.env,
											headers,
										}
										const refundRequestData = GetRefundDetail.input.input
										const ProcessRefundRequestData = {
											input: refundRequestData,
											params: requestPayload,
											secrets: process.env,
											headers,
										}
										const processRefund = ProcessRefundRequestData

										const processRefundRequest = async function () {
											const refundRequest = (input) => ({
												tavaBookingId: input.tavaBookingId,
												isCompleted: false,
												refundAmount: input.refundAmount,
												source: input.source,
												createdAt: input.createdAt,
												updatedAt: input.updatedAt,
												remarks: processRefund.params?.body?.remark,
												bookingId: input.bookingid,
												paymentId: input.paymentid,
												currency: processRefund?.params?.body?.currency,
											})

											return refundRequest(processRefund.input)
										}
										const refundResponeOutput = await processRefundRequest()
										const CreateSingleRecordInRefundTable = {
											input: refundResponeOutput,
											params: requestPayload,
											secrets: process.env,
											headers,
										}
										const createdEntryInRefundQueue =
											await prisma.RefundQueue.create({
												data: CreateSingleRecordInRefundTable.input,
											})
										const ReturnSuccessRefundResponse = {
											output: refundRequestData,
											params: requestPayload,
											secrets: process.env,
											headers,
											created: createdEntryInRefundQueue,
										}
										const updatedSucceesRefundRes = {
											...ReturnSuccessRefundResponse,
										}

										if (
											updatedSucceesRefundRes?.output?.responseType === 'xml'
										) {
											delete updatedSucceesRefundRes.headers
											return res
												.set('Content-Type', 'application/xml')
												.send(updatedSucceesRefundRes.output.data)
										}

										delete updatedSucceesRefundRes.params
										delete updatedSucceesRefundRes.secrets
										delete updatedSucceesRefundRes.headers

										if (
											Object.keys(updatedSucceesRefundRes).length ||
											finalResponse.length
										) {
											tavaLogger(
												corelationId,
												'Response',
												url,
												{
													status: 200,
													data: updatedSucceesRefundRes,
												},
												templateType
											)
											return finalResponse.length
												? { output: finalResponse }
												: updatedSucceesRefundRes
										} else return 'successfully run'
									}
									const resultCheck = await checkResponse()
									refundExternalOutput = resultCheck

									return resultCheck
								}
								const IfCancelationStatusSucessFalse = {
									input: amadeusBookingCancelationStatus,
									params: requestPayload,
									secrets: process.env,
									headers,
								}
								let unsettledExternalOutput
								if (IfCancelationStatusSucessFalse.input.error) {
									const checkResponse = async () => {
										const unsettledInputData = {
											...IfCancelationStatusSucessFalse,
										}
										delete unsettledInputData.params
										delete unsettledInputData.secrets
										delete unsettledInputData.headers
										const unsettledInternalOutput = unsettledInputData
										const unsettledBookingRequestData = {
											input: unsettledInternalOutput,
											params: requestPayload,
											secrets: process.env,
											headers,
										}
										const unsettledBookingRequest = unsettledBookingRequestData

										const triggerUnsettledBookingRequest = async function () {
											const unsettledBooking = (input) => ({
												provider: input.source,
												division: 'FLIGHT',
												isCompleted: false,
												bookingId: input.bookingid,
												tavaBookingId: input.tavaBookingId,
												pnr: input.pnr,
												retryCount: 0,
											})

											return unsettledBooking(
												unsettledBookingRequest.input.input
											)
										}
										const responseUnsettledBooking =
											await triggerUnsettledBookingRequest()
										const CreateSingleRecordUnsettledBooking = {
											input: responseUnsettledBooking,
											params: requestPayload,
											secrets: process.env,
											headers,
										}
										const saveUnsettledBooking =
											await prisma.unsettledBooking.create({
												data: CreateSingleRecordUnsettledBooking.input,
											})
										const returnReposneforUnsettledBooking = {
											output: unsettledInternalOutput,
											params: requestPayload,
											secrets: process.env,
											headers,
										}
										const updatedReturnSuccessReposneforUnsettledBooking = {
											...returnReposneforUnsettledBooking,
										}

										if (
											updatedReturnSuccessReposneforUnsettledBooking?.output
												?.responseType === 'xml'
										) {
											delete updatedReturnSuccessReposneforUnsettledBooking.headers
											return res
												.set('Content-Type', 'application/xml')
												.send(
													updatedReturnSuccessReposneforUnsettledBooking.output
														.data
												)
										}

										delete updatedReturnSuccessReposneforUnsettledBooking.params
										delete updatedReturnSuccessReposneforUnsettledBooking.secrets
										delete updatedReturnSuccessReposneforUnsettledBooking.headers

										if (
											Object.keys(
												updatedReturnSuccessReposneforUnsettledBooking
											).length ||
											finalResponse.length
										) {
											tavaLogger(
												corelationId,
												'Response',
												url,
												{
													status: 200,
													data: updatedReturnSuccessReposneforUnsettledBooking,
												},
												templateType
											)
											return finalResponse.length
												? { output: finalResponse }
												: updatedReturnSuccessReposneforUnsettledBooking
										} else return 'successfully run'
									}
									const resultCheck = await checkResponse()
									unsettledExternalOutput = resultCheck

									return resultCheck
								}
							}
							const resultCheck = await checkResponse()
							cancelationResponse = resultCheck

							return resultCheck
						}
						const IfTBOBookingFoundTrue = {
							input: resultBookings,
							params: requestPayload,
							secrets: process.env,
							headers,
						}

						if (
							IfTBOBookingFoundTrue.input.length &&
							IfTBOBookingFoundTrue.input[0].provider === 'TBO'
						) {
							const checkResponse = async () => {
								const inputData = {
									...IfTBOBookingFoundTrue,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers

								const GetRecordData = {
									input: inputData,
									params: requestPayload,
									secrets: process.env,
									headers,
								}
								const pickedValue =
									GetRecordData.input
										.input
								const IfLCCBooking = {
									input: pickedValue,
									params: requestPayload,
									secrets: process.env,
									headers,
								}
								if (
									IfLCCBooking.input[0].bookingJSON
										.journeyDetails[0].isLCC
								) {
									const checkResponse = async () => {
										const inputData = {
											...IfLCCBooking,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput =
											inputData
										const LCCBookingDetails =
											{
												input:
													internalOutput,
												params: requestPayload,
												secrets: process.env,
												headers,
											}

										const prepareLCCCancelationRequest =
											async function () {
												const responseMapper = (input) => {
													return {
														Id: input.input[0].id,
														updatedAt: new Date().toISOString(),
														status: 'CANCELED',
														cancelationStatus: 'SUCCESS',
													}
												}

												return responseMapper(
													LCCBookingDetails.input
												)
											}
										const responseLCCCancelation =
											await prepareLCCCancelationRequest()

										const UpdateRecordFieldsbyQuery =
											{
												input: responseLCCCancelation,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
										const parseInputData =
											(inputData) => {
												const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
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
										const formattedWhereQuery = `"id"='${UpdateRecordFieldsbyQuery.input.Id}'`
										const formattedSetQuery = `"cancelationStatus"= '${UpdateRecordFieldsbyQuery.input.cancelationStatus}',"updatedAt"= '${UpdateRecordFieldsbyQuery.input.updatedAt}',"status"= '${UpdateRecordFieldsbyQuery.input.status}'`
										const outputWhereData =
											parseInputData(
												formattedWhereQuery
											)
										const outputSetData =
											parseInputData(
												formattedSetQuery
											)

										let queryWhere = ''
										let querySet = ''
										let preOperatorWhere =
											''

										outputWhereData.forEach(
											(item) => {
												if (!item.value.includes('undefined')) {
													queryWhere += ` ${
														queryWhere
															? preOperatorWhere
															: ''
													} "${item.key}" = '${item.value}'`
												}
												preOperatorWhere =
													item.operator
											}
										)
										outputSetData.forEach(
											(item) => {
												if (!item.value.includes('undefined')) {
													querySet += `"${item.key}" = '${item.value}'`
												}
											}
										)

										querySet =
											querySet.replaceAll(
												`'"`,
												`',"`
											)
										const updateBookingInfo =
											await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
												`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
											)}`
										const getLCCCancelationResponseData =
											{
												input: updateBookingInfo,
												params: requestPayload,
												secrets: process.env,
												headers,
												internalOutput:
													internalOutput,
											}

										const prepareCancelationData =
											async function () {
												function responseMapper(
													input,
													bookingData,
													requestData
												) {
													let response = {
														error: false,
														source: 'TBO',
														paidAmount:
															bookingData.bookingJSON.journeyDetails[0].price
																.grandTotal,
														cancelationStatus: 'SUCCESS',
														status: 'CANCELED',
														tavaBookingId: bookingData.tavaBookingId,
														refundAmount: requestData.RefundableAmount,
														Source: requestData.Source,
														BookingType: 'LCC',
														response: {
															isLCC: true,
															message: 'PNR Release not required for LCC',
														},
													}
													if (input !== 1) {
														response.error = true
													}
													return response
												}
												return responseMapper(
													getLCCCancelationResponseData.input,
													getLCCCancelationResponseData
														.internalOutput.input[0],
													getLCCCancelationResponseData.params.body
												)
											}
										const cancelationStatusResponse =
											await prepareCancelationData()
										const ReturnSuccessResponse =
											{
												output: cancelationStatusResponse,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
										const updatedReturnSuccessRes =
											{
												...ReturnSuccessResponse,
											}

										if (
											updatedReturnSuccessRes
												?.output?.responseType === 'xml'
										) {
											delete updatedReturnSuccessRes.headers
											return res
												.set('Content-Type', 'application/xml')
												.send(
													updatedReturnSuccessRes
														.output.data
												)
										}

										delete updatedReturnSuccessRes.params
										delete updatedReturnSuccessRes.secrets
										delete updatedReturnSuccessRes.headers

										if (
											Object.keys(
												updatedReturnSuccessRes
											).length ||
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
												? {
														output: finalResponse,
												  }
												: updatedReturnSuccessRes
										} else return 'successfully run'
									}
									const resultCheck = await checkResponse()

									return resultCheck
								}
								const IfNonLCCBooking = {
									input: pickedValue,
									params: requestPayload,
									secrets: process.env,
									headers,
								}
								let nonLCCBooking
								if (
									!IfNonLCCBooking.input[0].bookingJSON
										.journeyDetails[0].isLCC
								) {
									const checkResponse = async () => {
										const inputData = {
											...IfNonLCCBooking,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput =
											inputData
										const NonLCCRequestData =
											{
												input:
													internalOutput,
												params: requestPayload,
												secrets: process.env,
												headers,
											}

											const tboAuthRequest = await createAuthRequest(
												NonLCCRequestData.secrets,
												NonLCCRequestData.input
											)

											const CallAuthRESTAPIEndpoint = {
												input: tboAuthRequest,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
	
											let authResponse = await callAuthRESTAPI(
												corelationId,
												CallAuthRESTAPIEndpoint,
												templateType
											)
										const AuthResponseData =
											{
												input: authResponse,
												params: requestPayload,
												secrets: process.env,
												headers,
												internalOutput:
													internalOutput,
											}
											const getReleasePNRRequest = async function () {
												function inputMapper(input, output) {
													return {
														EndUserIp:
															output.bookingJSON.journeyDetails[0].EndUserIp,
														TokenId: input.TokenId,
														BookingId: output.providerBookingId,
														Source:
															output.bookingJSON?.bookingResponse?.FlightItinerary
																?.Source,
													}
												}
	
												return inputMapper(
													AuthResponseData.input,
													AuthResponseData.internalOutput.input[0]
												)
											}
											const requestReleasePNR = await getReleasePNRRequest()
											const tboReleasePNRResponse = await callReleasePNRRequest(
												corelationId,
												requestReleasePNR,
												templateType
											)
	
										const UnsettledStatusNonLCC =
											{
												input: tboReleasePNRResponse,
												params: requestPayload,
												secrets: process.env,
												headers,
												internalOutput:
													internalOutput,
											}

										const UpdateReleasePNRRespone =
											async function () {
												function responseMapper(response, internalOutput) {
													const responseStatus =
														{
															0: 'NotSet',
															1: 'Successful',
															2: 'Failed',
															3: 'InvalidRequest',
															4: 'InvalidSession',
															5: 'InvalidRequest',
														}[response?.ResponseStatus] || 'Unknown status'

													const error = responseStatus !== 'Successful'
													const cancellationStatus = error
														? responseStatus.toUpperCase()
														: 'SUCCESSFUL'
													const status = error ? '' : 'CANCELED'

													return {
														error,
														cancellationStatus,
														updateDate: new Date().toISOString(),
														Id: internalOutput.id,
														source: internalOutput.provider,
														paidAmount:
															internalOutput.bookingJSON.journeyDetails[0].price.grandTotal.toString(),
														tavaBookingId: internalOutput.tavaBookingId,
														pnr: internalOutput.pnr,
														status,
														response,
													}
												}

												return responseMapper(
													UnsettledStatusNonLCC.input
														.Response,
													UnsettledStatusNonLCC
														.internalOutput.input[0]
												)
											}
										const outputUnsettledStatusNonLCC =
											await UpdateReleasePNRRespone()
										const ReturnSuccessResponse =
											{
												output: outputUnsettledStatusNonLCC,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
										const updatedReturnSuccessRes =
											{
												...ReturnSuccessResponse,
											}

										if (
											updatedReturnSuccessRes
												?.output?.responseType === 'xml'
										) {
											delete updatedReturnSuccessRes.headers
											return res
												.set('Content-Type', 'application/xml')
												.send(
													updatedReturnSuccessRes
														.output.data
												)
										}

										delete updatedReturnSuccessRes.params
										delete updatedReturnSuccessRes.secrets
										delete updatedReturnSuccessRes.headers

										if (
											Object.keys(
												updatedReturnSuccessRes
											).length ||
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
												? {
														output: finalResponse,
												  }
												: updatedReturnSuccessRes
										} else return 'successfully run'
									}
									const resultCheck = await checkResponse()
									nonLCCBooking =
										resultCheck
								}

								const SuccessPNRCancelResponse = {
									input: nonLCCBooking,
									params: requestPayload,
									secrets: process.env,
									headers,
									pickedValue: pickedValue,
								}

								if (
									!SuccessPNRCancelResponse.input.output.error
								) {
									const checkResponse = async () => {
										const inputData = {
											...SuccessPNRCancelResponse,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput =
											inputData
										const UpdateRecordFieldsbyQuery =
											{
												input:
													internalOutput,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
										const parseInputData =
											(inputData) => {
												const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
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
										const formattedWhereQuery = `"id"='${UpdateRecordFieldsbyQuery.input.input.output.Id}'`
										const formattedSetQuery = `"status"= '${UpdateRecordFieldsbyQuery.input.input.output.status}',"cancelationStatus"= '${UpdateRecordFieldsbyQuery.input.input.output.cancelationStatus}',"updatedAt"= '${UpdateRecordFieldsbyQuery.input.input.output.updateDate}'`
										const outputWhereData =
											parseInputData(
												formattedWhereQuery
											)
										const outputSetData =
											parseInputData(
												formattedSetQuery
											)

										let queryWhere = ''
										let querySet = ''
										let preOperatorWhere =
											''

										outputWhereData.forEach(
											(item) => {
												if (!item.value.includes('undefined')) {
													queryWhere += ` ${
														queryWhere
															? preOperatorWhere
															: ''
													} "${item.key}" = '${item.value}'`
												}
												preOperatorWhere =
													item.operator
											}
										)
										outputSetData.forEach(
											(item) => {
												if (!item.value.includes('undefined')) {
													querySet += `"${item.key}" = '${item.value}'`
												}
											}
										)

										querySet =
											querySet.replaceAll(
												`'"`,
												`',"`
											)
										const updateBookingInfo =
											await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
												`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
											)}`

										const CancelPNRResponse =
											{
												input: updateBookingInfo,
												params: requestPayload,
												secrets: process.env,
												headers,
												internalOutput:
													internalOutput,
											}

										const cancelResponseMapper =
											async function () {
												function responseMapper(
													input,
													bookingData,
													requestData
												) {
													let response = {
														...bookingData.output,
														error: false,
														tavaBookingId: bookingData.output.tavaBookingId,
														refundAmount: requestData.RefundableAmount,
														Source: requestData.Source,
														BookingType: 'NON-LCC',
														remarks: requestData.remarks,
														bookingid:
															CancelPNRResponse
																?.internalOutput?.pickedValue[0]?.id,
														paymentid:
															CancelPNRResponse
																?.internalOutput?.pickedValue[0]?.paymentId,
													}
													if (input !== 1) {
														response.error = true
													}
													return response
												}
												return responseMapper(
													CancelPNRResponse.input,
													CancelPNRResponse
														.internalOutput.input,
													CancelPNRResponse.params.body
												)
											}
										const cancelPNRResponse =
											await cancelResponseMapper()
										const CancelPNRFinalResponse =
											{
												input: cancelPNRResponse,
												params: requestPayload,
												secrets: process.env,
												headers,
											}

										const refundDataMapper =
											async function () {
												const refundRequest = (input) => ({
													tavaBookingId: input.tavaBookingId,
													isCompleted: input.isCompleted,
													refundAmount: input.paidAmount,
													source: input.source,
													createdAt: input.createdAt,
													updatedAt: input.updatedAt,
													remarks:
														CancelPNRFinalResponse.params
															?.body?.remark,
													bookingId: input.bookingid,
													paymentId: input.paymentid,
													currency: CancelPNRFinalResponse?.params?.body?.currency
												})

												return refundRequest(
													CancelPNRFinalResponse.input
												)
											}
										const refundData =
											await refundDataMapper()
										const CreateSingleRecord =
											{
												input: refundData,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
										const createdRefund =
											await prisma.RefundQueue.create({
												data: CreateSingleRecord.input,
											})
										const ReturnSuccessResponse =
											{
												created: createdRefund,
												params: requestPayload,
												secrets: process.env,
												headers,
												output: cancelPNRResponse,
											}
										const updatedReturnSuccessRes =
											{
												...ReturnSuccessResponse,
											}

										if (
											updatedReturnSuccessRes
												?.output?.responseType === 'xml'
										) {
											delete updatedReturnSuccessRes.headers
											return res
												.set('Content-Type', 'application/xml')
												.send(
													updatedReturnSuccessRes
														.output.data
												)
										}

										delete updatedReturnSuccessRes.params
										delete updatedReturnSuccessRes.secrets
										delete updatedReturnSuccessRes.headers

										if (
											Object.keys(
												updatedReturnSuccessRes
											).length ||
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
												? {
														output: finalResponse,
												  }
												: updatedReturnSuccessRes
										} else return 'successfully run'
									}
									const resultCheck = await checkResponse()

									return resultCheck
								}
								const ErrorPNRCancelResponse = {
									input: nonLCCBooking,
									params: requestPayload,
									secrets: process.env,
									headers,
								}
								let errorPNRCancelExternalOutput
								if (
									ErrorPNRCancelResponse.input.output.error
								) {
									const checkResponse = async () => {
										const inputData = {
											...ErrorPNRCancelResponse,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers
										const internalOutput =
											inputData
										const UpdateRecordFieldsbyQuery =
											{
												input:
													internalOutput,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
										const parseInputData =
											(inputData) => {
												const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
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
										const formattedWhereQuery = `"id"='${UpdateRecordFieldsbyQuery.input.input.output.Id}'`
										const formattedSetQuery = `"cancelationStatus"= '${UpdateRecordFieldsbyQuery.input.input.output.cancelationStatus}',"updatedAt"= '${UpdateRecordFieldsbyQuery.input.input.output.updateDate}'`
										const outputWhereData =
											parseInputData(
												formattedWhereQuery
											)
										const outputSetData =
											parseInputData(
												formattedSetQuery
											)

										let queryWhere = ''
										let querySet = ''
										let preOperatorWhere =
											''

										outputWhereData.forEach(
											(item) => {
												if (!item.value.includes('undefined')) {
													queryWhere += ` ${
														queryWhere
															? preOperatorWhere
															: ''
													} "${item.key}" = '${item.value}'`
												}
												preOperatorWhere =
													item.operator
											}
										)
										outputSetData.forEach(
											(item) => {
												if (!item.value.includes('undefined')) {
													querySet += `"${item.key}" = '${item.value}'`
												}
											}
										)

										querySet =
											querySet.replaceAll(
												`'"`,
												`',"`
											)
										const updateBookingInfo =
											await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
												`UPDATE "Booking" SET ${querySet} WHERE ${queryWhere}`
											)}`
										const PNRCancelErrorResponse =
											{
												input: updateBookingInfo,
												params: requestPayload,
												secrets: process.env,
												headers,
												internalOutput:
													internalOutput,
											}

										const mapUnsettledBookingData =
											async function () {
												function responseMapper(
													input,
													bookingData,
													requestData
												) {
													let response = {
														...bookingData.output,
														error: true,
														tavaBookingId: bookingData.output.tavaBookingId,
														refundAmount: requestData.RefundableAmount,
														Source: bookingData.output.source,
														BookingType: 'NON-LCC',
														remarks: requestData.remarks,
														tableData: {
															provider: bookingData.output.source,
															division: 'FLIGHT',
															isCompleted: false,
															bookingId: bookingData.output.Id,
															tavaBookingId: bookingData.output.tavaBookingId,
															pnr: bookingData.output.pnr,
															retryCount: 0,
														},
													}
													return response
												}
												return responseMapper(
													PNRCancelErrorResponse.input,
													PNRCancelErrorResponse
														.internalOutput.input,
													PNRCancelErrorResponse.params.body
												)
											}
										const unsettledBookingData =
											await mapUnsettledBookingData()
										const GetRecordValue =
											{
												input: unsettledBookingData,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
										const pickedValueUnsettledBookingdata =
											GetRecordValue.input
												.tableData
										const CreateSingleRecord =
											{
												input: pickedValueUnsettledBookingdata,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
						
											await prisma.unsettledBooking.create({
												data: CreateSingleRecord.input,
											})
										const ReturnSuccessResponse =
											{
												output: unsettledBookingData,
												params: requestPayload,
												secrets: process.env,
												headers,
											}
										const updatedReturnSuccessRes =
											{
												...ReturnSuccessResponse,
											}

										if (
											updatedReturnSuccessRes
												?.output?.responseType === 'xml'
										) {
											delete updatedReturnSuccessRes.headers
											return res
												.set('Content-Type', 'application/xml')
												.send(
													updatedReturnSuccessRes
														.output.data
												)
										}

										delete updatedReturnSuccessRes.params
										delete updatedReturnSuccessRes.secrets
										delete updatedReturnSuccessRes.headers

										if (
											Object.keys(
												updatedReturnSuccessRes
											).length ||
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
												? {
														output: finalResponse,
												  }
												: updatedReturnSuccessRes
										} else return 'successfully run'
									}
									const resultCheck = await checkResponse()
									errorPNRCancelExternalOutput =
										resultCheck

									return resultCheck
								}
							}
							const resultCheck = await checkResponse()

							return resultCheck
						}
						
						const IFBookingFoundFalse = {
							input: resultBookings,
							params: requestPayload,
							secrets: process.env,
							headers,
						}
				
						if (IFBookingFoundFalse.input[0].length === 0) {
							const checkResponse = async () => {
						
								const error = new Error();
								error.statusCode = "404";
								error.message = "No Data Found";
								throw error
							}
							const resultCheck = await checkResponse()
	
							return resultCheck
						}
					}
					const resultCheck = await checkResponse()
					externalOutputWithPNR.push(resultCheck)
				}
				const successResponse = {
					externalOutput: externalOutputWithPNR,
					params: requestPayload,
					secrets: process.env,
					headers,
				}

				const updatedSuccessResponse = { ...successResponse }

				if (updatedSuccessResponse?.output?.responseType === 'xml') {
					delete updatedSuccessResponse.headers
					return res
						.set('Content-Type', 'application/xml')
						.send(updatedSuccessResponse.output.data)
				}

				delete updatedSuccessResponse.params
				delete updatedSuccessResponse.secrets
				delete updatedSuccessResponse.headers

				if (
					Object.keys(updatedSuccessResponse).length ||
					finalResponse.length
				) {
					tavaLogger(
						corelationId,
						'Response',
						url,
						{
							status: 200,
							data: updatedSuccessResponse,
						},
						templateType
					)
					return finalResponse.length
						? { output: finalResponse }
						: updatedSuccessResponse
				} else {
					return 'successfully run'
				}
			}
			const resultCheck = await checkResponse()
			externalOutputWithPNR = resultCheck
			return res.send(resultCheck)
		}

		const inputConfigWithoutPNR = {
			input: requestPayload,
			params: requestPayload,
			secrets: process.env,
			headers,
		}
		let responsePayload
		if (inputConfigWithoutPNR.params.body.PNR.length === 0) {
			const validatePNR = async () => {
				const inputData = {
					...inputConfigWithoutPNR,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers
				const internalOutput = inputData
				const errorResponse = {
					internalOutput: internalOutput,
					params: requestPayload,
					secrets: process.env,
					headers,
				}
				const error = new Error()
				error.statusCode = '400'
				error.message = 'Please enter a valid PNR to proceed'
				throw error
			}
			const validationResult = await validatePNR()
			responsePayload = validationResult
			return res.send(validationResult)
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
	cancel,
}
