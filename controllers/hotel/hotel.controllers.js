const { tavaLogger } = require('../../helpers')
const prismaClient = require('../../prismaClient')
const { prisma } = prismaClient
const {
	callSendChangeRequest,
	callGetChangeRequestStatus,
} = require('../../services/tbo/hotelAPIHandler')
const { idpAuthentication } = require('../../services/tbo/idpAuthentication')
const {
	callAuthRESTAPI,
} = require('../../services/tbo/authentication')

const cancelhotelbooking = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const request = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const authRequest = {
			input: request.body,
			params: request,
			secrets: process.env,
			headers,
		}

		let authResponse = await callAuthRESTAPI(
			{},
			corelationId,
			templateType
		)

		const SendChangeRequest = {
			auth: authResponse,
			params: request,
			secrets: process.env,
			headers,
			input: request.body,
		}

		const createSendChangeRequest = {
			TokenId: SendChangeRequest.auth.TokenId,
			...SendChangeRequest.input,
		}

		const CallSendRequestRESTAPIEndpoint = {
			input: createSendChangeRequest,
			params: request,
			secrets: process.env,
			headers,
		}

		let sendChangeRequestResponse
		sendChangeRequestResponse = await callSendChangeRequest(
			corelationId,
			CallSendRequestRESTAPIEndpoint.input,
			templateType
		)

		const tboSendChangeRequestResponse = {
			auth: authResponse,
			params: request,
			secrets: process.env,
			headers,
			input: sendChangeRequestResponse,
		}

		let hotelCancellationResponse
		if (
			tboSendChangeRequestResponse.input.HotelChangeRequestResult?.Error
				?.ErrorCode === 0 &&
			tboSendChangeRequestResponse.input.HotelChangeRequestResult
				.ChangeRequestStatus !== 4
		) {
			const checkResponse = async () => {
				const sendChangeResponseMapper = async function () {
					function inputMapper(input) {
						const { ChangeRequestStatus } = input.input.HotelChangeRequestResult
						const { TokenId } = input.auth

						let sendChangeRequestStatus = 'SUCCESS'
						if (ChangeRequestStatus !== 3) sendChangeRequestStatus = 'PENDING'
						return {
							sendChangeRequestStatus,
							TokenId,
							...input.input,
						}
					}

					return inputMapper(tboSendChangeRequestResponse)
				}
				const requestMapper = await sendChangeResponseMapper()
				const sendChangeRequestResponse = {
					input: requestMapper,
					params: request,
					secrets: process.env,
					headers,
				}
				let sendChangeRequestData
				if (
					sendChangeRequestResponse.input.HotelChangeRequestResult.Error
						.ErrorCode === 0 &&
					sendChangeRequestResponse.input.sendChangeRequestStatus === 'SUCCESS'
				) {
					const checkResponse = async () => {
						const UpdateRecordFieldsbyQuery = {
							input: sendChangeRequestResponse.input,
							params: request,
							secrets: process.env,
							headers,
						}
						const parseInputData = (inputData) => {
							const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
							const formattedQuery = []
							let match
							while ((match = regex.exec(inputData)) !== null) {
								const [, key, value, operator] = match
								formattedQuery.push({
									key,
									value,
									operator,
								})
							}
							return formattedQuery
						}
						const formattedWhereQuery = `"bookingId"='${UpdateRecordFieldsbyQuery.params.body.BookingId}'`
						const formattedSetQuery = `"cancelationStatus"= 'SUCCESS',"bookingStatus"= 'CANCELED'`
						const outputWhereData = parseInputData(formattedWhereQuery)
						const outputSetData = parseInputData(formattedSetQuery)

						let where_query = ''
						let query_Set = ''
						let preOperatorWhere = ''

						outputWhereData.forEach((item) => {
							if (!item.value.includes('undefined')) {
								where_query += ` ${where_query ? preOperatorWhere : ''} "${
									item.key
								}" = '${item.value}'`
							}
							preOperatorWhere = item.operator
						})
						outputSetData.forEach((item) => {
							if (!item.value.includes('undefined')) {
								query_Set += `"${item.key}" = '${item.value}'`
							}
						})

						query_Set = query_Set.replaceAll(`'"`, `',"`)
						const hotelbookingResponse =
							await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
								`UPDATE "hotelBooking" SET ${query_Set} WHERE ${where_query}`
							)}`
						const GetMultiRecordsbyQuery = {
							input: hotelBookingResponse,
							params: request,
							secrets: process.env,
							headers,
						}
						const parseGetMultiRecordsbyQueryInputData = (inputData) => {
							const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
							const formattedOperation = []
							let match
							while ((match = regex.exec(inputData)) !== null) {
								const [, key, value, operator] = match
								formattedOperation.push({
									key,
									value,
									operator,
								})
							}
							return formattedOperation
						}
						const formattedGetMultiRecordsbyQuery = `"bookingId" = '${GetMultiRecordsbyQuery.params.body.BookingId}'`
						const formattedData = parseGetMultiRecordsbyQueryInputData(
							formattedGetMultiRecordsbyQuery
						)
						let formattedgetMultiRecordsQuery = ''
						let preOperator = ''
						formattedData.forEach((item) => {
							if (!item.value.includes('undefined')) {
								formattedgetMultiRecordsQuery += ` ${
									formattedgetMultiRecordsQuery ? preOperator : ''
								} "${item.key}" = '${item.value}'`
							}
							preOperator = item.operator
						})
						const isFormattedQueryExist = formattedgetMultiRecordsQuery
							? `WHERE ${formattedgetMultiRecordsQuery}`
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
						const getHotelBookings =
							await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
								`SELECT * FROM "hotelBooking"  ${isFormattedQueryExist} ${sortObjExp} OFFSET 0 ROWS FETCH NEXT '20' ROWS ONLY`
							)}`

						const refundQueueRequestBodyMapper = async function () {
							const refundQueueRequestBody = (
								bookingDetails,
								requestResponse,
								params
							) => {
								let bookingDetail = bookingDetails[0]
								const { tavaBookingId, bookingId, paymentId } = bookingDetail
								const { RefundedAmount } =
									requestResponse?.input?.HotelChangeRequestResult

								return {
									tavaBookingId,
									refundAmount: String(RefundedAmount),
									source: 'TBO',
									bookingId: bookingId,
									paymentId: paymentId,
									division: 'HOTEL',
									remarks: {
										reason: params.body.Remarks,
									},
								}
							}

							return refundQueueRequestBody(
								getHotelBookings,
								sendChangeRequestResponse,
								sendChangeRequestResponse.params
							)
						}
						const createRequestBodyForRefundQueue =
							await refundQueueRequestBodyMapper()
						const createSingleRecord = {
							input: createRequestBodyForRefundQueue,
							params: request,
							secrets: process.env,
							headers,
						}
						await prisma.RefundQueue.create({
							data: createSingleRecord.input,
						})

						const createMapperForGetChangeRequestStatus = async function () {
							function inputMapper(requestResponse, params) {
								const { TokenId } = requestResponse.input
								const { ChangeRequestId } =
									requestResponse?.input?.HotelChangeRequestResult
								return {
									TokenId,
									ChangeRequestId,
									EndUserIp: params.body.EndUserIp,
								}
							}

							return inputMapper(
								sendChangeRequestResponse,
								sendChangeRequestResponse.params
							)
						}
						const responseData = await createMapperForGetChangeRequestStatus()
						const createRequestForSendChangeRequestResponse = {
							input: responseData,
							params: request,
							secrets: process.env,
							headers,
						}

						let sendChangeRequestResponseData
						sendChangeRequestResponseData = await callGetChangeRequestStatus(
							corelationId,
							createRequestForSendChangeRequestResponse.input,
							templateType
						)
						const ReturnSuccessResponse = {
							SendChangeRequest: sendChangeRequestResponse.input,
							params: request,
							secrets: process.env,
							headers,
							HotelCancelation: sendChangeRequestResponseData,
						}
						const UpdatedReturnSuccessRes = {
							...ReturnSuccessResponse,
						}

						if (UpdatedReturnSuccessRes?.output?.responseType === 'xml') {
							delete UpdatedReturnSuccessRes.headers
							return res
								.set('Content-Type', 'application/xml')
								.send(UpdatedReturnSuccessRes.output.data)
						}

						delete UpdatedReturnSuccessRes.params
						delete UpdatedReturnSuccessRes.secrets
						delete UpdatedReturnSuccessRes.headers

						if (
							Object.keys(UpdatedReturnSuccessRes).length ||
							finalResponse.length
						) {
							tavaLogger(
								corelationId,
								'Response',
								url,
								{
									status: 200,
									data: UpdatedReturnSuccessRes,
								},
								templateType
							)
							return finalResponse.length
								? {
										output: finalResponse,
								  }
								: UpdatedReturnSuccessRes
						} else return 'successfully run'
					}
					const resultCheck = await checkResponse()
					sendChangeRequestData = resultCheck

					return resultCheck
				}

				let externalOutput
				if (
					sendChangeRequestResponse.input.HotelChangeRequestResult.Error
						.ErrorCode === 0 &&
					sendChangeRequestResponse.input.sendChangeRequestStatus !== 'SUCCESS'
				) {
					const checkResponse = async () => {
						const createGetChangeRequestStatusMapper = async function () {
							function inputMapper(input, params) {
								const { TokenId } = input
								const { ChangeRequestId } = input.HotelChangeRequestResult
								return {
									TokenId,
									ChangeRequestId,
									EndUserIp: params.body.EndUserIp,
								}
							}

							return inputMapper(
								sendChangeRequestResponse.input,
								sendChangeRequestResponse.params
							)
						}
						const mapperData = await createGetChangeRequestStatusMapper()
						const createRequestforChangeRequestStatus = {
							input: mapperData,
							params: request,
							secrets: process.env,
							headers,
						}

						let changeGetRequestStatausApiResponse
						changeGetRequestStatausApiResponse =
							await callGetChangeRequestStatus(
								corelationId,
								createRequestforChangeRequestStatus.input,
								templateType
							)

						const formattedChangeGetRequestStatausApiResponse = {
							input: changeGetRequestStatausApiResponse,
							params: request,
							secrets: process.env,
							headers,
						}
						let externalOutput_6a43681d_3da9_47ae_bc80_f4f8d865f4b4
						if (
							formattedChangeGetRequestStatausApiResponse.input
								.HotelChangeRequestStatusResult.ChangeRequestStatus === 3
						) {
							const checkResponse = async () => {
								const UpdateRecordFieldsbyQuery = {
									input: formattedChangeGetRequestStatausApiResponse.input,
									params: request,
									secrets: process.env,
									headers,
								}
								const parseInputData = (inputData) => {
									const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
									const formattedOperation = []
									let match
									while ((match = regex.exec(inputData)) !== null) {
										const [, key, value, operator] = match
										formattedOperation.push({
											key,
											value,
											operator,
										})
									}
									return formattedOperation
								}
								const formattedWhereQuery = `"bookingId"='${UpdateRecordFieldsbyQuery.params.body.BookingId}'`
								const formattedSetQuery = `"cancelationStatus"= 'SUCCESS',"bookingStatus"= 'CANCELED'`
								const outputWhereData = parseInputData(formattedWhereQuery)
								const outputSetData = parseInputData(formattedSetQuery)

								let whereQuery = ''
								let setQuery = ''
								let preOperatorWhere = ''

								outputWhereData.forEach((item) => {
									if (!item.value.includes('undefined')) {
										whereQuery += ` ${whereQuery ? preOperatorWhere : ''} "${
											item.key
										}" = '${item.value}'`
									}
									preOperatorWhere = item.operator
								})
								outputSetData.forEach((item) => {
									if (!item.value.includes('undefined')) {
										setQuery += `"${item.key}" = '${item.value}'`
									}
								})

								setQuery = setQuery.replaceAll(`'"`, `',"`)
								await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
									`UPDATE "hotelBooking" SET ${setQuery} WHERE ${whereQuery}`
								)}`

								const hotelBookingDetails =
									await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
										`SELECT * FROM "hotelBooking" WHERE "bookingId" = '${UpdateRecordFieldsbyQuery.params.body.BookingId}' OFFSET 0 ROWS FETCH NEXT '20' ROWS ONLY`
									)}`
								const refundQueueMapper = async function () {
									const refundQueueRequestBody = (
										bookingDetails,
										requestResponse,
										params
									) => {
										let bookingDetail = bookingDetails[0]
										const { tavaBookingId, bookingId, paymentId } =
											bookingDetail
										return {
											tavaBookingId,
											refundAmount: String(
												requestResponse?.input?.HotelChangeRequestStatusResult
													?.RefundedAmount
											),
											source: 'TBO',
											bookingId: bookingId,
											paymentId: paymentId,
											division: 'HOTEL',
											remarks: {
												reason: params.body.Remarks,
											},
										}
									}

									return refundQueueRequestBody(
										hotelBookingDetails,
										formattedChangeGetRequestStatausApiResponse,
										formattedChangeGetRequestStatausApiResponse.params
									)
								}
								const createRefundQueueRequest = await refundQueueMapper()
								const createSingleRecordINRefundQueue = {
									input: createRefundQueueRequest,
									params: request,
									secrets: process.env,
									headers,
								}
								const createdRefundQueueResponse =
									await prisma.RefundQueue.create({
										data: createSingleRecordINRefundQueue.input,
									})
								const ReturnSuccessResponse = {
									HotelCancelation:
										formattedChangeGetRequestStatausApiResponse.input,
									params: request,
									secrets: process.env,
									headers,
									created: createdRefundQueueResponse,
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
										? {
												output: finalResponse,
										  }
										: updatedReturnSuccessRes
								} else return 'successfully run'
							}
							const resultCheck = await checkResponse()
							externalOutput_6a43681d_3da9_47ae_bc80_f4f8d865f4b4 = resultCheck

							return resultCheck
						}

						let externalOutput_043b8466_d754_4e68_baf2_967aed996cbf
						if (
							formattedChangeGetRequestStatausApiResponse.input
								.HotelChangeRequestStatusResult.ChangeRequestStatus !== 3
						) {
							const checkResponse = async () => {
								await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
									`UPDATE "hotelBooking" SET "cancelationStatus"= 'FAILED' WHERE "bookingId"='${formattedChangeGetRequestStatausApiResponse.params.body.BookingId}'`
								)}`
								const BookingDetails =
									await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
										`SELECT * FROM "hotelBooking" WHERE "bookingId" = '${formattedChangeGetRequestStatausApiResponse.params.body.BookingId}' OFFSET 0 ROWS FETCH NEXT '20' ROWS ONLY`
									)}`

								const unsettleBookingMapper = async function () {
									const data = BookingDetails[0]
									const tableData = {
										provider: data.provider,
										division: 'HOTEL',
										isCompleted: false,
										bookingId: data.id,
										tavaBookingId: data.tavaBookingId,
										retryCount: 0,
									}

									return tableData
								}
								const requestedResponse = await unsettleBookingMapper()
								const createSingleRecordInUnsettledBooking = {
									input: requestedResponse,
									params: request,
									secrets: process.env,
									headers,
								}
								const createdUnsettledBookingDetails =
									await prisma.unsettledBooking.create({
										data: createSingleRecordInUnsettledBooking.input,
									})
								const ReturnSuccessResponse = {
									HotelCancelation:
										formattedChangeGetRequestStatausApiResponse.input,
									params: request,
									secrets: process.env,
									headers,
									created: createdUnsettledBookingDetails,
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
										? {
												output: finalResponse,
										  }
										: updatedReturnSuccessRes
								} else return 'successfully run'
							}
							const resultCheck = await checkResponse()
							externalOutput_043b8466_d754_4e68_baf2_967aed996cbf = resultCheck
							return resultCheck
						}
					}
					const resultCheck = await checkResponse()
					externalOutput = resultCheck

					return resultCheck
				}
			}
			const resultCheck = await checkResponse()
			hotelCancellationResponse = resultCheck
			return res.send(resultCheck)
		}
		let hotelCancellationFailureResponse
		if (
			tboSendChangeRequestResponse.input.HotelInfoResult?.Error?.ErrorCode !== 0
		) {
			const checkResponse = async () => {
				const UpdateRecordFieldsbyQuery = {
					input: tboSendChangeRequestResponse.input,
					params: request,
					secrets: process.env,
					headers,
				}
				const parseInputData = (inputData) => {
					const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
					const formatedQuery = []
					let match
					while ((match = regex.exec(inputData)) !== null) {
						const [, key, value, operator] = match
						formatedQuery.push({
							key,
							value,
							operator,
						})
					}
					return formatedQuery
				}
				const formattedWhereQuery = `"bookingId"='${UpdateRecordFieldsbyQuery.params.body.BookingId}'`
				const formattedSetQuery = `"cancelationStatus"= 'FAILED'`
				const outputWhereData = parseInputData(formattedWhereQuery)
				const outputSetData = parseInputData(formattedSetQuery)

				let formattedWhereQueries = ''
				let SetFromattedQuery = ''
				let preOperatorWhere_94df4cab_494b_4201_ae8e_06ae6009f96f = ''

				outputWhereData.forEach((item) => {
					if (!item.value.includes('undefined')) {
						formattedWhereQueries += ` ${
							formattedWhereQueries
								? preOperatorWhere_94df4cab_494b_4201_ae8e_06ae6009f96f
								: ''
						} "${item.key}" = '${item.value}'`
					}
					preOperatorWhere_94df4cab_494b_4201_ae8e_06ae6009f96f = item.operator
				})
				outputSetData.forEach((item) => {
					if (!item.value.includes('undefined')) {
						SetFromattedQuery += `"${item.key}" = '${item.value}'`
					}
				})

				SetFromattedQuery = SetFromattedQuery.replaceAll(`'"`, `',"`)
				const updatedResponse =
					await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
						`UPDATE "hotelBooking" SET ${SetFromattedQuery} WHERE ${formattedWhereQueries}`
					)}`
				const GetMultiRecordsbyQuery = {
					input: updatedResponse,
					params: request,
					secrets: process.env,
					headers,
				}
				const parseGetMultiRecordsByQueryInputData = (inputData) => {
					const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
					const formattedQuery = []
					let match
					while ((match = regex.exec(inputData)) !== null) {
						const [, key, value, operator] = match
						formattedQuery.push({
							key,
							value,
							operator,
						})
					}
					return formattedQuery
				}
				const formattedQuery = `"bookingId" = '${GetMultiRecordsbyQuery.params.body.BookingId}'`
				const outputData = parseGetMultiRecordsByQueryInputData(formattedQuery)
				let selectedQuery = ''
				let preOperator = ''
				outputData.forEach((item) => {
					if (!item.value.includes('undefined')) {
						selectedQuery += ` ${selectedQuery ? preOperator : ''} "${
							item.key
						}" = '${item.value}'`
					}
					preOperator = item.operator
				})
				const isFormattedQueryExist = selectedQuery
					? `WHERE ${selectedQuery}`
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
				const getMultiObjectByQueryResponse =
					await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
						`SELECT * FROM "hotelBooking"  ${isFormattedQueryExist} ${sortObjExp} OFFSET 0 ROWS FETCH NEXT '20' ROWS ONLY`
					)}`
				const createUnsettleBookingRequest = async function () {
					const data = getMultiObjectByQueryResponse[0]
					const tableData = {
						provider: data.provider,
						division: 'HOTEL',
						isCompleted: false,
						bookingId: data.id,
						tavaBookingId: data.tavaBookingId,
						retryCount: 0,
					}

					return tableData
				}
				const requestData = await createUnsettleBookingRequest()
				const CreateSingleRecord = {
					input: requestData,
					params: request,
					secrets: process.env,
					headers,
				}
				const unsettledBookingResponse = await prisma.unsettledBooking.create({
					data: CreateSingleRecord.input,
				})
				const ReturnSuccessResponse = {
					HotelCancelation: sendChangeRequestResponse,
					params: request,
					secrets: process.env,
					headers,
					created: unsettledBookingResponse,
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
						? {
								output: finalResponse,
						  }
						: updatedReturnSuccessRes
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			hotelCancellationFailureResponse = resultCheck
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

const gethotelbookingsbyid = async (req, res, next) => {
	try {
		const templateType = 'travel'
		const request = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const idpAuthenticationResponse = await idpAuthentication(
			request,
			'authorize'
		)

		if (idpAuthenticationResponse.response.error)
			throw idpAuthenticationResponse.response.error

		const user = await prisma.users.findUnique({
			where: { id: idpAuthenticationResponse.response.decodedUserInfo.id },
		})

		if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
			const bookingDetails = await prisma.hotelBooking.findMany({
				where: {
					tavaBookingId: params.id,
				},
			})

			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: { result: bookingDetails },
				},
				templateType
			)
			return res.status(200).json({ result: bookingDetails })
		}

		if (user.role === 'GUEST' || user.role === 'USER') {
			const hotelBookingDetails = await prisma.hotelBooking.findMany({
				where: {
					tavaBookingId: params.id,
					userEmail: user.email,
				},
			})

			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: { result: hotelBookingDetails },
				},
				templateType
			)
			return res.status(200).json({ result: hotelBookingDetails })
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}
const gethotelbookings = async (req, res, next) => {
	try {
		const templateType = 'travel'
		const request = req
		const { body, url, params, query, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const size = parseInt(req.query.pageSize) || 10
		const page = parseInt(req.query.page) || 1
		const skip = (page - 1) * size

		const idpAuthenticationResponse = await idpAuthentication(
			request,
			'authorize'
		)

		if (idpAuthenticationResponse.response.error)
			throw idpAuthenticationResponse.response.error

		const user = await prisma.users.findUnique({
			where: {
				id: idpAuthenticationResponse.response.decodedUserInfo.id,
			},
		})

		if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
			const getBookingAndTicketingStatusMapper = async function () {
				const getBookingAndTicketingStatusCount = async () => {
					const bookingStatusesList = [
						'AWAITINGPAYMENT',
						'CONFIRMED',
						'CANCELED',
						'FAILED',
					]

					let bookingStatusCount = {}

					for (const status of bookingStatusesList) {
						const count = await prisma.hotelBooking.count({
							where: {
								bookingStatus: status,
							},
						})
						bookingStatusCount[`${status}`] = count
					}

					bookingStatusCount['UNSUCCESSFUL'] = await prisma.hotelBooking.count({
						where: {
							NOT: [
								{ bookingStatus: 'CONFIRMED' },
								{ bookingStatus: 'CANCELED' },
							],
						},
					})

					return { bookingStatusCount }
				}
				return getBookingAndTicketingStatusCount()
			}
			const counts = await getBookingAndTicketingStatusMapper()

			if (query.q) {
				const result = await prisma.hotelBooking.findMany({
					where: {
						OR: [
							{ tavaBookingId: { contains: query.q, mode: 'insensitive' } },
							{ bookingStatus: { contains: query.q, mode: 'insensitive' } },
							{ bookingId: { contains: query.q, mode: 'insensitive' } },
							{ confirmationNo: { contains: query.q, mode: 'insensitive' } },
							{ bookingRefNo: { contains: query.q, mode: 'insensitive' } },
							{ invoiceNo: { contains: query.q, mode: 'insensitive' } },
							{ provider: { contains: query.q, mode: 'insensitive' } },
							{ paymentStatus: { contains: query.q, mode: 'insensitive' } },
							{ paymentId: { contains: query.q, mode: 'insensitive' } },
							{ paymentSessionId: { contains: query.q, mode: 'insensitive' } },
							{ userEmail: { contains: query.q, mode: 'insensitive' } },
							{ guestEmail: { contains: query.q, mode: 'insensitive' } },
							{ corelationId: { contains: query.q, mode: 'insensitive' } },
						],
					},
					take: size,
					skip: skip,
				})

				const rowsCount = await prisma.hotelBooking.count({
					where: {
						OR: [
							{ tavaBookingId: { contains: query.q, mode: 'insensitive' } },
							{ bookingStatus: { contains: query.q, mode: 'insensitive' } },
							{ bookingId: { contains: query.q, mode: 'insensitive' } },
							{ confirmationNo: { contains: query.q, mode: 'insensitive' } },
							{ bookingRefNo: { contains: query.q, mode: 'insensitive' } },
							{ invoiceNo: { contains: query.q, mode: 'insensitive' } },
							{ provider: { contains: query.q, mode: 'insensitive' } },
							{ paymentStatus: { contains: query.q, mode: 'insensitive' } },
							{ paymentId: { contains: query.q, mode: 'insensitive' } },
							{ paymentSessionId: { contains: query.q, mode: 'insensitive' } },
							{ userEmail: { contains: query.q, mode: 'insensitive' } },
							{ guestEmail: { contains: query.q, mode: 'insensitive' } },
							{ corelationId: { contains: query.q, mode: 'insensitive' } },
						],
					},
				})

				const countInfo = {
					count: rowsCount,
					totalPage: Math.ceil(rowsCount / size),
					currentPage: page,
					size: size,
				}

				tavaLogger(
					corelationId,
					'Response',
					url,
					{ status: 200, data: { output: { result, countInfo, ...counts } } },
					templateType
				)
				return res
					.status(200)
					.json({ output: { countInfo, result, ...counts } })
			}

			if (!query.q) {
				const whereConditions = {}

				// Iterate over the query parameters and add conditions only for non-empty parameters
				Object.entries(req.query).forEach(([key, value]) => {
					if (value) {
						whereConditions[key] = { contains: value, mode: 'insensitive' }
					}
				})

				delete whereConditions.page
				delete whereConditions.pageSize
				delete whereConditions.status

				const getMultiRecordsAndCount = await prisma.hotelBooking.findMany({
					where: {
						AND: [whereConditions],
					},
					take: size,
					skip: skip,
				})

				let rowsCount = await prisma.hotelBooking.count({
					where: {
						AND: [whereConditions],
					},
				})

				const { resultDetails, countInfo } = {
					countInfo: {
						count: rowsCount,
						totalPage: Math.ceil(rowsCount / size),
						currentPage: page,
						size: size,
					},
					resultDetails: getMultiRecordsAndCount,
				}

				const response = { result: resultDetails, countInfo, ...counts }

				tavaLogger(
					corelationId,
					'Response',
					url,
					{ status: 200, data: { output: response } },
					templateType
				)
				return res.status(200).json({ output: response })
			}
		}

		if (user?.role === 'GUEST' || user?.role === 'USER') {
			const getBookingAndTicketingStatusMapper = async function () {
				const validateBookingCountByStatus = async () => {
					const bookingStatusesList = [
						'AWAITINGPAYMENT',
						'CONFIRMED',
						'CANCELED',
						'FAILED',
					]
					let bookingStatusCount = {}
					for (const status of bookingStatusesList) {
						const count = await prisma.hotelBooking.count({
							where: {
								userEmail:
									idpAuthenticationResponse.response.decodedUserInfo.email,
								AND: [
									{ bookingStatus: status },
									{
										userEmail: user.email,
									},
								],
							},
						})
						bookingStatusCount[`${status}`] = count
					}
					bookingStatusCount['UNSUCCESSFUL'] = await prisma.hotelBooking.count({
						where: {
							userEmail:
								idpAuthenticationResponse.response.decodedUserInfo.email,
							NOT: [
								{ bookingStatus: 'CONFIRMED' },
								{ bookingStatus: 'CANCELED' },
							],
						},
					})
					return { bookingStatusCount }
				}

				return validateBookingCountByStatus()
			}
			const counts = await getBookingAndTicketingStatusMapper()

			if (!query.q) {
				const { status, bookingStatus, secStatus, terStatus } = req.query
				const statusParams = [status, bookingStatus, secStatus, terStatus]

				const statusValues = []

				for (const param of statusParams) {
					if (param) statusValues.push(param)
				}

				let where = {
					userEmail: idpAuthenticationResponse.response.decodedUserInfo.email,
					bookingStatus: {
						in: statusValues,
					},
				}

				let currentDate = new Date().toISOString()

				if (bookingStatus === 'UPCOMING' || bookingStatus === 'CONFIRMED') {
					where = {
						userEmail: idpAuthenticationResponse.response.decodedUserInfo.email,
						bookingStatus: {
							in: ['CONFIRMED'],
						},
						checkInDate: {
							[bookingStatus === 'UPCOMING' ? 'gt' : 'lt']: currentDate,
						},
					}
				}

				const getMultiRecordsAndCount = await prisma.hotelBooking.findMany({
					where,
					take: size,
					skip: skip,
				})

				let rowsCount = await prisma.hotelBooking.count({
					where,
				})

				const { resultDetails, countInfo } = {
					countInfo: {
						count: rowsCount,
						totalPage: Math.ceil(rowsCount / size),
						currentPage: page,
						size: size,
					},
					resultDetails: getMultiRecordsAndCount,
				}

				const response = { result: resultDetails, countInfo, ...counts }

				tavaLogger(
					corelationId,
					'Response',
					url,
					{ status: 200, data: { output: response } },
					templateType
				)
				return res.status(200).json({ output: response })
			}

			if (query.q) {
				const result = await prisma.hotelBooking.findMany({
					where: {
						userEmail: idpAuthenticationResponse.response.decodedUserInfo.email,
						OR: [
							{ tavaBookingId: { contains: query.q, mode: 'insensitive' } },
							{ bookingStatus: { contains: query.q, mode: 'insensitive' } },
							{ bookingId: { contains: query.q, mode: 'insensitive' } },
							{ confirmationNo: { contains: query.q, mode: 'insensitive' } },
							{ bookingRefNo: { contains: query.q, mode: 'insensitive' } },
							{ invoiceNo: { contains: query.q, mode: 'insensitive' } },
							{ provider: { contains: query.q, mode: 'insensitive' } },
							{ paymentStatus: { contains: query.q, mode: 'insensitive' } },
							{ paymentId: { contains: query.q, mode: 'insensitive' } },
							{ paymentSessionId: { contains: query.q, mode: 'insensitive' } },
							{ userEmail: { contains: query.q, mode: 'insensitive' } },
							{ guestEmail: { contains: query.q, mode: 'insensitive' } },
							{ corelationId: { contains: query.q, mode: 'insensitive' } },
						],
					},
					take: size,
					skip: skip,
				})

				const rowsCount = await prisma.hotelBooking.count({
					where: {
						userEmail: idpAuthenticationResponse.response.decodedUserInfo.email,
						OR: [
							{ tavaBookingId: { contains: query.q, mode: 'insensitive' } },
							{ bookingStatus: { contains: query.q, mode: 'insensitive' } },
							{ bookingId: { contains: query.q, mode: 'insensitive' } },
							{ confirmationNo: { contains: query.q, mode: 'insensitive' } },
							{ bookingRefNo: { contains: query.q, mode: 'insensitive' } },
							{ invoiceNo: { contains: query.q, mode: 'insensitive' } },
							{ provider: { contains: query.q, mode: 'insensitive' } },
							{ paymentStatus: { contains: query.q, mode: 'insensitive' } },
							{ paymentId: { contains: query.q, mode: 'insensitive' } },
							{ paymentSessionId: { contains: query.q, mode: 'insensitive' } },
							{ userEmail: { contains: query.q, mode: 'insensitive' } },
							{ guestEmail: { contains: query.q, mode: 'insensitive' } },
							{ corelationId: { contains: query.q, mode: 'insensitive' } },
						],
					},
				})

				const countInfo = {
					count: rowsCount,
					totalPage: Math.ceil(rowsCount / size),
					currentPage: page,
					size: size,
				}

				tavaLogger(
					corelationId,
					'Response',
					url,
					{ status: 200, data: { output: { result, countInfo, ...counts } } },
					templateType
				)
				return res
					.status(200)
					.json({ output: { countInfo, result, ...counts } })
			}
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
	cancelhotelbooking,
	gethotelbookingsbyid,
	gethotelbookings,
}
