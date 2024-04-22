const {
	checkduplicatebooking,
	promocodeupdate,
} = require('../../../helpers/service.js')
const { tavaLogger } = require('../../../helpers/index.js')
const {
	fetchOrStoreDataInCache,
} = require('../../../helpers/fetchAndUpdateCacheData.js')
const prismaClient = require('../../../prismaClient.js')
const { prisma } = prismaClient
const axios = require('axios')
const moment = require('moment')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../../services/tbo/authentication.js')
const {
	callPayment,
} = require('../../infrastructure/payment/payment.controllers.js')

const book = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const bookRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const CheckDuplicateSubflow = {
			input: bookRequest,
			params: bookRequest,
			secrets: process.env,
			headers,
		}
		const created = await checkduplicatebooking(
			CheckDuplicateSubflow,
			res,
			next,
			corelationId,
			url
		)
		const IfDuplicateBookingBooking = {
			input: created,
			params: bookRequest,
			secrets: process.env,
			headers,
		}
		let duplicateBookingExternalOutput
		if (IfDuplicateBookingBooking.input.output.isDuplicateBooking) {
			const checkResponse = async () => {
				const inputData = {
					...IfDuplicateBookingBooking,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers
				const internalOutput = inputData
				const ThrowErrorResponse = {}
				const error = new Error()
				error.statusCode = '400'
				error.message = 'Duplicate Booking found.'
				throw error
			}
			const resultCheck = await checkResponse()
			duplicateBookingExternalOutput = resultCheck
			return res.send(resultCheck)
		}

		const PromoCodeSubflow = {
			input: bookRequest,
			params: bookRequest,
			secrets: process.env,
			headers,
		}
		const createdPromoCode = await promocodeupdate(
			PromoCodeSubflow,
			res,
			next,
			corelationId,
			url
		)
		const RunJavaScriptCode = {
			created: created,
			params: bookRequest,
			secrets: process.env,
			headers,
			input: bookRequest,
			created1: createdPromoCode,
		}

		const requestMapper = async function () {
			return RunJavaScriptCode?.input?.body?.bookingRequest?.journeyDetails
		}

		const journeyDetails = await requestMapper()

		const JourneyDetailsMap = {
			input: journeyDetails,
			params: bookRequest,
			secrets: process.env,
			headers,
		}
		const mapExternalOutput = []
		for (let input of JourneyDetailsMap.input) {
			const internalOutput = input
			const checkResponse = async () => {
				const IfTBO = {
					input: internalOutput,
					params: bookRequest,
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
						const tboAuthRequest = {
							input: internalOutput,
							params: bookRequest,
							secrets: process.env,
							headers,
						}

						const authRequest = await createAuthRequest(
							tboAuthRequest.secrets,
							tboAuthRequest.params.body.bookingRequest
						)

						const CallAuthRESTAPI = {
							input: authRequest,
							params: bookRequest,
							secrets: process.env,
							headers,
						}

						let authResponse = await callAuthRESTAPI(
							corelationId,
							CallAuthRESTAPI,
							templateType
						)

						const tboBookingDetailes = {
							output: authResponse,
							params: bookRequest,
							secrets: process.env,
							headers,
							input: internalOutput,
						}

						const mapBookingData = async function () {
							const returnRequestBody = async (input, output, params) => {
								input = JSON.parse(JSON.stringify(input).replaceAll("'", ''))

								const journeyDetail = {
									TokenId: output.TokenId,
									TraceId: params.body.bookingRequest.TraceId,
									EndUserIp: params.body.bookingRequest.EndUserIp,
									...input,
								}

								const mapRequestBody = (input) => {
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
											const { number, documentType } = getDocumentDetails
											const passportDetails =
												item.documents.find(
													(document) => document.documentType === 'PASSPORT'
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
												PassportIssueDate: passportDetails?.issuanceDate
													? moment(
															passportDetails?.issuanceDate,
															'YYYY-MM-DD HHmm'
													  ).format('yyyy-MM-DDTHH:mm:ss')
													: '',
												PassportIssueCountryCode:
													passportDetails?.issuanceCountry,
												Fare: item.Fare,
												AddressLine1: item?.address || 'IN',
												AddressLine2: item?.AddressLine1 || '',
												City: item?.City || 'gurgaon',
												CountryCode: item?.countryCode,
												CountryName: item?.countryName,
												CellCountryCode: item?.phoneCode,
												ContactNo: item?.phoneNumber?.replaceAll('+91', ''),
												Nationality: item?.nationality,
												Email: item?.email,
												IsLeadPax: item?.isPrimary,
												FFAirlineCode: null,
												FFNumber: item?.ffNumber || '',
												GSTCompanyAddress: item?.GSTCompanyAddress || '',
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
										TokenId: output.TokenId,
										TraceId: params.body.bookingRequest.TraceId,
										EndUserIp: params.body.bookingRequest.EndUserIp,
									}
								}
								const ticketingJson = {
									EndUserIp: params.body.bookingRequest.EndUserIp,
									TokenId: output.TokenId,
									TraceId: params.body.bookingRequest.TraceId,
									PrefferedCurrency:
										params.body.bookingRequest?.PrefferedCurrency || 'INR',
									AgentReferenceNo: params.body.bookingRequest.AgentReferenceNo,
									Passengers: mapRequestBody(input).Passengers,
									ResultIndex: input.ResultIndex,
								}
								const checkUserEmail = (userEmail, travelerEmail) => {
									if (userEmail && userEmail.trim() !== '') return userEmail
									return travelerEmail
								}
								const departureData =
									IfTBO?.input?.itineraries[0].segments[0].departure
								const combinedDateTime = moment(
									`${departureData.date} ${departureData.time}`,
									'YYYY-MM-DD HH:mm'
								).toDate()
								const outputObj = {
									tavaBookingId: params.body.bookingRequest.tavaBookingId,
									userEmail: checkUserEmail(
										params.body.bookingRequest.accountEmail,
										params.body.bookingRequest.journeyDetails[0]
											.travelerDetails[0].email
									),
									status: ' AWAITINGPAYMENT',
									provider: 'TBO',
									providerBookingId: '',
									bookingJSON: {
										journeyDetails: [journeyDetail],
									},
									ticketingJSON: ticketingJson,
									pnr: '',
									paymentSessionId: '',
									createdAt: new Date(),
									updatedAt: new Date(),
									paymentStatus: '',
									paymentId: '',
									ticketingStatus: 'NA',
									travelerEmail:
										params.body.bookingRequest.journeyDetails[0]
											.travelerDetails[0].email,
									corelationId,
									departureDateTime: combinedDateTime,
								}

								return outputObj
							}

							return returnRequestBody(
								tboBookingDetailes.input.input,
								tboBookingDetailes.output,
								tboBookingDetailes.params
							)
						}
						const bookingTableData = await mapBookingData()

						const CreateTBOSingleRecord = {
							input: bookingTableData,
							params: bookRequest,
							secrets: process.env,
							headers,
						}
						const createdTBORecord = await prisma.Booking.create({
							data: CreateTBOSingleRecord.input,
						})
						const ReturnSuccessResponse = {
							created: createdTBORecord,
							params: bookRequest,
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
					tboExternalOutput = resultCheck

					return resultCheck
				}
				const IfAmadeus = {
					input: internalOutput,
					params: bookRequest,
					secrets: process.env,
					headers,
				}
				let amadeusExternalOutput
				if (IfAmadeus.input.provider === 'AM') {
					const checkResponse = async () => {
						const inputData = {
							...IfAmadeus,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers
						const internalOutput = inputData

						const amadeusBookingDetailes = {
							input: internalOutput,
							params: bookRequest,
							secrets: process.env,
							headers,
						}

						const mapBookingData = async function () {
							const departureData =
								IfAmadeus?.input?.itineraries[0].segments[0].departure
							const combinedDateTime = moment(
								`${departureData.date} ${departureData.time}`,
								'YYYY-MM-DD HH:mm'
							).toDate()
							const checkUserEmail = (userEmail, travelerEmail) => {
								if (userEmail && userEmail.trim() !== '') return userEmail
								return travelerEmail
							}
							const bookingData = async (requestedParams, journeyDetail) => {
								let bookingData = {
									tavaBookingId: requestedParams.bookingRequest.tavaBookingId,
									pnr: '',
									orderType: requestedParams.bookingRequest.orderType,
									provider: journeyDetail.provider,
									status: 'AWAITINGPAYMENT',
									paymentStatus: '',
									createdAt: new Date().toISOString(),
									updatedAt: new Date().toISOString(),
									userEmail: checkUserEmail(
										requestedParams.bookingRequest.accountEmail,
										requestedParams.bookingRequest.journeyDetails[0]
											.travelerDetails[0].email
									),
									travelerEmail:
										requestedParams.bookingRequest.journeyDetails[0]
											.travelerDetails[0].email,
									bookingJSON: {
										journeyDetails: [journeyDetail],
									},
									corelationId,
									departureDateTime: combinedDateTime,
								}

								return bookingData
							}

							return bookingData(
								amadeusBookingDetailes.params.body,
								amadeusBookingDetailes.input.input
							)
						}
						const bookData = await mapBookingData()
						const CreateSingleBookingRecord = {
							input: bookData,
							params: bookRequest,
							secrets: process.env,
							headers,
						}
						const createdRecord = await prisma.Booking.create({
							data: CreateSingleBookingRecord.input,
						})
						const ReturnSuccessResponse = {
							created: createdRecord,
							params: bookRequest,
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
					amadeusExternalOutput = resultCheck

					return resultCheck
				}
			}
			const resultCheck = await checkResponse()
			mapExternalOutput.push(resultCheck)
		}

		let paymentResponse = await callPayment(
			corelationId,
			body.paymentRequest,
			templateType
		)

		const RunJavaScript = {
			input: paymentResponse,
			params: bookRequest,
			secrets: process.env,
			headers,
		}

		const bookMapper = async function () {
			const {
				bookingRequest: { tavaBookingId },
			} = RunJavaScript.params.body
			const {
				session: { id: sessionId },
			} = RunJavaScript.input

			return { tavaBookingId, sessionId }
		}
		const updateRecord = await bookMapper()

		const UpdateBookingRecordFieldsbyQuery = {
			input: updateRecord,
			params: bookRequest,
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
		const formattedWhereQuery = `"tavaBookingId"='${UpdateBookingRecordFieldsbyQuery.input.tavaBookingId}'`
		const formattedSetQuery = `"paymentSessionId"= '${UpdateBookingRecordFieldsbyQuery.input.sessionId}',"paymentStatus"= 'PENDING'`
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
		const ReturnSuccessResponse = {
			output: paymentResponse,
			params: bookRequest,
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
	}
}

module.exports = {
	book,
}
