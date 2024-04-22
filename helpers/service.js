const { getDataFromCache } = require('../helpers/getDataFromCache')
const { setDataInCache } = require('../helpers/setDataInCache')
const ejs = require('ejs')
const { convert } = require('html-to-text')
const RabbitMQClient = require('../rabbitmq/client')
const { convertHtmlToPdf } = require('../helpers/convertHtmlToPdf')
const fs = require('fs')
const prismaClient = require('../prismaClient')
const { prisma } = prismaClient
const { tavaLogger } = require('../helpers')
const {
	fetchOrStoreDataInCache,
} = require('../helpers/fetchAndUpdateCacheData')
const axios = require('axios')
const XMLWriter = require('xml-writer')
const { xml2js, json2xml } = require('xml-js')
const { callHeaderData } = require('../services/amadeus/callHeaderData')
const { callSignout } = require('../services/amadeus/signout')
const { callPNRCancel } = require('../services/amadeus/cancelPNR')
const { getCurrencySymbolFromCode } = require('./getCurrencySymbolFromCode')

const atcrefundsubflow = async (req, res, next, corelationId, url) => {
	try {
		const StartATCRefundSubflow = {}
		const finalResponse = []
		const templateType = 'travel'
		const atcRefundRequest = req
		const { body, params, method, headers } = req.params

		const CallAmadeusHeaderDataRESTAPIEndpoint = {
			input: atcRefundRequest,
			params: atcRefundRequest,
			secrets: process.env,
			headers,
		}

		let headerDataResponse = await callHeaderData(
			corelationId,
			CallAmadeusHeaderDataRESTAPIEndpoint,
			templateType
		)

		const CallPNRRetrieveRESTAPIEndpoint = {
			input: headerDataResponse,
			params: atcRefundRequest,
			secrets: process.env,
			headers,
		}
		const queryParameters = `pnr=${CallPNRRetrieveRESTAPIEndpoint.params.params.body.pnr}&`
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
						{ headers: {} }
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
		const PNRResponseData = {
			input: pnrRetrieveResponse,
			params: atcRefundRequest,
			secrets: process.env,
			headers,
		}

		const checkHKElement = async function () {
			const data =
				PNRResponseData.input.output['soap:Envelope']['soap:Body']['PNR_Reply']
					?.originDestinationDetails?.itineraryInfo
			const apiRes = PNRResponseData.input
			const res = {
				apiRes: apiRes,
			}
			let checkForConfirm = true
			const checkForConfirmed = (temp) => {
				for (let i = 0; i < temp.length; i++) {
					if (temp[i].relatedProduct?.status?._text !== 'HK') {
						checkForConfirm = false
					}
				}
			}
			checkForConfirmed(data)
			res.result = checkForConfirm
			return res
		}
		const checkForConfirm = await checkHKElement()
		const IFHKIsPresent = {
			input: checkForConfirm,
			params: atcRefundRequest,
			secrets: process.env,
			headers,
		}
		let externalOutput_9ae6dd55_0da8_483c_9f9f_3f8c48969939
		if (IFHKIsPresent.input.result) {
			const checkResponse = async () => {
				const inputData = {
					...IFHKIsPresent,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const TicketProcessEDocData = {
					input: inputData,
					params: atcRefundRequest,
					secrets: process.env,
					headers,
				}

				const createTicketProcessEDocRequest = async function () {
					{
						const documentNumbers =
							TicketProcessEDocData.params.input.body.ticketJson.ticketNumbers
						const sessionData =
							TicketProcessEDocData.input.input.apiRes.output['soap:Envelope'][
								'soap:Header'
							]['awsse:Session']
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
								.writeAttribute(
									'xmlns:add',
									'http://www.w3.org/2005/08/addressing'
								)
								.text(headerData.messageId)
								.endElement()
								.startElement('add:Action')
								.writeAttribute(
									'xmlns:add',
									'http://www.w3.org/2005/08/addressing'
								)
								.text('http://webservices.amadeus.com/TATREQ_20_1_1A')
								.endElement()
								.startElement('add:To')
								.writeAttribute(
									'xmlns:add',
									'http://www.w3.org/2005/08/addressing'
								)
								.text(
									TicketProcessEDocData.secrets.AMADEUS_API_BASE_URL +
										'/1ASIWTAVIOO'
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
								.writeAttribute(
									'xmlns',
									'http://xml.amadeus.com/2010/06/Security_v1'
								)
								.endElement()
								.endElement()
							return xmlWriter
						}

						const createSoapBody = (xmlWriter) => {
							xmlWriter
								.startElement('soap:Body')
								.startElement('Ticket_ProcessEDoc')
								.startElement('msgActionDetails')
								.startElement('messageFunctionDetails')
								.writeElement('messageFunction', '131')
								.endElement()
								.endElement()
							for (const ticketNumber of documentNumbers) {
								xmlWriter
									.startElement('infoGroup')
									.startElement('docInfo')
									.startElement('documentDetails')
									.writeElement('number', ticketNumber)
									.endElement()
									.endElement()
									.endElement()
							}

							xmlWriter.endElement().endElement()
							return xmlWriter
						}

						const request = () => {
							const xmlWriter = new XMLWriter({ indent: '  ' })

							createSoapEnvelope(xmlWriter)
							createSoapHeader(xmlWriter)
							createSoapBody(xmlWriter)

							xmlWriter.endElement()
							return xmlWriter
						}

						return request()
					}
				}
				const ticketProcessEDocRequest = await createTicketProcessEDocRequest()
				const CallTicketProcessEDocSOAPAPI = {
					input: ticketProcessEDocRequest,
					params: atcRefundRequest,
					secrets: process.env,
					headers,
				}

				const xmlToJson = (data = '') =>
					xml2js(data, {
						compact: true,
						textKey: '_text',
						cdataKey: '_text',
					})

				let ticketProcessEDocResponse
				let responseType = 'json'
				tavaLogger(
					corelationId,
					'Request',
					url,
					CallTicketProcessEDocSOAPAPI.input.output,
					templateType
				)
				try {
					ticketProcessEDocResponse = await axios(
						`${CallTicketProcessEDocSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
						{
							method: 'post',
							headers: {
								SOAPAction: `http://webservices.amadeus.com/TATREQ_20_1_1A`,
							},
							data: CallTicketProcessEDocSOAPAPI.input.output,
						}
					).then(async (res) => {
						tavaLogger(
							corelationId,
							'Response',
							url,
							res,
							templateType
						)
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
				const TicketProcessEDocSuccessResponse = {
					input: ticketProcessEDocResponse,
					params: atcRefundRequest,
					secrets: process.env,
					headers,
				}
				let ticketProcessEDocSuccessExternalOutput
				if (
					!(
						TicketProcessEDocSuccessResponse.input['soap:Envelope'][
							'soap:Body'
						]['Ticket_ProcessEDocReply']['docGroup']?.error?.errorDetails ||
						TicketProcessEDocSuccessResponse.input['soap:Envelope'][
							'soap:Body'
						]['Ticket_ProcessEDocReply']?.error?.errorDetails ||
						TicketProcessEDocSuccessResponse.input['soap:Envelope'][
							'soap:Body'
						]['soap:Fault']?.faultcode?._text
					)
				) {
					const checkResponse = async () => {
						const inputData = {
							...TicketProcessEDocSuccessResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const TicketInitRefundData = {
							input: inputData,
							params: atcRefundRequest,
							secrets: process.env,
							headers,
						}

						const createTicketInitRefundRequest = async function () {
							{
								const documentNumbers =
									TicketInitRefundData.params.input.body.ticketJson
										.ticketNumbers
								const sessionData =
									TicketInitRefundData.input.input['soap:Envelope'][
										'soap:Header'
									]['awsse:Session']
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
										.writeAttribute(
											'xmlns:add',
											'http://www.w3.org/2005/08/addressing'
										)
										.text(headerData.messageId)
										.endElement()
										.startElement('add:Action')
										.writeAttribute(
											'xmlns:add',
											'http://www.w3.org/2005/08/addressing'
										)
										.text(
											'http://webservices.amadeus.com/Ticket_InitRefund_3.0'
										) //
										.endElement()
										.startElement('add:To')
										.writeAttribute(
											'xmlns:add',
											'http://www.w3.org/2005/08/addressing'
										)
										.text(
											TicketInitRefundData.secrets.AMADEUS_API_BASE_URL +
												'/1ASIWTAVIOO'
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
										.writeAttribute(
											'xmlns',
											'http://xml.amadeus.com/2010/06/Security_v1'
										)
										.endElement()
										.endElement()
									return xmlWriter
								}

								const createSoapBody = (xmlWriter) => {
									xmlWriter.startDocument()
									xmlWriter.startElement('soap:Body')
									xmlWriter.startElement('AMA_TicketInitRefundRQ')
									xmlWriter.writeAttribute('Version', '3.000')
									xmlWriter.startElement('Contracts')
									for (const ticketNumer of documentNumbers) {
										xmlWriter.startElement('Contract')
										xmlWriter.writeAttribute('Number', ticketNumer)
										xmlWriter.endElement()
									}
									xmlWriter.endElement()
									xmlWriter.startElement('ActionDetails')
									xmlWriter.startElement('ActionDetail')
									xmlWriter.writeAttribute('Indicator', 'ATC')
									xmlWriter.endElement()
									xmlWriter.endElement()
									xmlWriter.endElement()
									xmlWriter.endElement()
									xmlWriter.endDocument()
								}

								const request = () => {
									const xmlWriter = new XMLWriter({ indent: '  ' })

									createSoapEnvelope(xmlWriter)
									createSoapHeader(xmlWriter)
									createSoapBody(xmlWriter)

									xmlWriter.endElement()

									return xmlWriter
								}
								return request()
							}
						}
						const ticketInitRefundRequest =
							await createTicketInitRefundRequest()
						const CallTicketInitRefundSOAPAPI = {
							input: ticketInitRefundRequest,
							params: atcRefundRequest,
							secrets: process.env,
							headers,
						}

						const xmlToJson = (data = '') =>
							xml2js(data, {
								compact: true,
								textKey: '_text',
								cdataKey: '_text',
							})

						let ticketInitRefundResponse
						let responseType = 'json'
						tavaLogger(
							corelationId,
							'Request',
							url,
							CallTicketInitRefundSOAPAPI.input.output,
							templateType
						)
						try {
							ticketInitRefundResponse = await axios(
								`${CallTicketInitRefundSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
								{
									method: 'post',
									headers: {
										SOAPAction: `http://webservices.amadeus.com/Ticket_InitRefund_3.0`,
									},
									data: CallTicketInitRefundSOAPAPI.input.output,
								}
							).then(async (res) => {
								tavaLogger(
									corelationId,
									'Response',
									url,
									res,
									templateType
								)
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
								tavaLogger(
									corelationId,
									'Error',
									url,
									error,
									templateType
								)
								throw res.status(status).json(xmlToJson(data))
							}
							throw error
						}
						const TicketInitRefundSuccessResponse = {
							input: ticketInitRefundResponse,
							params: atcRefundRequest,
							secrets: process.env,
							headers,
						}
						let ticketInitRefundSuccessExternalOutput
						if (
							!(
								TicketInitRefundSuccessResponse.input['soap:Envelope'][
									'soap:Body'
								]['AMA_TicketInitRefundRS']?.error?.errorDetails ||
								TicketInitRefundSuccessResponse.input['soap:Envelope'][
									'soap:Body'
								]['soap:Fault']?.faultcode?._text
							)
						) {
							const checkResponse = async () => {
								const inputData = {
									...TicketInitRefundSuccessResponse,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers

								const ReturnSuccessResponse = {
									internalOutput: inputData,
									params: atcRefundRequest,
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
							ticketInitRefundSuccessExternalOutput = resultCheck

							return resultCheck
						}
						const TicketInitRefundErrorResponse = {
							input: ticketInitRefundResponse,
							params: atcRefundRequest,
							secrets: process.env,
							headers,
						}
						let ticketInitRefundErrorExternalOutput
						if (
							TicketInitRefundErrorResponse.input['soap:Envelope']['soap:Body'][
								'AMA_TicketInitRefundRS'
							]?.error?.errorDetails ||
							TicketInitRefundErrorResponse.input['soap:Envelope']['soap:Body'][
								'soap:Fault'
							]?.faultcode?._text
						) {
							const checkResponse = async () => {
								const inputData = {
									...TicketInitRefundErrorResponse,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers

								const CallSignoutAPIEndpoint = {
									input: inputData,
									params: atcRefundRequest,
									secrets: process.env,
									headers,
								}

								const signoutResponse = await callSignout(
									corelationId,
									CallSignoutAPIEndpoint,
									CallSignoutAPIEndpoint.input.input,
									templateType
								)

								const ReturnSuccessResponse = {
									internalOutput: inputData,
									params: atcRefundRequest,
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
							ticketInitRefundErrorExternalOutput = resultCheck
							return res.send(resultCheck)
						}
					}
					const resultCheck = await checkResponse()
					ticketProcessEDocSuccessExternalOutput = resultCheck

					return resultCheck
				}
				const TicketProcessEDocErrorResponse = {
					input: ticketProcessEDocResponse,
					params: atcRefundRequest,
					secrets: process.env,
					headers,
				}
				let ticketProcessEDocErrorExternalOutput
				if (
					TicketProcessEDocErrorResponse.input['soap:Envelope']['soap:Body'][
						'Ticket_ProcessEDocReply'
					]['generalDocGroup']?.error?.errorDetails ||
					TicketProcessEDocErrorResponse.input['soap:Envelope']['soap:Body'][
						'Ticket_ProcessEDocReply'
					]?.error?.errorDetails ||
					TicketProcessEDocErrorResponse.input['soap:Envelope']['soap:Body'][
						'soap:Fault'
					]?.faultcode?._text
				) {
					const checkResponse = async () => {
						const inputData = {
							...TicketProcessEDocErrorResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const CallSignoutAPIEndpoint = {
							input: inputData,
							params: atcRefundRequest,
							secrets: process.env,
							headers,
						}

						const signoutResponse = await callSignout(
							corelationId,
							CallSignoutAPIEndpoint,
							CallSignoutAPIEndpoint.input.input,
							templateType
						)
						const ReturnSuccessResponse = {
							internalOutput: inputData,
							params: atcRefundRequest,
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
					ticketProcessEDocErrorExternalOutput = resultCheck
					return res.send(resultCheck)
				}
			}
			const resultCheck = await checkResponse()
			externalOutput_9ae6dd55_0da8_483c_9f9f_3f8c48969939 = resultCheck

			return resultCheck
		}
		const IfHKIsNotPresent = {
			input: checkForConfirm,
			params: atcRefundRequest,
			secrets: process.env,
			headers,
		}
		let hkIsNotPresentExternalOutput
		if (!IfHKIsNotPresent.input.result) {
			const checkResponse = async () => {
				const inputData = {
					...IfHKIsNotPresent,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const PNRAddMultiData = {
					input: inputData,
					params: atcRefundRequest,
					secrets: process.env,
					headers,
				}

				const createPNRAddMultiRequest = async function () {
					const sessionData =
						PNRAddMultiData.input.input.apiRes.output['soap:Envelope'][
							'soap:Header'
						]['awsse:Session']
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
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text(headerData.messageId)
							.endElement()
							.startElement('add:Action')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text('http://webservices.amadeus.com/PNRADD_21_1_1A')
							.endElement()
							.startElement('add:To')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text(
								PNRAddMultiData.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO'
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
							.writeAttribute(
								'xmlns',
								'http://xml.amadeus.com/2010/06/Security_v1'
							)
							.endElement()
							.endElement()
						return xmlWriter
					}

					const createSoapbody = (xmlWriter) => {
						xmlWriter
							.startElement('soap:Body')
							.startElement('PNR_AddMultiElements')
							.startElement('pnrActions')
							.writeElement('optionCode', '20')
							.endElement()
							.endElement()
							.endElement()
					}

					const request = () => {
						const xmlWriter = new XMLWriter({ indent: ' ' })
						createSoapEnvelope(xmlWriter)
						createSoapHeader(xmlWriter)
						createSoapbody(xmlWriter)
						xmlWriter.endElement()
						return xmlWriter.toString()
					}
					return request()
				}
				const pnrAddMultiRequest = await createPNRAddMultiRequest()
				const CallPNRAddMultiSOAPAPI = {
					input: pnrAddMultiRequest,
					params: atcRefundRequest,
					secrets: process.env,
					headers,
				}

				const xmlToJson = (data = '') =>
					xml2js(data, {
						compact: true,
						textKey: '_text',
						cdataKey: '_text',
					})

				let addMultiElementResponse
				let responseType = 'json'
				tavaLogger(
					corelationId,
					'Request',
					url,
					CallPNRAddMultiSOAPAPI.input,
					templateType
				)
				try {
					addMultiElementResponse = await axios(
						`${CallPNRAddMultiSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
						{
							method: 'post',
							headers: {
								SOAPAction: `http://webservices.amadeus.com/PNRADD_21_1_1A`,
							},
							data: CallPNRAddMultiSOAPAPI.input,
						}
					).then(async (res) => {
						tavaLogger(
							corelationId,
							'Response',
							url,
							res,
							templateType
						)
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
				const CallSignoutAPIEndpoint = {
					input: addMultiElementResponse,
					params: atcRefundRequest,
					secrets: process.env,
					headers,
				}

				const signoutResponse = await callSignout(
					corelationId,
					CallSignoutAPIEndpoint,
					CallSignoutAPIEndpoint.input,
					templateType
				)

				const ReturnSuccessResponse = {
					output: addMultiElementResponse,
					params: atcRefundRequest,
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
			hkIsNotPresentExternalOutput = resultCheck
			return res.send(resultCheck)
		}
	} catch (error) {
		const templateType = 'travel'

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

const amadeuspnrcancel = async (req, res, next, corelationId, url) => {
	try {
		const requestData = {}
		const finalResponse = []
		const templateType = 'travel'
		const httpRequest = req
		const { body, params, method, headers } = httpRequest.params
		const triggerData = {
			input: httpRequest,
			params: httpRequest,
			secrets: process.env,
			headers,
		}
		let externalOutput

		if (
			triggerData.input['input'].provider === 'AM' ||
			triggerData.input['input'].provider === 'AMADEUS'
		) {
			const checkResponse = async () => {
				const requestData = { ...triggerData }
				delete requestData.params
				delete requestData.secrets
				delete requestData.headers

				const apiEndpointConfig = {
					input: requestData,
					params: httpRequest,
					secrets: process.env,
					headers,
				}

				let headerData
				try {
					headerData = await callHeaderData(
						corelationId,
						apiEndpointConfig,
						templateType
					)
				} catch (error) {
					console.log(`Error occurred while fetching header data: ${error}`)
					throw error
				}

				const apiConfig = {
					input: headerData,
					params: httpRequest,
					secrets: process.env,
					headers,
				}

				const queryParams = `pnr=${apiConfig.params.input.pnr}&`
				const queryParamsReplaced = queryParams
					.replace(/=/g, ':')
					.replace(/&/g, ',')

				const queryParamsPairs = queryParamsReplaced.split(',')
				const queryParamsObj = {}
				for (let pair of queryParamsPairs) {
					const [key, value] = pair.split(':')
					queryParamsObj[key] = value
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

				let pnrRetrievalResult
				try {
					const cacheKey = ''
					const cacheExpireTime = 0
					const isCacheRequired = false
					tavaLogger(
						corelationId,
						'Request',
						`${apiConfig.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
						apiConfig.input,
						templateType
					)
					const fetchData = async () =>
						await axios
							.post(
								`${
									apiConfig.secrets.BACKEND_DEPLOYED_INSTANCE_URL
								}/pnr-retrieve?${createQueryString(queryParamsObj)}`,
								apiConfig.input,
								{ headers: {} }
							)
							.then(async (res) => {
								tavaLogger(
									corelationId,
									'Response',
									`${apiConfig.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
									res,
									templateType
								)
								return res.data
							})
					pnrRetrievalResult = isCacheRequired
						? await fetchOrStoreDataInCache(
								fetchData,
								cacheKey,
								cacheExpireTime
						  )
						: await fetchData()
				} catch (error) {
					console.log(
						`Error occurred in: ${apiConfig.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
						error
					)
					if (error.response) {
						const { status, data } = error?.response
						tavaLogger(
							corelationId,
							'Error',
							`${apiConfig.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/pnr-retrieve?`,
							error,
							templateType
						)
						throw res.status(status).json(data)
					}
					throw error
				}

				const runJavaScriptConfig = {
					input: pnrRetrievalResult,
					params: httpRequest,
					secrets: process.env,
					headers,
				}

				const rjcConfig = runJavaScriptConfig

				const prepareCancelRequest = async function () {
					const sessionData =
						rjcConfig.input.output['soap:Envelope']['soap:Header'][
							'awsse:Session'
						]
					const securityToken = sessionData['awsse:SecurityToken']._text
					const sessionId = sessionData['awsse:SessionId']._text
					let sequenceNumber =
						parseInt(sessionData['awsse:SequenceNumber']._text) + 1

					function generateAmadeusHeader() {
						const { v4: uuidv4 } = require('uuid')
						function generateCredentials() {
							const messageID = uuidv4()
							const uniqueID = uuidv4()
							return { messageId: messageID, uniqueId: uniqueID }
						}
						return generateCredentials()
					}

					const headerData = generateAmadeusHeader()

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
							.writeAttribute('TransactionStatusCode', 'End')
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
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text(headerData.messageId)
							.endElement()
							.startElement('add:Action')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text('http://webservices.amadeus.com/PNRXCL_21_1_1A')
							.endElement()
							.startElement('add:To')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text(rjcConfig.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
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
							.writeAttribute(
								'xmlns',
								'http://xml.amadeus.com/2010/06/Security_v1'
							)
							.endElement()
							.endElement()
						return xmlWriter
					}

					const createSoapBody = (xmlWriter) => {
						xmlWriter
							.startElement('soap:Body')
							.startElement('PNR_Cancel')
							.startElement('reservationInfo')
							.startElement('reservation')
							.writeElement('controlNumber', rjcConfig.params.input.pnr)
							.endElement()
							.endElement()
							.startElement('pnrActions')
							.writeElement('optionCode', '11')
							.endElement()
							.startElement('cancelElements')
							.writeElement('entryType', 'I')
							.endElement()
							.endElement()
							.endElement()
						return xmlWriter
					}

					const generateRequest = () => {
						const xmlWriter = new XMLWriter({ indent: '  ' })
						createSoapEnvelope(xmlWriter)
						createSoapHeader(xmlWriter)
						createSoapBody(xmlWriter)
						xmlWriter.endElement()
						return xmlWriter.toString()
					}

					return generateRequest()
				}

				const cancelRequestData = await prepareCancelRequest()

				const soapApiEndpoint = {
					input: cancelRequestData,
					params: httpRequest,
					secrets: process.env,
					headers,
				}

				const cancelRes = await callPNRCancel(
					corelationId,
					url,
					soapApiEndpoint,
					templateType,
					res
				)
				const cancellationResponse = await processCancelFlowResponse(
					cancelRes,
					httpRequest
				)

				async function processCancelFlowResponse(cancelRes, httpRequest) {
					const cancelFlowData = cancelRes['soap:Envelope']['soap:Body']

					let responseData = {
						isSuccess: false,
						response: '',
						status: '',
						updateDate: '',
						cancelationStatus: '',
						pnr: '',
						userEmail: '',
						tavaBookingId: '',
					}

					if (
						cancelFlowData?.['soap:Fault']?.faultcode?._text ||
						cancelFlowData?.PNR_Reply?.information?.applicationErrorInformation
							?.applicationErrorDetail?.codeListQualifier === 'EC'
					) {
						responseData.isSuccess = false
						responseData.updateDate = new Date().toISOString()
						responseData.cancelationStatus = 'FAILED'
					} else {
						if (
							cancelFlowData?.originDestinationDetails?.itineraryInfo == null
						) {
							responseData.isSuccess = true
							responseData.response = cancelFlowData
							responseData.status = 'CANCELED'
							responseData.cancelationStatus = 'SUCCESS'
							responseData.updateDate = new Date().toISOString()
							responseData.pnr = httpRequest.input.pnr
							responseData.tavaBookingId = httpRequest.input.tavaBookingId
							responseData.userEmail = httpRequest.input.userEmail
						} else {
							responseData.isSuccess = false
							responseData.updateDate = new Date().toISOString()
							responseData.cancelationStatus = 'FAILED'
						}
					}

					return responseData
				}

				const cancellationCheckData = {
					input: cancellationResponse,
					params: httpRequest,
					secrets: process.env,
					headers,
				}

				let cancellationResult

				if (cancellationCheckData.input.isSuccess === true) {
					const performCancellationCheck = async () => {
						const inputData = { ...cancellationCheckData }
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const internalOutput = inputData

						const updateRecordFields = {
							input: internalOutput,
							params: httpRequest,
							secrets: process.env,
							headers,
						}

						const parseInputData = (inputData) => {
							const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
							const parsedData = []
							let match
							while ((match = regex.exec(inputData)) !== null) {
								const [, key, value, operator] = match
								parsedData.push({ key, value, operator })
							}
							return parsedData
						}

						const formattedQuery = `"updatedAt" = '${updateRecordFields.input.input.updateDate}',"cancelationStatus" = '${updateRecordFields.input.input.cancelationStatus}',"status" = '${updateRecordFields.input.input.status}'`

						const parsedQueryData = parseInputData(formattedQuery)

						let query = {}
						let preOperator = ''
						parsedQueryData.forEach((item) => {
							if (!item.value.includes('undefined')) {
								query[`${item.key}`] = item.value
							}
							preOperator = item.operator
						})

						const updatedRecord = await prisma.booking.update({
							where: {
								id: updateRecordFields.params.input.id,
							},
							data: query,
						})

						const runJavaScriptCode = async () => {
							const data = updatedRecord
							const response = {
								tavaBookingId: data.tavaBookingId,
								emailResponse: inputData.emailResponse,
								status: data?.status,
								cancelationStatus: data?.cancelationStatus,
								pnr: data.pnr,
							}
							return response
						}

						const responseOutput = await runJavaScriptCode()

						const returnSuccessResponse = {
							response: responseOutput,
							params: httpRequest,
							secrets: process.env,
							headers,
						}

						if (returnSuccessResponse.output?.responseType === 'xml') {
							delete returnSuccessResponse.headers
							return res
								.set('Content-Type', 'application/xml')
								.send(returnSuccessResponse.output.data)
						}

						delete returnSuccessResponse.params
						delete returnSuccessResponse.secrets
						delete returnSuccessResponse.headers

						if (
							Object.keys(returnSuccessResponse).length ||
							finalResponse.length
						) {
							tavaLogger(
								corelationId,
								'Response',
								url,
								{
									status: 200,
									data: returnSuccessResponse,
								},
								templateType
							)
							return finalResponse.length
								? { output: finalResponse }
								: returnSuccessResponse
						} else {
							return 'successfully run'
						}
					}

					const resultCheck = await performCancellationCheck()
					cancellationResult = resultCheck

					return resultCheck
				}

				const cancellationCheck = {
					input: cancellationCheckData,
					params: httpRequest,
					secrets: process.env,
					headers,
				}

				let updateCheckedResult
				if (!cancellationCheck.input.isSuccess) {
					const performCancellationCheck = async () => {
						const inputData = { ...cancellationCheck }
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers
						const internalOutput = inputData

						const updateRecordFields = {
							input: internalOutput,
							params: httpRequest,
							secrets: process.env,
							headers,
						}

						const parseInputData = (inputData) => {
							const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
							const parsedData = []
							let match
							while ((match = regex.exec(inputData)) !== null) {
								const [, key, value, operator] = match
								parsedData.push({ key, value, operator })
							}
							return parsedData
						}

						const formattedQuery = `"updatedAt" = '${updateRecordFields.input.input.updateDate}',"cancelationStatus" = '${updateRecordFields.input.input.cancelationStatus}'`
						const parsedQueryData = parseInputData(formattedQuery)

						let query = {}
						parsedQueryData.forEach((item) => {
							if (!item.value.includes('undefined')) {
								query[`${item.key}`] = item.value
							}
						})

						const updatedRecord = await prisma.booking.update({
							where: {
								id: updateRecordFields.input.input.id,
							},
							data: query,
						})

						const returnSuccessResponse = {
							response: internalOutput,
							params: httpRequest,
							secrets: process.env,
							headers,
						}

						if (
							returnSuccessResponse.response?.output?.responseType === 'xml'
						) {
							delete returnSuccessResponse.headers
							return res
								.set('Content-Type', 'application/xml')
								.send(returnSuccessResponse.response.output.data)
						}

						delete returnSuccessResponse.params
						delete returnSuccessResponse.secrets
						delete returnSuccessResponse.headers

						if (
							Object.keys(returnSuccessResponse).length ||
							finalResponse.length
						) {
							tavaLogger(
								corelationId,
								'Response',
								url,
								{
									status: 200,
									data: returnSuccessResponse,
								},
								templateType
							)
							return finalResponse.length
								? { output: finalResponse }
								: returnSuccessResponse
						} else {
							return 'successfully run'
						}
					}

					const resultCheck = await performCancellationCheck()
					updateCheckedResult = resultCheck

					return resultCheck
				}
			}
			const resultCheck = await checkResponse()
			externalOutput = resultCheck
		}
		const subflowResponse = {
			response: externalOutput,
			params: httpRequest,
			secrets: process.env,
			headers,
		}

		const updatedSubflowResponse = { ...subflowResponse }

		if (updatedSubflowResponse.response?.output?.responseType === 'xml') {
			delete updatedSubflowResponse.headers
			return updatedSubflowResponse.response.output.data
		}

		delete updatedSubflowResponse.params
		delete updatedSubflowResponse.secrets
		delete updatedSubflowResponse.headers

		if (Object.keys(updatedSubflowResponse).length || finalResponse.length) {
			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: updatedSubflowResponse,
				},
				templateType
			)
			return finalResponse.length
				? { output: finalResponse }
				: updatedSubflowResponse
		} else return 'successfully run'
	} catch (error) {
		const templateType = 'travel'

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

const blockhotelroom = async (req, res, next, corelationId, url) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const trigger_54a8774d_f31e_4233_8e00_8c9eb9553413 = req
		const { body, params, method, headers } = req.params
		const RunJavaScriptCode_6c0640c7_e290_4559_8c40_349e372d1825 = {
			input: trigger_54a8774d_f31e_4233_8e00_8c9eb9553413,
			params: trigger_54a8774d_f31e_4233_8e00_8c9eb9553413,
			secrets: process.env,
			headers,
		}
		const rjc_6c0640c7_e290_4559_8c40_349e372d1825 =
			RunJavaScriptCode_6c0640c7_e290_4559_8c40_349e372d1825

		const runJavascriptCode_6c0640c7_e290_4559_8c40_349e372d1825 =
			async function () {
				const endUserIp =
					rjc_6c0640c7_e290_4559_8c40_349e372d1825.input.input.body.EndUserIp
				const {
					TBO_HOTELS_USERNAME,
					TBO_HOTELS_PASSWORD,
					TBO_HOTELS_CLIENTID,
				} = rjc_6c0640c7_e290_4559_8c40_349e372d1825.secrets

				// Returning Request for authentication
				return {
					ClientId: TBO_HOTELS_CLIENTID,
					UserName: TBO_HOTELS_USERNAME,
					Password: TBO_HOTELS_PASSWORD,
					EndUserIp: endUserIp,
				}
			}
		const output_6c0640c7_e290_4559_8c40_349e372d1825 =
			await runJavascriptCode_6c0640c7_e290_4559_8c40_349e372d1825()
		const CallRESTAPIEndpoint_8e912737_b12f_4853_8a3a_abf6b5acfee0 = {
			input: output_6c0640c7_e290_4559_8c40_349e372d1825,
			params: trigger_54a8774d_f31e_4233_8e00_8c9eb9553413,
			secrets: process.env,
			headers,
		}

		let output_8e912737_b12f_4853_8a3a_abf6b5acfee0
		try {
			const cacheKey_8e912737_b12f_4853_8a3a_abf6b5acfee0 = 'auth_token'
			const cacheExpireTime_8e912737_b12f_4853_8a3a_abf6b5acfee0 = 0
			const isCacheRequired_8e912737_b12f_4853_8a3a_abf6b5acfee0 = true
			tavaLogger(
				corelationId,
				'Request',
				`${CallRESTAPIEndpoint_8e912737_b12f_4853_8a3a_abf6b5acfee0.secrets.TBO_AUTH_BASE_URL}/Authenticate?`,
				CallRESTAPIEndpoint_8e912737_b12f_4853_8a3a_abf6b5acfee0.input,
				templateType
			)
			const fetchData = async () =>
				await axios
					.post(
						`${CallRESTAPIEndpoint_8e912737_b12f_4853_8a3a_abf6b5acfee0.secrets.TBO_AUTH_BASE_URL}/Authenticate?`,
						CallRESTAPIEndpoint_8e912737_b12f_4853_8a3a_abf6b5acfee0.input,
						{ headers: {} }
					)
					.then(async (res) => {
						tavaLogger(
							corelationId,
							'Response',
							`${CallRESTAPIEndpoint_8e912737_b12f_4853_8a3a_abf6b5acfee0.secrets.TBO_AUTH_BASE_URL}/Authenticate?`,
							res,
							templateType
						)
						return res.data
					})
			output_8e912737_b12f_4853_8a3a_abf6b5acfee0 =
				isCacheRequired_8e912737_b12f_4853_8a3a_abf6b5acfee0
					? await fetchOrStoreDataInCache(
							fetchData,
							cacheKey_8e912737_b12f_4853_8a3a_abf6b5acfee0,
							cacheExpireTime_8e912737_b12f_4853_8a3a_abf6b5acfee0
					  )
					: await fetchData()
		} catch (error) {
			console.log(
				'Error occurred in :  `${CallRESTAPIEndpoint_8e912737_b12f_4853_8a3a_abf6b5acfee0.secrets.TBO_AUTH_BASE_URL}/Authenticate?`',
				error
			)
			if (error.response) {
				const { status, data } = error?.response
				tavaLogger(
					corelationId,
					'Error',
					`${CallRESTAPIEndpoint_8e912737_b12f_4853_8a3a_abf6b5acfee0.secrets.TBO_AUTH_BASE_URL}/Authenticate?`,
					error,
					templateType
				)
				throw res.status(status).json(data)
			}
			throw error
		}
		const RunJavaScriptCode_f917000d_1e2e_47b4_8c56_8b5da416eb86 = {
			input: output_8e912737_b12f_4853_8a3a_abf6b5acfee0,
			params: trigger_54a8774d_f31e_4233_8e00_8c9eb9553413,
			secrets: process.env,
			headers,
			trigger: trigger_54a8774d_f31e_4233_8e00_8c9eb9553413,
		}
		const rjc_f917000d_1e2e_47b4_8c56_8b5da416eb86 =
			RunJavaScriptCode_f917000d_1e2e_47b4_8c56_8b5da416eb86

		const runJavascriptCode_f917000d_1e2e_47b4_8c56_8b5da416eb86 =
			async function () {
				function inputMapper(input) {
					const reqData = input.trigger.input.body
					const tokenId = input.input.TokenId
					return {
						ResultIndex: reqData.ResultIndex,
						HotelCode: reqData.HotelCode,
						HotelName: reqData.HotelName,
						GuestNationality: reqData.GuestNationality,
						NoOfRooms: reqData.NoOfRooms,
						ClientReferenceNo: reqData.ClientReferenceNo,
						IsVoucherBooking: reqData.IsVoucherBooking,
						CategoryId: reqData.CategoryId,
						EndUserIp: reqData.EndUserIp,
						TraceId: reqData.TraceId,
						HotelRoomsDetails: reqData.HotelRoomsDetails,
						TokenId: tokenId,
					}
				}
				return inputMapper(rjc_f917000d_1e2e_47b4_8c56_8b5da416eb86)
			}
		const output_f917000d_1e2e_47b4_8c56_8b5da416eb86 =
			await runJavascriptCode_f917000d_1e2e_47b4_8c56_8b5da416eb86()
		const CallRESTAPIEndpoint_d2edd544_39da_410c_8fc1_888dac86f4bc = {
			input: output_f917000d_1e2e_47b4_8c56_8b5da416eb86,
			params: trigger_54a8774d_f31e_4233_8e00_8c9eb9553413,
			secrets: process.env,
			headers,
		}

		let output_d2edd544_39da_410c_8fc1_888dac86f4bc
		try {
			const cacheKey_d2edd544_39da_410c_8fc1_888dac86f4bc = ''
			const cacheExpireTime_d2edd544_39da_410c_8fc1_888dac86f4bc = 0
			const isCacheRequired_d2edd544_39da_410c_8fc1_888dac86f4bc = false
			tavaLogger(
				corelationId,
				'Request',
				`${CallRESTAPIEndpoint_d2edd544_39da_410c_8fc1_888dac86f4bc.secrets.TBO_HOTELS_BASE_URL}/BlockRoom?`,
				CallRESTAPIEndpoint_d2edd544_39da_410c_8fc1_888dac86f4bc.input,
				templateType
			)
			const fetchData = async () =>
				await axios
					.post(
						`${CallRESTAPIEndpoint_d2edd544_39da_410c_8fc1_888dac86f4bc.secrets.TBO_HOTELS_BASE_URL}/BlockRoom?`,
						CallRESTAPIEndpoint_d2edd544_39da_410c_8fc1_888dac86f4bc.input,
						{ headers: {} }
					)
					.then(async (res) => {
						tavaLogger(
							corelationId,
							'Response',
							`${CallRESTAPIEndpoint_d2edd544_39da_410c_8fc1_888dac86f4bc.secrets.TBO_HOTELS_BASE_URL}/BlockRoom?`,
							res,
							templateType
						)
						return res.data
					})
			output_d2edd544_39da_410c_8fc1_888dac86f4bc =
				isCacheRequired_d2edd544_39da_410c_8fc1_888dac86f4bc
					? await fetchOrStoreDataInCache(
							fetchData,
							cacheKey_d2edd544_39da_410c_8fc1_888dac86f4bc,
							cacheExpireTime_d2edd544_39da_410c_8fc1_888dac86f4bc
					  )
					: await fetchData()
		} catch (error) {
			console.log(
				'Error occurred in :  `${CallRESTAPIEndpoint_d2edd544_39da_410c_8fc1_888dac86f4bc.secrets.TBO_HOTELS_BASE_URL}/BlockRoom?`',
				error
			)
			if (error.response) {
				const { status, data } = error?.response
				tavaLogger(
					corelationId,
					'Error',
					`${CallRESTAPIEndpoint_d2edd544_39da_410c_8fc1_888dac86f4bc.secrets.TBO_HOTELS_BASE_URL}/BlockRoom?`,
					error,
					templateType
				)
				throw res.status(status).json(data)
			}
			throw error
		}
		const ReturnSubflowResponse_28795ffe_86f9_40fa_ab28_b0d33b40ddc8 = {
			PriceAndCancellationPolicyDetail:
				output_d2edd544_39da_410c_8fc1_888dac86f4bc,
			params: trigger_54a8774d_f31e_4233_8e00_8c9eb9553413,
			secrets: process.env,
			headers,
		}
		const updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8 = {
			...ReturnSubflowResponse_28795ffe_86f9_40fa_ab28_b0d33b40ddc8,
		}

		if (
			updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8?.output
				?.responseType === 'xml'
		) {
			delete updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8.headers
			return updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8.output
				.data
		}

		delete updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8.params
		delete updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8.secrets
		delete updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8.headers

		if (
			Object.keys(updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8)
				.length ||
			finalResponse.length
		) {
			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8,
				},
				templateType
			)
			return finalResponse.length
				? { output: finalResponse }
				: updatedReturnSuccessRes_28795ffe_86f9_40fa_ab28_b0d33b40ddc8
		} else return 'successfully run'
	} catch (error) {
		const templateType = 'travel'

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
const checkduplicatebooking = async (req, res, next, corelationId, url) => {
	try {
		const Start_ec9dec05_3108_4a77_ab64_45e3d0790b89 = {}
		const finalResponse = []
		const templateType = 'travel'
		const trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89 = req
		const { body, params, method, headers } = req.params
		const GetMultiRecordsbyQuery_068396b0_08d3_4744_a737_ba03566ded60 = {
			input: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
			params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
			secrets: process.env,
			headers,
		}
		const parseInputData_068396b0_08d3_4744_a737_ba03566ded60 = (inputData) => {
			const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
			const output_068396b0_08d3_4744_a737_ba03566ded60 = []
			let match
			while ((match = regex.exec(inputData)) !== null) {
				const [, key, value, operator] = match
				output_068396b0_08d3_4744_a737_ba03566ded60.push({
					key,
					value,
					operator,
				})
			}
			return output_068396b0_08d3_4744_a737_ba03566ded60
		}
		const formattedQuery_068396b0_08d3_4744_a737_ba03566ded60 = `"createdAt"  >= current_timestamp - interval '24 hours'`
		const outputData_068396b0_08d3_4744_a737_ba03566ded60 =
			parseInputData_068396b0_08d3_4744_a737_ba03566ded60(
				formattedQuery_068396b0_08d3_4744_a737_ba03566ded60
			)
		let query_068396b0_08d3_4744_a737_ba03566ded60 = ''
		let preOperator_068396b0_08d3_4744_a737_ba03566ded60 = ''
		outputData_068396b0_08d3_4744_a737_ba03566ded60.forEach((item) => {
			if (!item.value.includes('undefined')) {
				query_068396b0_08d3_4744_a737_ba03566ded60 += ` ${
					query_068396b0_08d3_4744_a737_ba03566ded60
						? preOperator_068396b0_08d3_4744_a737_ba03566ded60
						: ''
				} "${item.key}" = '${item.value}'`
			}
			preOperator_068396b0_08d3_4744_a737_ba03566ded60 = item.operator
		})
		const isFormattedQueryExist_068396b0_08d3_4744_a737_ba03566ded60 =
			query_068396b0_08d3_4744_a737_ba03566ded60
				? `WHERE ${query_068396b0_08d3_4744_a737_ba03566ded60}`
				: ''
		const sortObj_068396b0_08d3_4744_a737_ba03566ded60 = []
		let sortObjExp_068396b0_08d3_4744_a737_ba03566ded60 = ''
		if (sortObj_068396b0_08d3_4744_a737_ba03566ded60.length) {
			const orderByClause = sortObj_068396b0_08d3_4744_a737_ba03566ded60
				.map((order) => {
					const [key, value] = Object.entries(order)[0]
					return `"${key}" ${value.toUpperCase()}`
				})
				.join(', ')
			sortObjExp_068396b0_08d3_4744_a737_ba03566ded60 = `ORDER BY ${orderByClause}`
		}
		const getMultiObjectByQuery_068396b0_08d3_4744_a737_ba03566ded60 =
			await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
				`SELECT * FROM "Booking"  ${isFormattedQueryExist_068396b0_08d3_4744_a737_ba03566ded60} ${sortObjExp_068396b0_08d3_4744_a737_ba03566ded60} OFFSET 0 ROWS FETCH NEXT '500' ROWS ONLY`
			)}`
		const result_068396b0_08d3_4744_a737_ba03566ded60 =
			getMultiObjectByQuery_068396b0_08d3_4744_a737_ba03566ded60
		const RunJavaScriptCode_b26a8931_b2dc_4383_ad05_315a5a020d1f = {
			input: result_068396b0_08d3_4744_a737_ba03566ded60,
			params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
			secrets: process.env,
			headers,
		}
		const rjc_b26a8931_b2dc_4383_ad05_315a5a020d1f =
			RunJavaScriptCode_b26a8931_b2dc_4383_ad05_315a5a020d1f

		const runJavascriptCode_b26a8931_b2dc_4383_ad05_315a5a020d1f =
			async function () {
				{
					const requestBody =
						rjc_b26a8931_b2dc_4383_ad05_315a5a020d1f.params.input.body
					bookingData = rjc_b26a8931_b2dc_4383_ad05_315a5a020d1f.input

					function compareSegments(segment1, segment2) {
						return (
							segment1.departure.date === segment2.departure.date &&
							segment1.departure.time === segment2.departure.time &&
							segment1.departure.airportName ===
								segment2.departure.airportName &&
							segment1.departure.iataCode === segment2.departure.iataCode &&
							segment1.arrival.date === segment2.arrival.date &&
							segment1.arrival.time === segment2.arrival.time &&
							segment1.arrival.airportName === segment2.arrival.airportName &&
							segment1.arrival.iataCode === segment2.arrival.iataCode &&
							segment1.carrierCode === segment2.carrierCode &&
							segment1.flightNumber === segment2.flightNumber
						)
					}

					function compareItineraries(itinerary1, itinerary2) {
						if (itinerary1.segments.length !== itinerary2.segments.length) {
							return false
						}

						for (let i = 0; i < itinerary1.segments.length; i++) {
							if (
								!compareSegments(itinerary1.segments[i], itinerary2.segments[i])
							) {
								return false
							}
						}

						return true
					}

					function compareJourneys(journey1, journey2) {
						if (journey1.itineraries.length !== journey2.itineraries.length) {
							return false
						}

						for (let i = 0; i < journey1.itineraries.length; i++) {
							if (
								!compareItineraries(
									journey1.itineraries[i],
									journey2.itineraries[i]
								)
							) {
								return false
							}
						}

						return journey2
					}

					function checkForDuplicateSegmentsInBookings(
						requestBody,
						bookingData
					) {
						const requestJourneys = requestBody.bookingRequest.journeyDetails
						const bookingRecords = bookingData
						let bookingJourneys
						for (let i = 0; i < bookingRecords.length; i++) {
							bookingJourneys = bookingRecords[i].bookingJSON.journeyDetails

							for (let j = 0; j < requestJourneys.length; j++) {
								for (let k = 0; k < bookingJourneys.length; k++) {
									if (
										compareJourneys(requestJourneys[j], bookingJourneys[k]) &&
										bookingRecords[i].pnr !== ''
									) {
										console.log('Duplicate booking found!')
										return {
											isDuplicate: true,
											originalBookingDetail: bookingRecords[i],
											duplicateBookingDetail: requestBody.bookingRequest,
										}
									}
								}
							}
						}

						console.log('No duplicate bookings found.')
						return false
					}

					function compareTravelersInBookingDetails(bookingData, requestBody) {
						const travelerDetails = Array.isArray(bookingData)
							? bookingData[0].travelerDetails
							: bookingData.travelerDetails
						const journeyDetails = requestBody.travelerDetails

						if (travelerDetails.length !== journeyDetails.length) {
							return false
						}

						for (let i = 0; i < travelerDetails.length; i++) {
							const traveler = travelerDetails[i]
							const journey = journeyDetails[i]

							if (
								traveler.givenName?.toLowerCase() !==
									journey.givenName?.toLowerCase() ||
								traveler.familyName?.toLowerCase() !==
									journey.familyName?.toLowerCase() ||
								traveler.dateOfBirth !== journey.dateOfBirth
							) {
								return false
							}
						}

						return true
					}
					let isMatch = false
					for (const booking of bookingData) {
						for (const journey of requestBody.bookingRequest.journeyDetails) {
							isMatch = compareTravelersInBookingDetails(
								booking.bookingJSON.journeyDetails,
								journey
							)
							if (isMatch && booking.pnr !== '') {
								break
							}
						}
						if (isMatch && booking.pnr !== '') {
							break
						}
					}

					const duplicateBookingStatus = checkForDuplicateSegmentsInBookings(
						requestBody,
						bookingData
					)

					if (
						duplicateBookingStatus.isDuplicate &&
						(!duplicateBookingStatus.originalBookingDetail ||
							duplicateBookingStatus.originalBookingDetail.pnr === '')
					) {
						return {
							isDuplicateBooking: false,
							message: 'No duplicate booking found.',
						}
					} else if (duplicateBookingStatus.isDuplicate && isMatch) {
						return {
							isDuplicateBooking: true,
							duplicateTavaId:
								duplicateBookingStatus.duplicateBookingDetail.tavaBookingId,
							tavaBookingId:
								duplicateBookingStatus.originalBookingDetail.tavaBookingId,
							correspondingPNR:
								duplicateBookingStatus.originalBookingDetail.pnr,
						}
					} else {
						return {
							isDuplicateBooking: false,
							message: 'No duplicate booking found.',
						}
					}
				}
			}
		const output_b26a8931_b2dc_4383_ad05_315a5a020d1f =
			await runJavascriptCode_b26a8931_b2dc_4383_ad05_315a5a020d1f()
		const If_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4 = {
			input: output_b26a8931_b2dc_4383_ad05_315a5a020d1f,
			params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
			secrets: process.env,
			headers,
		}
		let externalOutput_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4
		if (
			If_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4.input.isDuplicateBooking === true
		) {
			const checkResponse = async () => {
				const inputData_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4 = {
					...If_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4,
				}
				delete inputData_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4.params
				delete inputData_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4.secrets
				delete inputData_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4.headers
				const internalOutput_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4 =
					inputData_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4
				const GetRecordValue_95ccf1d9_1ebd_4719_94dc_90945a386bf7 = {
					input: internalOutput_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4,
					params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
					secrets: process.env,
					headers,
				}
				const pickedValue_95ccf1d9_1ebd_4719_94dc_90945a386bf7 =
					GetRecordValue_95ccf1d9_1ebd_4719_94dc_90945a386bf7.input.input
				const RunJavaScriptCode_964a11c4_18dc_4496_a87a_ba6fb01f145d = {
					input: pickedValue_95ccf1d9_1ebd_4719_94dc_90945a386bf7,
					params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
					secrets: process.env,
					headers,
				}
				const rjc_964a11c4_18dc_4496_a87a_ba6fb01f145d =
					RunJavaScriptCode_964a11c4_18dc_4496_a87a_ba6fb01f145d

				const runJavascriptCode_964a11c4_18dc_4496_a87a_ba6fb01f145d =
					async function () {
						duplicateBookingData =
							rjc_964a11c4_18dc_4496_a87a_ba6fb01f145d.input

						return {
							tavaBookingId: duplicateBookingData.tavaBookingId,
							correspondingPNR: duplicateBookingData.correspondingPNR,
							duplicateTavaId: duplicateBookingData.duplicateTavaId,
						}
					}
				const output_964a11c4_18dc_4496_a87a_ba6fb01f145d =
					await runJavascriptCode_964a11c4_18dc_4496_a87a_ba6fb01f145d()
				const CreateSingleRecord_f56027d3_0d8a_423b_bbf4_4f2cda158f59 = {
					input: output_964a11c4_18dc_4496_a87a_ba6fb01f145d,
					params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
					secrets: process.env,
					headers,
				}
				const created_f56027d3_0d8a_423b_bbf4_4f2cda158f59 =
					await prisma.duplicateBooking.create({
						data: CreateSingleRecord_f56027d3_0d8a_423b_bbf4_4f2cda158f59.input,
					})
				const ReturnSuccessResponse_c7457333_99ca_4f2a_9630_caf11a0beb06 = {
					output: pickedValue_95ccf1d9_1ebd_4719_94dc_90945a386bf7,
					params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
					secrets: process.env,
					headers,
				}
				const updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06 = {
					...ReturnSuccessResponse_c7457333_99ca_4f2a_9630_caf11a0beb06,
				}

				if (
					updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06?.output
						?.responseType === 'xml'
				) {
					delete updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06.headers
					return res
						.set('Content-Type', 'application/xml')
						.send(
							updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06
								.output.data
						)
				}

				delete updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06.params
				delete updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06.secrets
				delete updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06.headers

				if (
					Object.keys(
						updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06
					).length ||
					finalResponse.length
				) {
					tavaLogger(
						corelationId,
						'Response',
						url,
						{
							status: 200,
							data: updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06,
						},
						templateType
					)
					return finalResponse.length
						? { output: finalResponse }
						: updatedReturnSuccessRes_c7457333_99ca_4f2a_9630_caf11a0beb06
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			externalOutput_c88a2d8c_9f4c_462d_8adf_e8f88bda77f4 = resultCheck

			return resultCheck
		}
		const If_e7c7f724_cc6a_46f3_8f04_9169580f15eb = {
			input: output_b26a8931_b2dc_4383_ad05_315a5a020d1f,
			params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
			secrets: process.env,
			headers,
		}
		let externalOutput_e7c7f724_cc6a_46f3_8f04_9169580f15eb
		if (
			If_e7c7f724_cc6a_46f3_8f04_9169580f15eb.input.isDuplicateBooking === false
		) {
			const checkResponse = async () => {
				const inputData_e7c7f724_cc6a_46f3_8f04_9169580f15eb = {
					...If_e7c7f724_cc6a_46f3_8f04_9169580f15eb,
				}
				delete inputData_e7c7f724_cc6a_46f3_8f04_9169580f15eb.params
				delete inputData_e7c7f724_cc6a_46f3_8f04_9169580f15eb.secrets
				delete inputData_e7c7f724_cc6a_46f3_8f04_9169580f15eb.headers
				const internalOutput_e7c7f724_cc6a_46f3_8f04_9169580f15eb =
					inputData_e7c7f724_cc6a_46f3_8f04_9169580f15eb
				const GetRecordValue_cf0cae68_b025_427a_bb12_a4e05b883dca = {
					input: internalOutput_e7c7f724_cc6a_46f3_8f04_9169580f15eb,
					params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
					secrets: process.env,
					headers,
				}
				const pickedValue_cf0cae68_b025_427a_bb12_a4e05b883dca =
					GetRecordValue_cf0cae68_b025_427a_bb12_a4e05b883dca.input.input
				const ReturnSuccessResponse_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568 = {
					output: pickedValue_cf0cae68_b025_427a_bb12_a4e05b883dca,
					params: trigger_ec9dec05_3108_4a77_ab64_45e3d0790b89,
					secrets: process.env,
					headers,
				}
				const updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568 = {
					...ReturnSuccessResponse_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568,
				}

				if (
					updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568?.output
						?.responseType === 'xml'
				) {
					delete updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568.headers
					return res
						.set('Content-Type', 'application/xml')
						.send(
							updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568
								.output.data
						)
				}

				delete updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568.params
				delete updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568.secrets
				delete updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568.headers

				if (
					Object.keys(
						updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568
					).length ||
					finalResponse.length
				) {
					tavaLogger(
						corelationId,
						'Response',
						url,
						{
							status: 200,
							data: updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568,
						},
						templateType
					)
					return finalResponse.length
						? { output: finalResponse }
						: updatedReturnSuccessRes_fab6bd0c_5d8b_4b2a_8a1c_99bb0305e568
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			externalOutput_e7c7f724_cc6a_46f3_8f04_9169580f15eb = resultCheck

			return resultCheck
		}
	} catch (error) {
		const templateType = 'travel'

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
const promocodeupdate = async (req, res, next, corelationId, url) => {
	try {
	
		const finalResponse = []
		const templateType = 'travel'
		const promocodeUpdateRequest = req
		const { body, params, method, headers } = req.params

		const createUpdatePromoCodeMapper = async function () {
			const request = () => {
				const { promocode } = res.req.body.bookingRequest.paymentsDetails

				if (Object.keys(promocode).length) {
					const { tava_totalcount, tava_consumedcount, tava_code } = promocode
					return {
						isPromoCodeApplied: true,
						promocode: tava_code,
						newTotalCount: tava_totalcount - 1,
						newConsumedCount: tava_consumedcount + 1,
					}
				} else
					return {
						isPromoCodeApplied: false,
					}
			}

			return request()
		}
		const PromoCodeMapperResponse = await createUpdatePromoCodeMapper()
		let UpdateRecordFieldsbyQuery
		if (PromoCodeMapperResponse.isPromoCodeApplied) {
			const checkResponse = async () => {
				const UpdateRecordFieldsbyQuery = {
					input: PromoCodeMapperResponse,
					params: promocodeUpdateRequest,
					secrets: process.env,
					headers,
				}

				const updatedInfo =
					await prisma.$executeRaw`${prismaClient.PrismaInstance.raw(
						`UPDATE "promoCode" SET "totalCount"= '${UpdateRecordFieldsbyQuery.input.newTotalCount}',"consumedCount"= '${UpdateRecordFieldsbyQuery.input.newConsumedCount}' WHERE "code"='${UpdateRecordFieldsbyQuery.input.promocode}'`
					)}`
				const ReturnSuccessResponse = {
					updateInfo: updatedInfo,
					params: promocodeUpdateRequest,
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
			PromoCodeUpdatedResponse = resultCheck
		}
	} catch (error) {
		const templateType = 'travel'

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
const sendticketingemail = async (req, res, next, corelationId, url) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const { headers } = req.params

		const parseInputData = (inputData) => {
			const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
			const output = []
			let match
			while ((match = regex.exec(inputData)) !== null) {
				const [, key, value, operator] = match
				output.push({
					key,
					value,
					operator,
				})
			}
			return output
		}
		const formattedQuery = `"tavaBookingId" =  '${req?.input?.input?.response?.tavaBookingId}' OR "tavaBookingId" =  '${req?.input?.body?.tavaBookingId}'`
		const outputData = parseInputData(formattedQuery)
		let query = ''
		let preOperator = ''
		outputData.forEach((item) => {
			if (!item.value.includes('undefined')) {
				query += ` ${query ? preOperator : ''} "${item.key}" = '${item.value}'`
			}
			preOperator = item.operator
		})
		const isFormattedQueryExist = query ? `WHERE ${query}` : ''
		const sortObj = [{ createdAt: 'asc' }]
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
		const resultData = await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
			`SELECT * FROM "Booking"  ${isFormattedQueryExist} ${sortObjExp} OFFSET 0 ROWS FETCH NEXT '20' ROWS ONLY`
		)}`

		const confirmedBookingDataCheck = async (resultData) => {
			let bookings = resultData
			function checkConfirmedBooking(bookings) {
				return bookings.filter(
					(booking) =>
						booking.status === 'CONFIRMED' &&
						booking.ticketingStatus === 'CONFIRMED'
				)
			}

			const paymentSessionId = bookings[0]?.paymentSessionId

			if (!paymentSessionId) {
				console.error('Payment session ID is missing.')
			}

			const paymentSessionData = await prisma.paymentSession.findUnique({
				where: { id: paymentSessionId },
			})

			const currencySymbol = await getCurrencySymbolFromCode(paymentSessionData?.currency)
			let confirmedBooking = checkConfirmedBooking(bookings)
			const totalPrice = paymentSessionData.amount / 100;

			function getTravelerDetails(confirmedBooking) {
				if (!confirmedBooking.length) return null
				return confirmedBooking[0]?.bookingJSON?.journeyDetails[0]
					?.travelerDetails
			}

			const travelerDetails = getTravelerDetails(confirmedBooking)
			let allItinerariesDuration = []
			confirmedBooking.forEach((booking) => {
				booking.bookingJSON.journeyDetails.forEach((journey) => {
					journey.itineraries.forEach((itinerary) => {
						allItinerariesDuration = allItinerariesDuration.concat(
							itinerary.duration
						)
					})
				})
			})

			let allSegments = []

			confirmedBooking.forEach((booking) => {
				booking.bookingJSON.journeyDetails.forEach((journey) => {
					journey.itineraries.forEach((itinerary) => {
						const segments = itinerary.segments
						const length = segments.length
						const departure = segments[0].departure
						const arrival = segments[length - 1].arrival

						if (length > 1) {
							const firstSegment = segments[0]
							allSegments.push({
								departure,
								arrival,
								aircraftCode: firstSegment.aircraftCode,
								bookingClass: firstSegment.bookingClass,
								cabinClass: firstSegment.cabinClass,
								carrierCode: firstSegment.carrierCode,
								carrierName: firstSegment.carrierName,
								company: firstSegment.company,
								customerServicePhone: firstSegment.customerServicePhone,
								flightNumber: firstSegment.flightNumber,
								operatingCarrierCode: firstSegment.operatingCarrierCode,
							})
						} else {
							allSegments = allSegments.concat(segments)
						}
					})
				})
			})

			let allbaggagesDetails = []
			confirmedBooking.forEach((booking) => {
				booking.bookingJSON.journeyDetails.forEach((journey) => {
					journey.travelerDetails.forEach((details) => {
						allbaggagesDetails = allbaggagesDetails.concat(
							details.allowedBaggage
						)
					})
				})
			})
			const pnrData = confirmedBooking.map((booking) => {
				return {
					pnr: booking.pnr,
				}
			})
			return {
				tavaBookingId: bookings[0].tavaBookingId,
				travelerDetail: travelerDetails,
				durations: allItinerariesDuration,
				segments: allSegments,
				baggageData: allbaggagesDetails,
				miscData: pnrData,
				createdAt: bookings[0].createdAt,
				grandTotal: totalPrice,
				fareType: bookings[0].bookingJSON.journeyDetails[0].price.fareType,
				serviceCharge: '1.18 (0.18 GST @18%)',
				currencySymbol: currencySymbol,
				price: totalPrice - 1.8,
			}
		}
		const confirmedBookData = await confirmedBookingDataCheck(resultData)
		const CreateEmailMessage = {
			input: confirmedBookData,
			params: req,
			secrets: process.env,
			headers,
		}
		const emailMessage = {
			from: CreateEmailMessage.secrets.EMAIL_USER,
			to: CreateEmailMessage.input.travelerDetail[0].email,
			subject: 'Ticket Email',
			html: ``,
		}
		const fileContent = fs.readFileSync(
			__dirname.split(`\helpers`)[0] +
				`/htmlfiles/CreateEmailMessageForFlightBooking.ejs`,
			`utf8`
		)
		const htmlText = ejs.render(fileContent, {
			CreateEmailMessage,
		})
		let htmlContent = String(htmlText)
		if (htmlText.startsWith('&lt;'))
			htmlContent = convert(htmlContent, { wordwrap: 130 })
		let attachments = []
		const pdfEjsfileContent = fs.readFileSync(
			__dirname.split(`\helpers`)[0] +
				`/htmlfiles/FlightETicketPDF.ejs`,
			`utf8`
		)
		const pdfTextMessage = ejs.render(pdfEjsfileContent, {
			CreateEmailMessage,
		})
		let pdfContent = String(pdfTextMessage)
		if (pdfTextMessage.startsWith('&lt;'))
			pdfContent = convert(pdfContent, { wordwrap: 130 })
		let pdfFilePath =
			__dirname.split(`\helpers`)[0] +
			`/htmlfiles/Ticket__2df626e7_01f9_44d1_a02b_e39b435ff4c9.pdf`
		const generatePdfFile = await convertHtmlToPdf(pdfContent, pdfFilePath)

		let pdfAttachment = fs.readFileSync(pdfFilePath)
		const pdfBase64 = pdfAttachment.toString('base64')
		attachments = [
			...attachments,
			{
				filename: `Ticket.pdf`,
				content: pdfBase64,
				encoding: 'base64',
			},
		]
		const SendEmailMessage = {
			emailMessage: emailMessage,
			params: req,
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

		const success = await RabbitMQClient.produce({
			data: messageContent,
			queueName: queueName,
		})
		if (success.emailResponse.error || success.error)
			return res.json(success.emailResponse.error || success.error)
		const ReturnSubflowResponse = {
			output: confirmedBookData,
			params: req,
			secrets: process.env,
			headers,
		}
		const updatedReturnSuccessRes = {
			...ReturnSubflowResponse,
		}

		if (updatedReturnSuccessRes?.output?.responseType === 'xml') {
			delete updatedReturnSuccessRes.headers
			return updatedReturnSuccessRes.output.data
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
				? { output: finalResponse }
				: updatedReturnSuccessRes
		} else return 'successfully run'
	} catch (error) {
		const templateType = 'travel'

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
const subflowcacheget = async (req, res, next, corelationId, url) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const { headers } = req.params
		const cacheData = await getDataFromCache(req.params.body.sessionId)

		const sessionLogic = async (req, cacheData) => {
			const getParentIp = (urlString) => {
				function extractIp(sessionString) {
					const encodedIP = sessionString.substring(37)
					const decodedIP = atob(encodedIP)
					return decodedIP
				}
				function getSessionIdFromUrlString(urlString) {
					const urlParams = new URLSearchParams(urlString.split('?')[1])
					return extractIp(urlParams.get('sessionId'))
				}
				return getSessionIdFromUrlString(urlString)
			}
			const data = req
			const sessionData = cacheData
			const params = req.params
			const apiReq = params.body
			const apiRes = data.input
			const key = params.body.key
			const URL = params.body.url
			let ipAddress = ''
			if (key === 'search') {
				ipAddress = params.body.endUserIp
			} else {
				ipAddress = getParentIp(URL)
			}
			const sessionId = params.body.sessionId
			const _ = require('lodash')
			let sessionDataObj = {}
			let checkForNewSession = false
			let sessionObj = {}
			const calculateMainCount = (allIps) => {
				let totalCount = 0
				for (let key in allIps) {
					let IP = allIps[key]
					totalCount += IP.count
				}

				return totalCount
			}
			const checkForIp = (allIps, ipAddress) => {
				for (let key in allIps) {
					if (key === ipAddress) {
						return true
					}
				}
				return false
			}
			if (key === 'search') {
				if (apiRes.source === 'TBO') {
					subkey = 'tboSearch'
				} else {
					subkey = 'amadeusSearch'
				}
			} else {
				if (!sessionData) {
					const error = new Error()
					error.statusCode = 410
					error.message = 'Session Expired'
					throw error
				}
			}
			if (!sessionData) {
				sessionDataObj = {
					allIps: { [ipAddress]: { data: {}, count: 0 } },
					totalCount: 0,
				}
				let apiDataObj = {
					type: key,
					request: apiReq,
					response: apiRes,
					url: URL,
				}

				const Count = sessionDataObj.allIps[ipAddress].count
				if (key === 'search') {
					sessionDataObj.allIps[ipAddress].data[key] = {}
					sessionDataObj.allIps[ipAddress].data[key][subkey] = apiDataObj
				} else {
					sessionDataObj.allIps[ipAddress].data[key] = apiDataObj
				}

				sessionDataObj.allIps[ipAddress].count = Count + 1
				sessionDataObj.totalCount = calculateMainCount(sessionDataObj.allIps)
			} else {
				sessionDataObj = sessionData
				let apiDataObj = {
					type: key,
					request: apiReq,
					response: apiRes,
					url: URL,
				}
				const isIpPresent = checkForIp(sessionDataObj.allIps, ipAddress)
				if (!isIpPresent) {
					const parentIpAddress = getParentIp(apiDataObj.url)
					const parentData = _.cloneDeep(sessionDataObj.allIps[parentIpAddress])
					sessionDataObj.allIps[ipAddress] = { ...parentData }
					sessionDataObj.allIps[ipAddress].count = 0
				}
				const sessionCount = sessionDataObj.allIps[ipAddress].count
				let shouldCountIncrease = false
				if (key === 'search') {
					if (
						Object.keys(sessionDataObj.allIps[ipAddress].data[key]).length === 0
					) {
						shouldCountIncrease = true
					}
					sessionDataObj.allIps[ipAddress].data[key][subkey] = apiDataObj
					if (shouldCountIncrease)
						sessionDataObj.allIps[ipAddress].count = sessionCount + 1
					sessionDataObj.totalCount = calculateMainCount(sessionDataObj.allIps)
				} else {
					sessionDataObj.allIps[ipAddress].data[key] = apiDataObj
					sessionDataObj.allIps[ipAddress].count = sessionCount + 1
					sessionDataObj.totalCount = calculateMainCount(sessionDataObj.allIps)
				}
			}
			return {
				sessionId: sessionId,
				sessionData: sessionDataObj,
			}
		}
		const sessionRes = await sessionLogic(req, cacheData)
		const sessionKey = sessionRes.sessionId
		const sessionExpiryTime = 15 * 60
		const sessionData = sessionRes.sessionData
		const setSessionRes = await setDataInCache(
			sessionData,
			sessionKey,
			sessionExpiryTime
		)
		const ReturnSubflowResponse = {
			sessionData: setSessionRes,
			params: req,
			secrets: process.env,
			headers,
		}
		const updatedReturnSuccessRes = {
			...ReturnSubflowResponse,
		}

		if (updatedReturnSuccessRes?.output?.responseType === 'xml') {
			delete updatedReturnSuccessRes.headers
			return updatedReturnSuccessRes.output.data
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
				? { output: finalResponse }
				: updatedReturnSuccessRes
		} else return 'successfully run'
	} catch (error) {
		const templateType = 'travel'

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
	atcrefundsubflow,
	amadeuspnrcancel,
	blockhotelroom,
	checkduplicatebooking,
	promocodeupdate,
	sendticketingemail,
	subflowcacheget,
}
