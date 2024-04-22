const { tavaLogger } = require('../../../helpers')
const {
	fetchOrStoreDataInCache,
} = require('../../../helpers/fetchAndUpdateCacheData')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')
const XMLWriter = require('xml-writer')
const { xml2js } = require('xml-js')
const { callHeaderData } = require('../../../services/amadeus/callHeaderData')
const { callSignout } = require('../../../services/amadeus/signout')

const amadeusticketing = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const ticketRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const CallAmadeusHeaderDataRESTAPIEndpoint = {
			input: ticketRequest,
			params: ticketRequest,
			secrets: process.env,
			headers,
		}

		let headerResponse = await callHeaderData(
			corelationId,
			CallAmadeusHeaderDataRESTAPIEndpoint,
			templateType
		)

		const CallPNRRetrieveRESTAPIEndpoint = {
			input: headerResponse,
			params: ticketRequest,
			secrets: process.env,
			headers,
			request: ticketRequest,
		}
		const queryParameters = `pnr=${CallPNRRetrieveRESTAPIEndpoint.request.body.pnr}&`
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

		let pnrRetrieveResponse
		try {
			const cacheKey = ''
			const cacheExpireTime = 0
			const isCacheRequired = false
			tavaLogger(
				corelationId,
				'Request',
				`${CallPNRRetrieveRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
				CallPNRRetrieveRESTAPIEndpoint.input,
				templateType
			)
			const fetchData = async () =>
				await axios
					.post(
						`${
							CallPNRRetrieveRESTAPIEndpoint.secrets
								.BACKEND_DEPLOYED_INSTANCE_URL
						}/pnr-retrieve?${createQueryString(jsonObj)}`,
						CallPNRRetrieveRESTAPIEndpoint.input,
						{
							headers: {
								'x-request-id': `${CallPNRRetrieveRESTAPIEndpoint.headers['x-request-id']}`,
							},
						}
					)
					.then(async (res) => {
						tavaLogger(
							corelationId,
							'Response',
							`${CallPNRRetrieveRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
							res,
							templateType
						)
						return res.data
					})
			pnrRetrieveResponse = isCacheRequired
				? await fetchOrStoreDataInCache(fetchData, cacheKey, cacheExpireTime)
				: await fetchData()
		} catch (error) {
			console.log(
				'Error occurred in :  `${CallPNRRetrieveRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`',
				error
			)
			if (error.response) {
				const { status, data } = error?.response
				tavaLogger(
					corelationId,
					'Error',
					`${CallPNRRetrieveRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
					error,
					templateType
				)
				throw res.status(status).json(data)
			}
			throw error
		}
		const AmadeusTicketRequest = {
			input: pnrRetrieveResponse,
			params: ticketRequest,
			secrets: process.env,
			headers,
		}

		const createDocIssuanceRequest = async function () {
			const bookingData = AmadeusTicketRequest.params.body
			const sessionData =
				AmadeusTicketRequest.input.output['soap:Envelope']['soap:Header'][
					'awsse:Session'
				]
			const securityToken = sessionData['awsse:SecurityToken']._text
			const sessionId = sessionData['awsse:SessionId']._text
			const sequenceNumber =
				parseInt(sessionData['awsse:SequenceNumber']._text) + 1
			function amadeusHeader() {
				const { v4: uuidv4 } = require('uuid')
				const generateCredentials = () => {
					function generateUUID() {
						return uuidv4()
					}
					const messageID = generateUUID()
					const uniqueID = generateUUID()
					return {
						messageId: messageID,
						uniqueId: uniqueID,
					}
				}
				return generateCredentials()
			}
			const headerData = amadeusHeader()
			const createSoapEnvelope = (xmlWriter) => {
				xmlWriter
					.startElement('soap:Envelope')
					.writeAttribute(
						'xmlns:soap',
						'http://schemas.xmlsoap.org/soap/envelope/'
					)
				return xmlWriter
			}
			const createSoapHeader = (xmlWriter) => {
				xmlWriter
					.startElement(
						'soap:Header',
						'xmlns:soap',
						'http://schemas.xmlsoap.org/soap/envelope/'
					)
					.startElement('awsse:Session')
					.writeAttribute(
						'xmlns:awsse',
						'http://xml.amadeus.com/2010/06/Session_v3'
					)
					.writeAttribute('TransactionStatusCode', 'InSeries')
					.startElement('awsse:SessionId')
					.text(sessionId)
					.endElement()
					.startElement('awsse:SequenceNumber')
					.text(sequenceNumber)
					.endElement()
					.startElement('awsse:SecurityToken')
					.text(securityToken)
					.endElement()
					.endElement()
					.startElement('add:MessageID')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(headerData.messageId)
					.endElement()
					.startElement('add:Action')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text('http://webservices.amadeus.com/TTKTIQ_15_1_1A')
					.endElement()
					.startElement('add:To')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(
						AmadeusTicketRequest.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO'
					)
					.endElement()
					.startElement('link:TransactionFlowLink')
					.writeAttribute(
						'xmlns:link',
						'http://wsdl.amadeus.com/2010/06/ws/Link_v1'
					)
					.startElement('link:Consumer')
					.startElement('link:UniqueID')
					.text(headerData.uniqueId)
					.endElement()
					.endElement()
					.endElement()
					.startElement('AMA_SecurityHostedUser')
					.writeAttribute('xmlns', 'http://xml.amadeus.com/2010/06/Security_v1')
					.endElement()
					.endElement()
				return xmlWriter
			}

			const createSoapbody = (xmlWriter) => {
				return xmlWriter
					.startElement('soap:Body')
					.startElement('DocIssuance_IssueTicket')
					.startElement('optionGroup')
					.startElement('switches')
					.startElement('statusDetails')
					.startElement('indicator')
					.text('ET')
					.endElement()
					.endElement()
					.endElement()
					.endElement()
					.endElement()
					.endElement()
			}

			const request = () => {
				const xmlWriter = new XMLWriter({ indent: '  ' })

				createSoapEnvelope(xmlWriter)
				createSoapHeader(xmlWriter)
				createSoapbody(xmlWriter)

				xmlWriter.endElement()

				return xmlWriter.toString()
			}
			const soapRequest = request()
			return {
				soapEticketData: soapRequest,
				bookingData: bookingData,
			}
		}
		const issueTicketRequest = await createDocIssuanceRequest()
		const CallIssueTicketSOAPAPI = {
			input: issueTicketRequest,
			params: ticketRequest,
			secrets: process.env,
			headers,
		}

		const xmlToJson = (data = '') =>
			xml2js(data, {
				compact: true,
				textKey: '_text',
				cdataKey: '_text',
			})

		let issueTicketResponse
		let responseType = 'json'
		tavaLogger(
			corelationId,
			'Request',
			url,
			CallIssueTicketSOAPAPI.input.soapEticketData,
			templateType
		)
		try {
			issueTicketResponse = await axios(
				`${CallIssueTicketSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
				{
					method: 'post',
					headers: {
						SOAPAction: `http://webservices.amadeus.com/TTKTIQ_15_1_1A`,
					},
					data: CallIssueTicketSOAPAPI.input.soapEticketData,
				}
			).then(async (res) => {
				tavaLogger(corelationId, 'Response', url, res, templateType)
				return responseType === 'json'
					? xmlToJson(res.data)
					: {
							data: res.data,
							responseType: responseType,
					  }
			})
		} catch (error) {
			if (error.response) {
				const { status, data } = error?.response
				tavaLogger(corelationId, 'Error', url, error, templateType)
				throw res.status(status).json(xmlToJson(data))
			}
			throw error
		}
		const TicketFailed = {
			input: issueTicketResponse,
			params: ticketRequest,
			secrets: process.env,
			headers,
		}
		let errorExternalOutput
		if (
			TicketFailed.input['soap:Envelope']['soap:Body'][
				'DocIssuance_IssueTicketReply'
			]['processingStatus'].statusCode._text == 'X'
		) {
			const checkResponse = async () => {
				const inputData = {
					...TicketFailed,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const CallSignoutAPIEndpoint = {
					input: inputData,
					params: ticketRequest,
					secrets: process.env,
					headers,
				}
				let signoutResponse = await callSignout(
					corelationId,
					CallSignoutAPIEndpoint,
					CallSignoutAPIEndpoint.input.input,
					templateType
				)
				const RunJavaScriptCode = {
					input: signoutResponse,
					params: ticketRequest,
					secrets: process.env,
					headers,
					internalOutput: inputData,
				}
				const mapper = async function () {
					return {
						updatedAt: new Date().toISOString(),
						ticketingStatus: 'FAILED',
					}
				}
				const bookData = await mapper()
				const UpdateRecordFieldsbyId = {
					input: bookData,
					params: ticketRequest,
					secrets: process.env,
					headers,
				}
				const parseInputData = (inputData) => {
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
				const formattedQuery = `"updatedAt" = '${UpdateRecordFieldsbyId.input.updatedAt}',"ticketingStatus" = '${UpdateRecordFieldsbyId.input.ticketingStatus}'`
				const outputData = parseInputData(formattedQuery)
				let query = {}
				let preOperator = ''
				outputData.forEach((item) => {
					if (!item.value.includes('undefined')) {
						query[`${item.key}`] = item.value
					}
					preOperator = item.operator
				})
				const updatedBookingData = await prisma.Booking.update({
					where: {
						id: UpdateRecordFieldsbyId.params.body.id,
					},
					data: query,
				})

				const ReturnSuccessResponse = {
					ticketResponse: inputData,
					params: ticketRequest,
					secrets: process.env,
					headers,
					updated: updatedBookingData,
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
			errorExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		const TicketPass = {
			input: issueTicketResponse,
			params: ticketRequest,
			secrets: process.env,
			headers,
		}
		let ticketPassExternalOutput
		if (
			TicketPass.input['soap:Envelope']['soap:Body'][
				'DocIssuance_IssueTicketReply'
			]['processingStatus'].statusCode._text != 'X'
		) {
			const checkResponse = async () => {
				const inputData = {
					...TicketPass,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const CallPNRRetrieveRESTAPIEndpoint = {
					input: inputData,
					params: ticketRequest,
					secrets: process.env,
					headers,
				}
				const queryParameters = `pnr=${CallPNRRetrieveRESTAPIEndpoint.params.body.pnr}&flow=ticket&`
				const queryParams = queryParameters
					.replace(/=/g, ':')
					.replace(/&/g, ',')

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

				let pnrRetrieveResponse
				try {
					const cacheKey = ''
					const cacheExpireTime = 0
					const isCacheRequired = false
					tavaLogger(
						corelationId,
						'Request',
						`${CallPNRRetrieveRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
						CallPNRRetrieveRESTAPIEndpoint.input.input,
						templateType
					)
					const fetchData = async () =>
						await axios
							.post(
								`${
									CallPNRRetrieveRESTAPIEndpoint.secrets
										.BACKEND_DEPLOYED_INSTANCE_URL
								}/pnr-retrieve?${createQueryString(jsonObj)}`,
								CallPNRRetrieveRESTAPIEndpoint.input.input,
								{
									headers: {
										'x-request-id': `${CallPNRRetrieveRESTAPIEndpoint.headers['x-request-id']}`,
									},
								}
							)
							.then(async (res) => {
								tavaLogger(
									corelationId,
									'Response',
									`${CallPNRRetrieveRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
									res,
									templateType
								)
								return res.data
							})
					pnrRetrieveResponse = isCacheRequired
						? await fetchOrStoreDataInCache(
								fetchData,
								cacheKey,
								cacheExpireTime
						  )
						: await fetchData()
				} catch (error) {
					console.log(
						'Error occurred in :  `${CallPNRRetrieveRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`',
						error
					)
					if (error.response) {
						const { status, data } = error?.response
						tavaLogger(
							corelationId,
							'Error',
							`${CallPNRRetrieveRESTAPIEndpoint.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
							error,
							templateType
						)
						throw res.status(status).json(data)
					}
					throw error
				}
				const MissingTicketNumber = {
					input: pnrRetrieveResponse,
					params: ticketRequest,
					secrets: process.env,
					headers,
				}
				let missingTicketNumberExternalOutput
				if (
					MissingTicketNumber.input.output['soap:Envelope']['soap:Fault']
						?.faultstring?._text
				) {
					const checkResponse = async () => {
						const inputData = {
							...MissingTicketNumber,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const CallSignoutAPIEndpoint = {
							input: inputData,
							params: ticketRequest,
							secrets: process.env,
							headers,
						}

						let signoutResponse = await callSignout(
							corelationId,
							CallSignoutAPIEndpoint,
							CallSignoutAPIEndpoint.input.input,
							templateType
						)

						const ReturnSuccessResponse = {
							internalOutput: inputData,
							params: ticketRequest,
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
					missingTicketNumberExternalOutput = resultCheck
					return resultCheck
				}
				const FoundTicketNumber = {
					input: pnrRetrieveResponse,
					params: ticketRequest,
					secrets: process.env,
					headers,
				}
				let foundTicketNumberExternalOutput
				if (
					!FoundTicketNumber.input.output['soap:Envelope']['soap:Fault']
						?.faultstring?._text
				) {
					const checkResponse = async () => {
						const inputData = {
							...FoundTicketNumber,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const CallSignoutAPIEndpoint = {
							input: inputData,
							params: ticketRequest,
							secrets: process.env,
							headers,
						}

						let signoutResponse = await callSignout(
							corelationId,
							CallSignoutAPIEndpoint,
							CallSignoutAPIEndpoint.input.input.output,
							templateType
						)
						const FinalTicketResponse = {
							output: signoutResponse,
							params: ticketRequest,
							secrets: process.env,
							headers,
							input: inputData,
						}

						const updateBookingData = async function () {
							pnrReply = FinalTicketResponse.input.input.output

							const getLongFreeTextsByType = (pnrReply, targetType) => {
								const dataElementsIndiv =
									pnrReply['soap:Envelope']['soap:Body']['PNR_Reply'][
										'dataElementsMaster'
									]['dataElementsIndiv']
								const result = []
								for (const element of dataElementsIndiv) {
									if (
										element.otherDataFreetext &&
										element.otherDataFreetext.freetextDetail &&
										element.otherDataFreetext.freetextDetail.type._text ===
											targetType
									) {
										result.push(element.otherDataFreetext.longFreetext._text)
									}
								}
								return result
							}

							const extractNumbers = (inputStrings) => {
								const regex = /PAX (\d{3}-\d{10})/
								const extractedNumbers = []

								for (const inputString of inputStrings) {
									const match = inputString.match(regex)
									if (match && match[1]) {
										extractedNumbers.push(match[1])
									}
								}

								return extractedNumbers
							}

							// Get longFreeTexts for type "P06"
							const longFreeTextsForP06 = getLongFreeTextsByType(
								pnrReply,
								'P06'
							)

							// Extract numbers from each longFreeText
							const extractedNumbers = extractNumbers(longFreeTextsForP06)

							let ticketingJson = {
								ticketJSON: {
									ticketsnumber: extractedNumbers.map((number) => ({
										number,
									})),
									marketIataCode: 'IN',
								},
							}

							ticketingJson = JSON.stringify(ticketingJson)

							return {
								updatedAt: new Date().toISOString(),
								ticketingJSON: ticketingJson,
								ticketingStatus:
									extractedNumbers.length > 0 ? 'CONFIRMED' : 'NA',
								status: extractedNumbers.length > 0 ? 'CONFIRMED' : 'NA',
							}
						}
						const updatedBookingData = await updateBookingData()
						const UpdateBookingRecordFields = {
							input: updatedBookingData,
							params: ticketRequest,
							secrets: process.env,
							headers,
						}
						const parseInputData = (inputData) => {
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
						const formattedQuery = `"status" = '${UpdateBookingRecordFields.input.status}',"ticketingJSON" = '${UpdateBookingRecordFields.input.ticketingJSON}',"ticketingStatus" = '${UpdateBookingRecordFields.input.ticketingStatus}',"updatedAt" = '${UpdateBookingRecordFields.input.updatedAt}'`
						const outputData = parseInputData(formattedQuery)
						let query = {}
						let preOperator = ''
						outputData.forEach((item) => {
							if (!item.value.includes('undefined')) {
								query[`${item.key}`] = item.value
							}
							preOperator = item.operator
						})
						const updatedBookingTable = await prisma.Booking.update({
							where: {
								id: UpdateBookingRecordFields.params.body.id,
							},
							data: query,
						})
						const ReturnSuccessResponse = {
							output: updatedBookingTable,
							params: ticketRequest,
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
					foundTicketNumberExternalOutput = resultCheck
					return resultCheck
				}
			}
			const resultCheck = await checkResponse()
			ticketPassExternalOutput = resultCheck
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
	amadeusticketing,
}
