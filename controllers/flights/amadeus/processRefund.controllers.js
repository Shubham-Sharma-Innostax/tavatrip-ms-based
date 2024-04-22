const { atcrefundsubflow } = require('../../../helpers/service.js')
const { tavaLogger } = require('../../../helpers/index.js')
const {
	fetchOrStoreDataInCache,
} = require('../../../helpers/fetchAndUpdateCacheData.js')
const prismaClient = require('../../../prismaClient.js')
const { prisma } = prismaClient
const axios = require('axios')
const XMLWriter = require('xml-writer')
const { xml2js, json2xml } = require('xml-js')
const { v4: uuidv4 } = require('uuid')
const { callSignout } = require('../../../services/amadeus/signout.js')

const atcProcessRefund = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const processRefundRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const Subflow = {
			input: processRefundRequest,
			params: processRefundRequest,
			secrets: process.env,
			headers,
		}
		const created = await atcrefundsubflow(
			Subflow,
			res,
			next,
			corelationId,
			url
		)
		const GetRecordValue = {
			input: created,
			params: processRefundRequest,
			secrets: process.env,
			headers,
		}
		const pickedValue = GetRecordValue.input.internalOutput.input

		const APISuccessResponse = {
			input: pickedValue,
			params: processRefundRequest,
			secrets: process.env,
			headers,
		}
		let successResponseExternalOutput
		if (
			!(
				APISuccessResponse.input['soap:Envelope']['soap:Body'][
					'AMA_TicketInitRefundRS'
				]['GeneralReply']?.Error ||
				APISuccessResponse.input['soap:Envelope']['soap:Body']['soap:Fault']
					?.faultcode?._text
			)
		) {
			const checkResponse = async () => {
				const inputData = {
					...APISuccessResponse,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const TicketProcessRefundData = {
					input: inputData,
					params: processRefundRequest,
					secrets: process.env,
					headers,
				}

				const CreateTicketProcessRefundRequest = async function () {
					const sessionData =
						TicketProcessRefundData.input.input['soap:Envelope']['soap:Header'][
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
							.text('http://webservices.amadeus.com/Ticket_ProcessRefund_3.0')
							.endElement()
							.startElement('add:To')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text(process.env.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
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
						xmlWriter.startElement('AMA_TicketProcessRefundRQ')
						xmlWriter.writeAttribute(
							'xmlns',
							'http://xml.amadeus.com/2010/06/TicketGTP_v3'
						)
						xmlWriter.writeAttribute('Version', '3.000')
						xmlWriter.endElement()
						xmlWriter.endElement()
						xmlWriter.endDocument()
						return xmlWriter
					}

					const request = () => {
						const xmlWriter = new XMLWriter({ indent: '  ' })

						createSoapEnvelope(xmlWriter)
						createSoapHeader(xmlWriter)
						createSoapBody(xmlWriter)

						xmlWriter.endElement()

						return xmlWriter.toString()
					}
					return request()
				}
				const ticketProcessRefundRequest =
					await CreateTicketProcessRefundRequest()
				const CallProcessRefundSOAPAPI = {
					input: ticketProcessRefundRequest,
					params: processRefundRequest,
					secrets: process.env,
					headers,
				}

				const xmlToJson = (data = '') =>
					xml2js(data, {
						compact: true,
						textKey: '_text',
						cdataKey: '_text',
					})

				let processRefundResponse
				let responseType = 'json'
				tavaLogger(
					corelationId,
					'Request',
					url,
					CallProcessRefundSOAPAPI.input,
					templateType
				)
				try {
					processRefundResponse = await axios(
						`${CallProcessRefundSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
						{
							method: 'post',
							headers: {
								SOAPAction: `http://webservices.amadeus.com/Ticket_ProcessRefund_3.0`,
							},
							data: CallProcessRefundSOAPAPI.input,
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
				const ProcessRefundErrorResponse = {
					input: processRefundResponse,
					params: processRefundRequest,
					secrets: process.env,
					headers,
				}
				let processRefundErrorResponseExternalOutput
				if (
					ProcessRefundErrorResponse.input['soap:Envelope']['soap:Body'][
						'AMA_TicketProcessRefundRS'
					]['GeneralReply']?.Errors ||
					ProcessRefundErrorResponse.input['soap:Envelope']['soap:Body'][
						'soap:Fault'
					]?.faultcode?._text
				) {
					const checkResponse = async () => {
						const inputData = {
							...ProcessRefundErrorResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const CallSignoutRESTAPIEndpoint = {
							input: inputData,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}

						let signoutResponse = await callSignout(
							corelationId,
							CallSignoutRESTAPIEndpoint,
							CallSignoutRESTAPIEndpoint.input.input,
							templateType
						)

						const APIErrorResponse = {
							output: signoutResponse,
							params: processRefundRequest,
							secrets: process.env,
							headers,
							input: inputData,
						}

						const ReturnSuccessResponse = {
							output:
								APIErrorResponse.input.input['soap:Envelope']['soap:Body'],
							params: processRefundRequest,
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
					processRefundErrorResponseExternalOutput = resultCheck

					return resultCheck
				}
				const ProcessRefundSuccessResponse = {
					input: processRefundResponse,
					params: processRefundRequest,
					secrets: process.env,
					headers,
				}
				let processRefundSuccessResponseExternalOutput
				if (
					!(
						ProcessRefundSuccessResponse.input['soap:Envelope']['soap:Body'][
							'AMA_TicketProcessRefundRS'
						]['GeneralReply']?.Errors ||
						ProcessRefundSuccessResponse.input['soap:Envelope']['soap:Body'][
							'soap:Fault'
						]?.faultcode?._text
					)
				) {
					const checkResponse = async () => {
						const inputData = {
							...ProcessRefundSuccessResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const PNRCancelData = {
							input: inputData,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}

						const createPNRCancelRequest = async function () {
							const pnr = PNRCancelData.params.body.pnr
							const tavaBookingId = PNRCancelData.params.body.tavaBookingId
							const sessionData =
								PNRCancelData.input.input['soap:Envelope']['soap:Header'][
									'awsse:Session'
								]
							const securityToken = sessionData['awsse:SecurityToken']._text
							const sessionId = sessionData['awsse:SessionId']._text
							const sequenceNumber =
								parseInt(sessionData['awsse:SequenceNumber']._text) + 1
							const responseATC =
								PNRCancelData.input.input['soap:Envelope']['soap:Body']
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
									.text(process.env.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
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
								xmlWriter.startElement('soap:Body')
								xmlWriter.startElement('PNR_Cancel')
								xmlWriter.startElement('reservationInfo')
								xmlWriter.startElement('reservation')
								xmlWriter.writeElement('controlNumber', pnr)
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.startElement('pnrActions')
								xmlWriter.writeElement('optionCode', '11')
								xmlWriter.endElement()
								xmlWriter.startElement('cancelElements')
								xmlWriter.writeElement('entryType', 'I')
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.endElement()
								return xmlWriter
							}

							const request = () => {
								const xmlWriter = new XMLWriter({ indent: '  ' })

								createSoapEnvelope(xmlWriter)
								createSoapHeader(xmlWriter)
								createSoapBody(xmlWriter)

								xmlWriter.endElement()

								return xmlWriter.toString()
							}
							const pnrCancelReq = request()
							function calculateAmount(data) {
								const { Amount, DecimalPlaces } = data
								const amountAsFloat = parseFloat(Amount)

								if (DecimalPlaces === '0') {
									return amountAsFloat
								} else {
									const divisor = Math.pow(10, parseInt(DecimalPlaces, 10))
									return parseFloat((amountAsFloat / divisor).toFixed(2))
								}
							}
							const calculateTotalRefund = (refundContractBundle) => {
								let refundAmount = 0
								if (!Array.isArray(refundContractBundle)) {
									refundAmount = calculateAmount(
										refundContractBundle.RefundDetails['att:Contracts'][
											'att:Contract'
										]['att:Refundable']['_attributes']
									)
								} else {
									for (const ticket of refundContractBundle) {
										let calculatedAmount = calculateAmount(
											ticket.RefundDetails['att:Contracts']['att:Contract'][
												'att:Refundable'
											]['_attributes']
										)
										refundAmount += calculatedAmount
									}
								}
								return refundAmount.toString()
							}
							const totalRefund = calculateTotalRefund(
								responseATC.AMA_TicketProcessRefundRS.FunctionalData
									.ContractBundle
							)
							return {
								pnrCancelReq: pnrCancelReq,
								refundQueue: {
									refundAmount: totalRefund,
									source: 'AM',
									tavaBookingId: tavaBookingId,
									bookingId: PNRCancelData.params.body.id,
									paymentId: PNRCancelData.params.body.paymentId,
									currency: PNRCancelData.params.body.currency,
								},
							}
						}
						const cancelPNR = await createPNRCancelRequest()

						const RunJavaScriptCode = {
							input: cancelPNR,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}

						const CreateSingleRecord = {
							input: RunJavaScriptCode.input.refundQueue,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}
						const created = await prisma.RefundQueue.create({
							data: CreateSingleRecord.input,
						})
						const UpdateRecordFields = {
							input: created,
							params: processRefundRequest,
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
						const formattedWhereQuery = `"id"='${UpdateRecordFields.params.body.id}'`
						const formattedSetQuery = `"cancelationStatus"= 'APPLIED'`
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

						const CallSOAPAPIEndpoint = {
							updateInfo: updateInfo,
							params: processRefundRequest,
							secrets: process.env,
							headers,
							input: cancelPNR,
						}

						const xmlToJson = (data = '') =>
							xml2js(data, {
								compact: true,
								textKey: '_text',
								cdataKey: '_text',
							})

						let pnrCancelResponse
						let responseType = 'json'
						tavaLogger(
							corelationId,
							'Request',
							url,
							CallSOAPAPIEndpoint.input.pnrCancelReq,
							templateType
						)
						try {
							pnrCancelResponse = await axios(
								`${CallSOAPAPIEndpoint.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
								{
									method: 'post',
									headers: {
										SOAPAction: `http://webservices.amadeus.com/PNRXCL_21_1_1A`,
									},
									data: CallSOAPAPIEndpoint.input.pnrCancelReq,
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
						const PNRCancelSuccessResponse = {
							input: pnrCancelResponse,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}
						let pnrCancelSuccessExternalOutput
						if (
							!(
								PNRCancelSuccessResponse.input['soap:Envelope']['soap:Body']
									?.pnrReply?.['soap:Fault']?.faultcode?._text ||
								PNRCancelSuccessResponse.input['soap:Envelope']['soap:Body']
									?.pnrReply?.PNR_Reply?.information
									?.applicationErrorInformation
							)
						) {
							const checkResponse = async () => {
								const inputData = {
									...PNRCancelSuccessResponse,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers
								const internalOutput = inputData
								const GetRecordValue = {
									input: internalOutput,
									params: processRefundRequest,
									secrets: process.env,
									headers,
								}
								const pickedValue =
									GetRecordValue.input.input['soap:Envelope']['soap:Body']

								const UpdateRecordFieldsbyQuery = {
									input: pickedValue,
									params: processRefundRequest,
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
								const formattedWhereQuery = `"id"='${UpdateRecordFieldsbyQuery.params.body.id}'`
								const formattedSetQuery = `"status"= 'CANCELED',"ticketingStatus"= 'CANCELED'`
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
									pickedValue: pickedValue,
									params: processRefundRequest,
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
							pnrCancelSuccessExternalOutput = resultCheck
							return res.send(resultCheck)
						}
						const PNRCancelErrorResponse = {
							input: pnrCancelResponse,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}
						let pnrCancelErrorResponseExternalOutput
						if (
							PNRCancelErrorResponse.input['soap:Envelope']['soap:Body']
								?.pnrReply?.['soap:Fault']?.faultcode?._text ||
							PNRCancelErrorResponse.input['soap:Envelope']['soap:Body']
								?.pnrReply?.PNR_Reply?.information?.applicationErrorInformation
								?.applicationErrorDetail?.codeListQualifier === 'EC'
						) {
							const checkResponse = async () => {
								const inputData = {
									...PNRCancelErrorResponse,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers
								const CallSignoutRESTAPIEndpoint = {
									input: inputData,
									params: processRefundRequest,
									secrets: process.env,
									headers,
								}

								let signoutResponse = await callSignout(
									corelationId,
									CallSignoutRESTAPIEndpoint,
									CallSignoutRESTAPIEndpoint.input.input,
									templateType
								)

								const finalResponse = {
									output: signoutResponse,
									params: processRefundRequest,
									secrets: process.env,
									headers,
									input: inputData,
								}
								const ReturnSuccessResponse = {
									output:
										finalResponse.input.input['soap:Envelope']['soap:Body'],
									params: processRefundRequest,
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
							pnrCancelErrorResponseExternalOutput = resultCheck
							return res.send(resultCheck)
						}
					}
					const resultCheck = await checkResponse()
					processRefundSuccessResponseExternalOutput = resultCheck

					return resultCheck
				}
			}
			const resultCheck = await checkResponse()
			successResponseExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		const APIErrorResponse = {
			input: pickedValue,
			params: processRefundRequest,
			secrets: process.env,
			headers,
		}
		let errorResponseExternalOutput
		if (
			APIErrorResponse.input['soap:Envelope']['soap:Body'][
				'AMA_TicketInitRefundRS'
			]?.Errors ||
			APIErrorResponse.input['soap:Envelope']['soap:Body']['soap:Fault']
				?.faultcode?._text
		) {
			const checkResponse = async () => {
				const inputData = {
					...APIErrorResponse,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const TicketIgnoreData = {
					input: inputData,
					params: processRefundRequest,
					secrets: process.env,
					headers,
				}

				const createTicketIgnoreRefundRQ = async function () {
					const sessionData =
						TicketIgnoreData.input.input['soap:Envelope']['soap:Header'][
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
							.text('http://webservices.amadeus.com/Ticket_IgnoreRefund_3.0')
							.endElement()
							.startElement('add:To')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text(process.env.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
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
						xmlWriter.startElement('AMA_TicketIgnoreRefundRQ')
						xmlWriter.writeAttribute(
							'xmlns',
							'http://xml.amadeus.com/2010/06/TicketGTP_v3'
						)
						xmlWriter.writeAttribute('Version', '3.000')
						xmlWriter.endElement()
						xmlWriter.endElement()
						xmlWriter.endDocument()
						return xmlWriter
					}

					const request = () => {
						const xmlWriter = new XMLWriter({ indent: '  ' })

						createSoapEnvelope(xmlWriter)
						createSoapHeader(xmlWriter)
						createSoapBody(xmlWriter)

						xmlWriter.endElement()

						return xmlWriter.toString()
					}
					return request()
				}
				const ticketIgnoreRefundRQ = await createTicketIgnoreRefundRQ()
				const CallTicketIgnoreSOAPAPI = {
					input: ticketIgnoreRefundRQ,
					params: processRefundRequest,
					secrets: process.env,
					headers,
				}

				const xmlToJson = (data = '') =>
					xml2js(data, {
						compact: true,
						textKey: '_text',
						cdataKey: '_text',
					})

				let ticketIgnoreRefundResponse
				let responseType = 'json'
				tavaLogger(
					corelationId,
					'Request',
					url,
					CallTicketIgnoreSOAPAPI.input,
					templateType
				)
				try {
					ticketIgnoreRefundResponse = await axios(
						`${CallTicketIgnoreSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
						{
							method: 'post',
							headers: {
								SOAPAction: `http://webservices.amadeus.com/Ticket_IgnoreRefund_3.0`,
							},
							data: CallTicketIgnoreSOAPAPI.input,
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
				const TicketIgnoreAPIErrorResponse = {
					input: ticketIgnoreRefundResponse,
					params: processRefundRequest,
					secrets: process.env,
					headers,
				}
				let ticketIgnoreAPIErrorExternalOutput
				if (
					!(
						TicketIgnoreAPIErrorResponse.input['soap:Envelope']['soap:Body'][
							'soap:Fault'
						]?.faultcode?._text ||
						TicketIgnoreAPIErrorResponse.input['soap:Envelope']['soap:Body']
							?.AMA_TicketIgnoreRefundRS?.Errors?.['ama:Error'] ||
						!TicketIgnoreAPIErrorResponse.input['soap:Envelope']['soap:Body']
							?.AMA_TicketIgnoreRefundRS?.Success
					)
				) {
					const checkResponse = async () => {
						const inputData = {
							...TicketIgnoreAPIErrorResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const PNRAddMultiElementData = {
							input: inputData,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}

						const createPNRAddMultiElementsRequest = async function () {
							const sessionData =
								PNRAddMultiElementData.input.input['soap:Envelope'][
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
									.text('http://webservices.amadeus.com/PNRADD_21_1_1A')
									.endElement()
									.startElement('add:To')
									.writeAttribute(
										'xmlns:add',
										'http://www.w3.org/2005/08/addressing'
									)
									.text(process.env.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
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
						const addMultiElementsRequest =
							await createPNRAddMultiElementsRequest()

						const CallPNRAddMultiSOAPAPI = {
							input: addMultiElementsRequest,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}

						const xmlToJson = (data = '') =>
							xml2js(data, {
								compact: true,
								textKey: '_text',
								cdataKey: '_text',
							})

						let pnrAddMultiResponse
						let responseType = 'json'
						tavaLogger(
							corelationId,
							'Request',
							url,
							CallPNRAddMultiSOAPAPI.input,
							templateType
						)
						try {
							pnrAddMultiResponse = await axios(
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
						const GetRecordValue = {
							input: pnrAddMultiResponse,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}
						const pickedValue = GetRecordValue.input.output['soap:Body']
						const ReturnSuccessResponse = {
							pickedValue: pickedValue,
							params: processRefundRequest,
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
					ticketIgnoreAPIErrorExternalOutput = resultCheck

					return resultCheck
				}
				const TicketIgnoreAPISuccessResponse = {
					input: ticketIgnoreRefundResponse,
					params: processRefundRequest,
					secrets: process.env,
					headers,
				}
				let ticketIgnoreAPISuccessExternalOutput
				if (
					TicketIgnoreAPISuccessResponse.input['soap:Envelope']['soap:Body'][
						'soap:Fault'
					]?.faultcode?._text ||
					TicketIgnoreAPISuccessResponse.input['soap:Envelope']['soap:Body']
						?.AMA_TicketIgnoreRefundRS?.Errors?.['ama:Error'] ||
					!TicketIgnoreAPISuccessResponse.input['soap:Envelope']['soap:Body']
						?.AMA_TicketIgnoreRefundRS?.Success
				) {
					const checkResponse = async () => {
						const inputData = {
							...TicketIgnoreAPISuccessResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const CallSignoutRESTAPIEndpoint = {
							input: inputData,
							params: processRefundRequest,
							secrets: process.env,
							headers,
						}

						let signoutResponse = await callSignout(
							corelationId,
							CallSignoutRESTAPIEndpoint,
							CallSignoutRESTAPIEndpoint.input.input,
							templateType
						)

						const finalResponse = {
							output: signoutResponse,
							params: processRefundRequest,
							secrets: process.env,
							headers,
							input: inputData,
						}

						const ReturnSuccessResponse = {
							output: finalResponse.input.input['soap:Envelope']['soap:Body'],
							params: processRefundRequest,
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
					ticketIgnoreAPISuccessExternalOutput = resultCheck

					return resultCheck
				}
			}
			const resultCheck = await checkResponse()
			errorResponseExternalOutput = resultCheck
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
	atcProcessRefund,
}
