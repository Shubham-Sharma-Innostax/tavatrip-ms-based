const { tavaLogger } = require('../../../helpers')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')
const XMLWriter = require('xml-writer')
const moment = require('moment')
const { xml2js } = require('xml-js')
const { callHeaderData } = require('../../../services/amadeus/callHeaderData')
const { callSignout } = require('../../../services/amadeus/signout')

const amadeusbook = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const bookRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const bookingMap = {
			input: bookRequest.body,
			params: bookRequest,
			secrets: process.env,
			headers,
		}
		const bookingExternalOuput = []
		for (let journey of bookingMap.input.bookingJSON.journeyDetails) {
			const internalOutput = journey
			const checkResponse = async () => {
				const CallAmadeusHeaderDataRESTAPIEndpoint = {
					input: internalOutput,
					params: bookRequest,
					secrets: process.env,
					headers,
				}

				let headerResponse = await callHeaderData(
					corelationId,
					CallAmadeusHeaderDataRESTAPIEndpoint,
					templateType
				)
				const SellBookRequest = {
					input: headerResponse,
					params: bookRequest,
					secrets: process.env,
					headers,
				}

				const createAirSellFromRecommendationRequest = async function () {
					const bookRQ = journey
					const headerData = SellBookRequest.input
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
							.startElement('ses:Session')
							.writeAttribute(
								'xmlns:ses',
								'http://xml.amadeus.com/2010/06/Session_v3'
							)
							.writeAttribute('TransactionStatusCode', 'Start')
							.endElement()
							.startElement('add:MessageID')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text(headerData.output.messageID)
							.endElement()
							.startElement('add:Action')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text('http://webservices.amadeus.com/ITAREQ_05_2_IA')
							.endElement()
							.startElement('add:To')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text(
								SellBookRequest.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO'
							)
							.endElement()
							.startElement('link:TransactionFlowLink')
							.writeAttribute(
								'xmlns:link',
								'http://wsdl.amadeus.com/2010/06/ws/Link_v1'
							)
							.endElement()
							.startElement('oas:Security')
							.writeAttribute(
								'xmlns:oas',
								'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd'
							)
							.startElement('oas:UsernameToken')
							.writeAttribute(
								'xmlns:oas1',
								'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'
							)
							.writeAttribute('oas1:Id', 'UsernameToken-1')
							.startElement('oas:Username')
							.text('WSIOOTAV')
							.endElement()
							.startElement('oas:Nonce')
							.writeAttribute(
								'EncodingType',
								'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary'
							)
							.text(headerData.output.base64Nonce)
							.endElement()
							.startElement('oas:Password')
							.writeAttribute(
								'Type',
								'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest'
							)
							.text(headerData.output.hashedPassword)
							.endElement()
							.startElement('oas1:Created')
							.text(headerData.output.created)
							.endElement()
							.endElement()
							.endElement()
							.startElement('AMA_SecurityHostedUser')
							.writeAttribute(
								'xmlns',
								'http://xml.amadeus.com/2010/06/Security_v1'
							)
							.startElement('UserID')
							.writeAttribute('POS_Type', '1')
							.writeAttribute('PseudoCityCode', 'DELVS38SM')
							.writeAttribute('AgentDutyCode', 'SU')
							.writeAttribute('RequestorType', 'U')
							.endElement()
							.endElement()
							.endElement()
						return xmlWriter
					}

					const createItineraryDetails = (xmlWriter) => {
						for (let i = 0; i < bookRQ.itineraries.length; i++) {
							const segments = bookRQ.itineraries[i].segments
							const numSeg = segments.length
							const momentDeparture = moment
							const noPax = bookRQ.travelerDetails.length
							xmlWriter.startElement('itineraryDetails')

							xmlWriter.startElement('originDestinationDetails')
							xmlWriter.writeElement('origin', segments[0].departure.iataCode)
							xmlWriter.writeElement(
								'destination',
								segments[numSeg - 1].arrival.iataCode
							)
							xmlWriter.endElement()

							xmlWriter.startElement('message')
							xmlWriter.startElement('messageFunctionDetails')
							xmlWriter.writeElement('messageFunction', '183')
							xmlWriter.endElement()
							xmlWriter.endElement()

							segments.forEach((segment) => {
								xmlWriter.startElement('segmentInformation')
								const departure = momentDeparture(segment.departure.date)

								xmlWriter.startElement('travelProductInformation')
								xmlWriter.startElement('flightDate')
								xmlWriter
									.startElement('departureDate')
									.text(departure.format('DDMMYY'))
									.endElement()
								xmlWriter.endElement()

								xmlWriter.startElement('boardPointDetails')
								xmlWriter
									.startElement('trueLocationId')
									.text(segment.departure.iataCode)
									.endElement()
								xmlWriter.endElement()

								xmlWriter.startElement('offpointDetails')
								xmlWriter
									.startElement('trueLocationId')
									.text(segment.arrival.iataCode)
									.endElement()
								xmlWriter.endElement()

								xmlWriter.startElement('companyDetails')
								xmlWriter
									.startElement('marketingCompany')
									.text(segment.carrierCode)
									.endElement()
								xmlWriter.endElement()

								xmlWriter.startElement('flightIdentification')
								xmlWriter
									.startElement('flightNumber')
									.text(segment.flightNumber)
									.endElement()
								xmlWriter
									.startElement('bookingClass')
									.text(segment.bookingClass)
									.endElement()
								xmlWriter.endElement()
								xmlWriter.endElement()

								xmlWriter.startElement('relatedproductInformation')
								xmlWriter.startElement('quantity').text(noPax).endElement()
								xmlWriter.startElement('statusCode').text('NN').endElement()
								xmlWriter.endElement()
								xmlWriter.endElement()
							})
							xmlWriter.endElement()
						}
						return xmlWriter
					}

					const createdmessageActionDetails = (xmlWriter) => {
						return xmlWriter
							.startElement('messageActionDetails')
							.startElement('messageFunctionDetails')
							.writeElement('messageFunction', '183')
							.writeElement('additionalMessageFunction', 'M1')
							.endElement()
							.endElement()
					}

					const createSoapbody = (xmlWriter) => {
						xmlWriter.startElement('soap:Body')
						xmlWriter.startElement('Air_SellFromRecommendation')

						createdmessageActionDetails(xmlWriter)
						createItineraryDetails(xmlWriter)

						xmlWriter.endElement()
						xmlWriter.endElement()
					}

					const request = () => {
						const xmlWriter = new XMLWriter({ indent: '  ' })

						createSoapEnvelope(xmlWriter)
						createSoapHeader(xmlWriter)
						createSoapbody(xmlWriter)

						xmlWriter.endElement()

						return xmlWriter.toString()
					}

					return request()
				}
				const airSellRequest = await createAirSellFromRecommendationRequest()

				const CallAirSellSOAPAPI = {
					input: airSellRequest,
					params: bookRequest,
					secrets: process.env,
					headers,
				}

				const xmlToJson = (data = '') =>
					xml2js(data, {
						compact: true,
						textKey: '_text',
						cdataKey: '_text',
					})

				let airSellResponse
				let responseType = 'json'
				tavaLogger(
					corelationId,
					'Request',
					url,
					CallAirSellSOAPAPI.input,
					templateType
				)
				try {
					airSellResponse = await axios(
						`${CallAirSellSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
						{
							method: 'post',
							headers: {
								SOAPAction: `http://webservices.amadeus.com/ITAREQ_05_2_IA`,
							},
							data: CallAirSellSOAPAPI.input,
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
				const AirSellSuccessResponse = {
					input: airSellResponse,
					params: bookRequest,
					secrets: process.env,
					headers,
				}
				let airSellExternalOutput
				if (
					!(
						AirSellSuccessResponse.input['soap:Envelope']['soap:Body'][
							'soap:Fault'
						]?.faultcode?._text ||
						(AirSellSuccessResponse.input['soap:Envelope']['soap:Body']
							.Air_SellFromRecommendationReply?.errorAtMessageLevel &&
							AirSellSuccessResponse.input['soap:Envelope']['soap:Body']
								.Air_SellFromRecommendationReply?.errorAtMessageLevel
								?.errorSegment?.errorDetails?.errorCategory._text === 'EC')
					)
				) {
					const checkResponse = async () => {
						const inputData = {
							...AirSellSuccessResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const PNRAddMultiBookRequest = {
							input: inputData,
							params: bookRequest,
							secrets: process.env,
							headers,
						}

						const createPNRAddMultiElementsRequest = async function () {
							const bookRQ = journey
							const sessionData =
								PNRAddMultiBookRequest.input.input['soap:Envelope'][
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
										PNRAddMultiBookRequest.secrets.AMADEUS_API_BASE_URL +
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

							const writeTravellerInfo = (
								xmlWriter,
								count,
								traveller,
								type,
								associateTraveller
							) => {
								let quantity = 1
								xmlWriter.startElement('travellerInfo')
								xmlWriter.startElement('elementManagementPassenger')
								xmlWriter.startElement('reference')
								xmlWriter.writeElement('qualifier', 'PR')
								xmlWriter.writeElement('number', count)
								xmlWriter.endElement()
								xmlWriter.writeElement('segmentName', 'NM')
								xmlWriter.endElement()
								xmlWriter.startElement('passengerData')
								xmlWriter.startElement('travellerInformation')
								xmlWriter.startElement('traveller')
								xmlWriter.writeElement('surname', traveller.familyName)
								if (associateTraveller != null) {
									xmlWriter.writeElement('quantity', '2')
								} else {
									xmlWriter.writeElement('quantity', quantity)
								}
								xmlWriter.endElement()
								xmlWriter.startElement('passenger')
								xmlWriter.writeElement('firstName', traveller.givenName)
								if (associateTraveller != null) {
									xmlWriter.writeElement('type', 'ADT')
								} else {
									xmlWriter.writeElement('type', type)
								}
								xmlWriter.endElement()
								if (associateTraveller != null) {
									xmlWriter.startElement('passenger')
									xmlWriter.writeElement(
										'firstName',
										associateTraveller.givenName
									)
									xmlWriter.writeElement('type', 'INF')
									xmlWriter.endElement()
								}
								xmlWriter.endElement()
								if (
									traveller.travelerType === 'CHILD' ||
									traveller.travelerType === 'INFANT'
								) {
									const date = moment(traveller.dateOfBirth)
									xmlWriter.startElement('dateOfBirth')
									xmlWriter.startElement('dateAndTimeDetails')
									xmlWriter.writeElement('qualifier', '706')
									xmlWriter.writeElement(
										'date',
										date.format('DDMMMYY').toUpperCase()
									)
									xmlWriter.endElement()
									xmlWriter.endElement()
								} else if (
									associateTraveller != null &&
									associateTraveller.travelerType === 'INFANT'
								) {
									const date = moment(associateTraveller.dateOfBirth)
									xmlWriter.startElement('dateOfBirth')
									xmlWriter.startElement('dateAndTimeDetails')
									xmlWriter.writeElement('qualifier', '706')
									xmlWriter.writeElement(
										'date',
										date.format('DDMMMYY').toUpperCase()
									)
									xmlWriter.endElement()
									xmlWriter.endElement()
								}
								xmlWriter.endElement()
								xmlWriter.endElement()
							}
							const writePaxInfo = (xmlWriter, travelerDetails) => {
								let count = 1
								if (Array.isArray(travelerDetails)) {
									travelerDetails.forEach((traveller) => {
										let type = ''
										switch (traveller.travelerType) {
											case 'ADULT':
												type = 'ADT'
												break
											case 'CHILD':
												type = 'CHD'
												break
											case 'INFANT':
												type = 'INF'
												break
										}
										if (traveller.travelerType === 'INFANT' && traveller.Id) {
											travelerDetails.forEach((associateTraveller) => {
												if (associateTraveller.id === traveller.associatedID) {
													writeTravellerInfo(
														xmlWriter,
														count,
														associateTraveller,
														type,
														traveller
													)
												}
											})
											count++
										} else {
											writeTravellerInfo(
												xmlWriter,
												count,
												traveller,
												type,
												null
											)
											count++
										}
									})
								}
								return xmlWriter
							}

							const createSoapbody = (xmlWriter) => {
								xmlWriter.startElement('soap:Body')
								xmlWriter.startElement('PNR_AddMultiElements')
								xmlWriter.startElement('pnrActions')
								xmlWriter.writeElement('optionCode', '0')
								xmlWriter.endElement()
								writePaxInfo(xmlWriter, bookRQ.travelerDetails)
								xmlWriter.startElement('dataElementsMaster')
								xmlWriter.startElement('marker1')
								xmlWriter.endElement()
								xmlWriter.startElement('dataElementsIndiv')
								xmlWriter.startElement('elementManagementData')
								xmlWriter.writeElement('segmentName', 'AP')
								xmlWriter.endElement()
								xmlWriter.startElement('freetextData')
								xmlWriter.startElement('freetextDetail')
								xmlWriter.writeElement('subjectQualifier', '3')
								xmlWriter.writeElement('type', 'P21')
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.startElement('dataElementsIndiv')
								xmlWriter.startElement('elementManagementData')
								xmlWriter.writeElement('segmentName', 'TK')
								xmlWriter.endElement()
								xmlWriter.startElement('ticketElement')
								xmlWriter.startElement('ticket')
								xmlWriter.writeElement('indicator', 'OK')
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.startElement('dataElementsIndiv')
								xmlWriter.startElement('elementManagementData')
								xmlWriter.writeElement('segmentName', 'RF')
								xmlWriter.endElement()
								xmlWriter.startElement('freetextData')
								xmlWriter.startElement('freetextDetail')
								xmlWriter.writeElement('subjectQualifier', '3')
								xmlWriter.writeElement('type', 'P22')
								xmlWriter.endElement()
								xmlWriter.writeElement('longFreetext', 'AWSUI')
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.startElement('dataElementsIndiv')
								xmlWriter.startElement('elementManagementData')
								xmlWriter.writeElement('segmentName', 'FP')
								xmlWriter.endElement()
								xmlWriter.startElement('formOfPayment')
								xmlWriter.startElement('fop')
								xmlWriter.writeElement('identification', 'CA')
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.endElement()
								xmlWriter.endElement()
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
						const pnrAddMultiElement = await createPNRAddMultiElementsRequest()
						const CallPNRAddSOAPAPIEndpoint_ = {
							input: pnrAddMultiElement,
							params: bookRequest,
							secrets: process.env,
							headers,
						}

						const xmlToJson = (data = '') =>
							xml2js(data, {
								compact: true,
								textKey: '_text',
								cdataKey: '_text',
							})

						let pnrAddMultiElementResponse
						let responseType = 'json'
						tavaLogger(
							corelationId,
							'Request',
							url,
							CallPNRAddSOAPAPIEndpoint_.input,
							templateType
						)
						try {
							pnrAddMultiElementResponse = await axios(
								`${CallPNRAddSOAPAPIEndpoint_.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
								{
									method: 'post',
									headers: {
										SOAPAction: `http://webservices.amadeus.com/PNRADD_21_1_1A`,
									},
									data: CallPNRAddSOAPAPIEndpoint_.input,
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
						const PNRAddSuccessResponse = {
							input: pnrAddMultiElementResponse,
							params: bookRequest,
							secrets: process.env,
							headers,
						}
						let pnrAddExternalOutput
						if (
							!(
								PNRAddSuccessResponse.input['soap:Envelope']['soap:Body'][
									'soap:Fault'
								]?.faultcode?._text ||
								(PNRAddSuccessResponse.input['soap:Envelope']['soap:Body']
									.PNR_Reply?.generalErrorInfo &&
									PNRAddSuccessResponse.input['soap:Envelope']['soap:Body']
										.PNR_Reply?.generalErrorInfo?.errorOrWarningCodeDetails
										?.errorDetails?.errorCategory._text === 'EC')
							)
						) {
							const checkResponse = async () => {
								const inputData = {
									...PNRAddSuccessResponse,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers
								const internalOutput = inputData
								const GetPriceRule = {
									input: internalOutput,
									params: bookRequest,
									secrets: process.env,
									headers,
								}
								const fareRule = await prisma.$queryRawUnsafe(
									`SELECT "indicators" FROM "specialServiceRuleTable" WHERE "request" = 'PricePNRWithBookingClass'`
								)

								const PricePNRWithBookingRequest = {
									input: fareRule,
									params: bookRequest,
									secrets: process.env,
									headers,
									internalOutput: internalOutput,
								}

								const createPNRWithBookingAPIRequest = async function () {
									let temp =
										PricePNRWithBookingRequest.input[0]?.indicators ||
										'RU,RLO,RP'
									const indicators = temp.split(',').map((item) => item.trim())

									const sessionData =
										PricePNRWithBookingRequest.internalOutput.input[
											'soap:Envelope'
										]['soap:Header']['awsse:Session']
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
											.text('http://webservices.amadeus.com/TPCBRQ_21_1_1A')
											.endElement()
											.startElement('add:To')
											.writeAttribute(
												'xmlns:add',
												'http://www.w3.org/2005/08/addressing'
											)
											.text(
												PricePNRWithBookingRequest.secrets
													.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO'
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
										xmlWriter.startElement('soap:Body')
										xmlWriter.startElement('Fare_PricePNRWithBookingClass')
										indicators.forEach((element) => {
											xmlWriter.startElement('pricingOptionGroup')
											xmlWriter.startElement('pricingOptionKey')
											xmlWriter.writeElement('pricingOptionKey', element)
											xmlWriter.endElement()
											xmlWriter.endElement()
										})

										xmlWriter.endElement()
										xmlWriter.endElement()
									}

									const request = () => {
										const xmlWriter = new XMLWriter({
											indent: '  ',
										})

										createSoapEnvelope(xmlWriter)
										createSoapHeader(xmlWriter)
										createSoapbody(xmlWriter)

										xmlWriter.endElement()

										return xmlWriter.toString()
									}

									return request()
								}
								const pnrWithBookingClass =
									await createPNRWithBookingAPIRequest()
								const CallPricePNRWithBookingSOAPAPI = {
									input: pnrWithBookingClass,
									params: bookRequest,
									secrets: process.env,
									headers,
								}

								const xmlToJson = (data = '') =>
									xml2js(data, {
										compact: true,
										textKey: '_text',
										cdataKey: '_text',
									})

								let pricePNRWithBookingResponse
								let responseType = 'json'
								tavaLogger(
									corelationId,
									'Request',
									url,
									CallPricePNRWithBookingSOAPAPI.input,
									templateType
								)
								try {
									pricePNRWithBookingResponse = await axios(
										`${CallPricePNRWithBookingSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
										{
											method: 'post',
											headers: {
												SOAPAction: `http://webservices.amadeus.com/TPCBRQ_21_1_1A`,
											},
											data: CallPricePNRWithBookingSOAPAPI.input,
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
								const PricePNRWithBookingClassResponse = {
									input: pricePNRWithBookingResponse,
									params: bookRequest,
									secrets: process.env,
									headers,
								}

								const checkPriceDifferenceAndError = async function () {
									const response = PricePNRWithBookingClassResponse.input
									const travelerDetails = journey.travelerDetails

									let NumOfADT = 0,
										NumOfCH = 0,
										NumOfIN = 0

									if (
										response['soap:Envelope']['soap:Body']['soap:Fault']
											?.faultcode?._text ||
										(response['soap:Envelope']['soap:Body']
											.Fare_PricePNRWithBookingClassReply?.applicationError &&
											response['soap:Envelope']['soap:Body']
												.Fare_PricePNRWithBookingClassReply?.applicationError
												.errorOrWarningCodeDetails.errorDetails.errorCategory
												._text === 'EC')
									) {
										const data = {
											boolean: false,
										}
										console.log('Technical or API error')
										return data
									} else {
										let referenceList = []
										let farePriced = 0.0
										const searchFare = journey.price.grandTotal

										for (let i = 0; i < travelerDetails.length; i++) {
											if (travelerDetails[i].travelerType === 'ADULT') {
												NumOfADT++
											} else if (travelerDetails[i].travelerType === 'CHILD') {
												NumOfCH++
											} else if (travelerDetails[i].travelerType === 'INFANT') {
												NumOfIN++
											}
										}

										const fareCalculation = (fare) => {
											const fareDataSupInformation =
												fare.fareDataInformation.fareDataSupInformation
											const [totalFareData] = fareDataSupInformation.filter(
												(data) => data.fareDataQualifier._text === '712'
											)

											if (Array.isArray(fare.segmentInformation)) {
												if (
													fare.segmentInformation[0]?.fareQualifier
														?.fareBasisDetails?.discTktDesignator?._text ===
													'CH'
												) {
													return (
														parseFloat(totalFareData.fareAmount._text) * NumOfCH
													)
												} else if (
													fare.segmentInformation[0]?.fareQualifier
														?.fareBasisDetails?.discTktDesignator?._text ===
													'ADT'
												) {
													return (
														parseFloat(totalFareData.fareAmount._text) *
														NumOfADT
													)
												} else if (
													fare.segmentInformation[0]?.fareQualifier
														?.fareBasisDetails?.discTktDesignator?._text ===
													'IN'
												) {
													return (
														parseFloat(totalFareData.fareAmount._text) * NumOfIN
													)
												}
											} else {
												if (
													fare.segmentInformation?.fareQualifier
														?.fareBasisDetails?.discTktDesignator?._text ===
													'CH'
												) {
													return (
														parseFloat(totalFareData.fareAmount._text) * NumOfCH
													)
												} else if (
													fare.segmentInformation?.fareQualifier
														?.fareBasisDetails?.discTktDesignator?._text ===
													'ADT'
												) {
													return (
														parseFloat(totalFareData.fareAmount._text) *
														NumOfADT
													)
												} else if (
													fare.segmentInformation?.fareQualifier
														?.fareBasisDetails?.discTktDesignator?._text ===
													'IN'
												) {
													return (
														parseFloat(totalFareData.fareAmount._text) * NumOfIN
													)
												}
											}
										}
										const fareList =
											response['soap:Envelope']['soap:Body']
												?.Fare_PricePNRWithBookingClassReply?.fareList
										if (Array.isArray(fareList)) {
											fareList.forEach((element) => {
												referenceList.push(
													element?.fareReference.uniqueReference._text
												)
												farePriced = farePriced + fareCalculation(element)
											})
										} else {
											referenceList.push(
												fareList?.fareReference.uniqueReference._text
											)
											farePriced = fareCalculation(fareList)
										}

										if (
											farePriced.toFixed(2) ===
											parseFloat(searchFare).toFixed(2)
										) {
											const data = {
												boolean: false,
												referenceList: referenceList,
											}
											return data
										} else {
											const data = {
												boolean: true,
												isPriceChanged: {
													initialPrice: parseFloat(searchFare).toFixed(2),
													currencyCode: journey.price.currency,
													updatedPrice: farePriced.toFixed(2),
													priceChangeAmount:
														farePriced.toFixed(2) -
														parseFloat(searchFare).toFixed(2),
													isPriceIncreased: true,
												},
											}
											return data
										}
									}
								}
								const priceDifferenceAndErrorResponse =
									await checkPriceDifferenceAndError()

								const priceDifferenceAndErrorTrue = {
									input: priceDifferenceAndErrorResponse,
									params: bookRequest,
									secrets: process.env,
									headers,
									output: pricePNRWithBookingResponse,
								}
								let errorExternalOutput
								if (priceDifferenceAndErrorTrue.input.boolean) {
									const checkResponse = async () => {
										const inputData = {
											...priceDifferenceAndErrorTrue,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers

										const CallSignoutAPIEndpoint = {
											input: inputData,
											params: bookRequest,
											secrets: process.env,
											headers,
										}

										let signoutResponse = await callSignout(
											corelationId,
											CallSignoutAPIEndpoint,
											inputData.output,
											templateType
										)

										const bookingUpdate =
											await prisma.$executeRaw`UPDATE "Booking" SET "status" = 'FAILED' WHERE id = ${CallSignoutAPIEndpoint?.params.body.id}`

										const ReturnSuccessResponse = {
											internalOutput: inputData,
											params: bookRequest,
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
									errorExternalOutput = resultCheck

									return resultCheck
								}
								const priceDifferenceAndErrorFalse = {
									input: pricePNRWithBookingResponse,
									params: bookRequest,
									secrets: process.env,
									headers,
									output: priceDifferenceAndErrorResponse,
								}
								let externalOutput_291d89bf_e9ab_4870_aa35_86a1d55f64fd
								if (!priceDifferenceAndErrorFalse.output.boolean) {
									const checkResponse = async () => {
										const inputData = {
											...priceDifferenceAndErrorFalse,
										}
										delete inputData.params
										delete inputData.secrets
										delete inputData.headers

										const TicketCreateTSTRequest = {
											input: inputData,
											params: bookRequest,
											secrets: process.env,
											headers,
										}

										const createTicketTSTAPIRequest = async function () {
											const data = TicketCreateTSTRequest.input.output
											const sessionData =
												TicketCreateTSTRequest.input.input['soap:Envelope'][
													'soap:Header'
												]['awsse:Session']
											const securityToken =
												sessionData['awsse:SecurityToken']._text
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
													.text('http://webservices.amadeus.com/TAUTCQ_04_1_1A')
													.endElement()
													.startElement('add:To')
													.writeAttribute(
														'xmlns:add',
														'http://www.w3.org/2005/08/addressing'
													)
													.text(
														TicketCreateTSTRequest.secrets
															.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO'
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
												xmlWriter.startElement('soap:Body')
												xmlWriter.startElement('Ticket_CreateTSTFromPricing')

												for (let i = 0; i < data.referenceList.length; i++) {
													xmlWriter.startElement('psaList')
													xmlWriter.startElement('itemReference')
													xmlWriter.writeElement('referenceType', 'TST')
													xmlWriter.writeElement(
														'uniqueReference',
														data.referenceList[i]
													)
													xmlWriter.endElement()
													xmlWriter.endElement()
												}

												xmlWriter.endElement()
												xmlWriter.endElement()
											}

											const request = () => {
												const xmlWriter = new XMLWriter({
													indent: '  ',
												})

												createSoapEnvelope(xmlWriter)
												createSoapHeader(xmlWriter)
												createSoapbody(xmlWriter)

												xmlWriter.endElement()

												return xmlWriter.toString()
											}
											return request()
										}
										const ticketTST = await createTicketTSTAPIRequest()
										const CallTicketTSTSOAPAPIEndpoint = {
											input: ticketTST,
											params: bookRequest,
											secrets: process.env,
											headers,
										}

										const xmlToJson = (data = '') =>
											xml2js(data, {
												compact: true,
												textKey: '_text',
												cdataKey: '_text',
											})

										let ticketTSTResponse
										let responseType = 'json'
										tavaLogger(
											corelationId,
											'Request',
											url,
											CallTicketTSTSOAPAPIEndpoint.input,
											templateType
										)
										try {
											ticketTSTResponse = await axios(
												`${CallTicketTSTSOAPAPIEndpoint.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
												{
													method: 'post',
													headers: {
														SOAPAction: `http://webservices.amadeus.com/TAUTCQ_04_1_1A`,
													},
													data: CallTicketTSTSOAPAPIEndpoint.input,
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
										const TicketTSTSuccessResponse = {
											input: ticketTSTResponse,
											params: bookRequest,
											secrets: process.env,
											headers,
										}
										let ticketTSTSuccessExternalOutput
										if (
											!(
												TicketTSTSuccessResponse.input['soap:Envelope'][
													'soap:Body'
												]['soap:Fault']?.faultcode?._text ||
												(TicketTSTSuccessResponse.input['soap:Envelope'][
													'soap:Body'
												]?.Ticket_CreateTSTFromPricingReply?.applicationError &&
													TicketTSTSuccessResponse.input['soap:Envelope'][
														'soap:Body'
													].Ticket_CreateTSTFromPricingReply.applicationError
														.applicationErrorInfo.applicationErrorDetail
														.codeListQualifier._text === 'EC')
											)
										) {
											const checkResponse = async () => {
												const inputData = {
													...TicketTSTSuccessResponse,
												}
												delete inputData.params
												delete inputData.secrets
												delete inputData.headers

												const EndTransactionRequest = {
													input: inputData,
													params: bookRequest,
													secrets: process.env,
													headers,
												}

												const createPNRAddElementAPIRequest =
													async function () {
														const sessionData =
															EndTransactionRequest.input.input[
																'soap:Envelope'
															]['soap:Header']['awsse:Session']
														const securityToken =
															sessionData['awsse:SecurityToken']._text
														const sessionId =
															sessionData['awsse:SessionId']._text
														const sequenceNumber =
															parseInt(
																sessionData['awsse:SequenceNumber']._text
															) + 1
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
																.writeAttribute(
																	'TransactionStatusCode',
																	'InSeries'
																)
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
																	'http://webservices.amadeus.com/PNRADD_21_1_1A'
																)
																.endElement()
																.startElement('add:To')
																.writeAttribute(
																	'xmlns:add',
																	'http://www.w3.org/2005/08/addressing'
																)
																.text(
																	EndTransactionRequest.secrets
																		.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO'
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
															xmlWriter.startElement('soap:Body')
															xmlWriter.startElement('PNR_AddMultiElements')
															xmlWriter.startElement('pnrActions')
															xmlWriter.writeElement('optionCode', '11')
															xmlWriter.writeElement('optionCode', '267')
															xmlWriter.endElement()
															xmlWriter.endElement()
															xmlWriter.endElement()
														}
														const request = () => {
															const xmlWriter = new XMLWriter({
																indent: '  ',
															})
															createSoapEnvelope(xmlWriter)
															createSoapHeader(xmlWriter)
															createSoapbody(xmlWriter)
															xmlWriter.endElement()
															return xmlWriter.toString()
														}
														return request()
													}
												const pnrAddElement =
													await createPNRAddElementAPIRequest()
												const CallPNRAddSOAPAPIEndpoint = {
													input: pnrAddElement,
													params: bookRequest,
													secrets: process.env,
													headers,
												}

												const xmlToJson = (data = '') =>
													xml2js(data, {
														compact: true,
														textKey: '_text',
														cdataKey: '_text',
													})

												let pnrAddMultiElementResponse
												let responseType = 'json'
												tavaLogger(
													corelationId,
													'Request',
													url,
													CallPNRAddSOAPAPIEndpoint.input,
													templateType
												)
												try {
													pnrAddMultiElementResponse = await axios(
														`${CallPNRAddSOAPAPIEndpoint.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
														{
															method: 'post',
															headers: {
																SOAPAction: `http://webservices.amadeus.com/PNRADD_21_1_1A`,
															},
															data: CallPNRAddSOAPAPIEndpoint.input,
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
												const EndTransactionSuccessRespons = {
													input: pnrAddMultiElementResponse,
													params: bookRequest,
													secrets: process.env,
													headers,
												}
												let endTransactionSuccessExternalOutput
												if (
													EndTransactionSuccessRespons.input['soap:Envelope'][
														'soap:Body'
													]?.PNR_Reply?.pnrHeader?.reservationInfo?.reservation
														?.controlNumber?._text
												) {
													const checkResponse = async () => {
														const inputData = {
															...EndTransactionSuccessRespons,
														}
														delete inputData.params
														delete inputData.secrets
														delete inputData.headers

														const CallSignoutAPIEndpoint = {
															input: inputData,
															params: bookRequest,
															secrets: process.env,
															headers,
														}

														let signoutResponse = await callSignout(
															corelationId,
															CallSignoutAPIEndpoint,
															CallSignoutAPIEndpoint.input.input,
															templateType
														)

														const finalBookData = {
															output: signoutResponse,
															params: bookRequest,
															secrets: process.env,
															headers,
															input: inputData,
														}

														const mapBookingData = async function () {
															const pnrReply =
																finalBookData.input.input['soap:Envelope'][
																	'soap:Body'
																]['PNR_Reply']
															const requestedParams = finalBookData.params.body
															const bookingData = async (pnrReply) => {
																let bookingData = {
																	pnr: '',
																	status: '',
																	updatedAt: new Date().toISOString(),
																	id: requestedParams.id,
																}
																if (
																	pnrReply.pnrHeader.reservationInfo
																		?.reservation?.controlNumber?._text
																) {
																	bookingData.pnr =
																		pnrReply.pnrHeader.reservationInfo?.reservation?.controlNumber?._text
																	bookingData.status = 'SUCCESS'
																}
																return bookingData
															}

															return bookingData(pnrReply)
														}
														const updateBookingData = await mapBookingData()
														const UpdateBookingRecordFields = {
															input: updateBookingData,
															params: bookRequest,
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
														const formattedQuery = `"updatedAt" = '${UpdateBookingRecordFields.input.updatedAt}',"pnr" = '${UpdateBookingRecordFields.input.pnr}',"status" = '${UpdateBookingRecordFields.input.status}'`
														const outputData = parseInputData(formattedQuery)
														let query = {}
														let preOperator = ''
														outputData.forEach((item) => {
															if (!item.value.includes('undefined')) {
																query[`${item.key}`] = item.value
															}
															preOperator = item.operator
														})
														const updateBookingTable =
															await prisma.Booking.update({
																where: {
																	id: UpdateBookingRecordFields.input.id,
																},
																data: query,
															})
														const ReturnSuccessResponse = {
															created: updateBookingTable,
															params: bookRequest,
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
													endTransactionSuccessExternalOutput = resultCheck

													return resultCheck
												}
												const EndTransactionErrorRespons = {
													input: pnrAddMultiElementResponse,
													params: bookRequest,
													secrets: process.env,
													headers,
												}
												let endTransactionErrorExternalOutput
												if (
													!EndTransactionErrorRespons.input['soap:Envelope'][
														'soap:Body'
													]?.PNR_Reply?.pnrHeader?.reservationInfo?.reservation
														?.controlNumber?._text
												) {
													const checkResponse = async () => {
														const inputData = { ...EndTransactionErrorRespons }
														delete inputData.params
														delete inputData.secrets
														delete inputData.headers

														const CallSignoutAPIEndpoint = {
															input: inputData,
															params: bookRequest,
															secrets: process.env,
															headers,
														}

														let signoutResponse = await callSignout(
															corelationId,
															CallSignoutAPIEndpoint,
															CallSignoutAPIEndpoint.input.input,
															templateType
														)
														const BookingData = {
															output: signoutResponse,
															params: bookRequest,
															secrets: process.env,
															headers,
															input: inputData,
														}

														const BookingMapper = async function () {
															const bookingData = {
																status: 'FAILED',
																updatedAt: new Date().toISOString(),
																id: BookingData.params.body.id,
															}

															return bookingData
														}
														const updatedBookingData = await BookingMapper()
														const UpdateRecordFields = {
															input: updatedBookingData,
															params: bookRequest,
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
														const formattedQuery = `"status" = '${UpdateRecordFields.input.status}',"updatedAt" = '${UpdateRecordFields.input.updatedAt}'`
														const outputData = parseInputData(formattedQuery)
														let query = {}
														let preOperator = ''
														outputData.forEach((item) => {
															if (!item.value.includes('undefined')) {
																query[`${item.key}`] = item.value
															}
															preOperator = item.operator
														})
														const updatedBooking = await prisma.Booking.update({
															where: {
																id: UpdateRecordFields.input.id,
															},
															data: query,
														})
														const ReturnSuccessResponse = {
															created: updatedBooking,
															params: bookRequest,
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
													endTransactionErrorExternalOutput = resultCheck

													return resultCheck
												}
											}
											const resultCheck = await checkResponse()
											ticketTSTSuccessExternalOutput = resultCheck

											return resultCheck
										}
										const TicketTSTErrorResponse = {
											input: ticketTSTResponse,
											params: bookRequest,
											secrets: process.env,
											headers,
										}
										let ticketTSTErrorExternalOutput
										if (
											TicketTSTErrorResponse.input['soap:Envelope'][
												'soap:Body'
											]['soap:Fault']?.faultcode?._text ||
											(TicketTSTErrorResponse.input['soap:Envelope'][
												'soap:Body'
											]?.Ticket_CreateTSTFromPricingReply?.applicationError &&
												TicketTSTErrorResponse.input['soap:Envelope'][
													'soap:Body'
												].Ticket_CreateTSTFromPricingReply.applicationError
													.applicationErrorInfo.applicationErrorDetail
													.codeListQualifier._text === 'EC')
										) {
											const checkResponse = async () => {
												const inputData = {
													...TicketTSTErrorResponse,
												}
												delete inputData.params
												delete inputData.secrets
												delete inputData.headers

												const CallSignoutAPIEndpoint = {
													input: inputData,
													params: bookRequest,
													secrets: process.env,
													headers,
												}

												let signoutResponse = await callSignout(
													corelationId,
													CallSignoutAPIEndpoint,
													CallSignoutAPIEndpoint.input.input,
													templateType
												)

												const bookingUpdate =
													await prisma.$executeRaw`UPDATE "Booking" SET "status" = 'FAILED' WHERE id = ${CallSignoutAPIEndpoint?.params.body.id}`

												const ReturnSuccessResponse = {
													internalOutput: inputData,
													params: bookRequest,
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
											ticketTSTErrorExternalOutput = resultCheck

											return resultCheck
										}
									}
									const resultCheck = await checkResponse()
									externalOutput_291d89bf_e9ab_4870_aa35_86a1d55f64fd =
										resultCheck

									return resultCheck
								}
							}
							const resultCheck = await checkResponse()
							pnrAddExternalOutput = resultCheck

							return resultCheck
						}
						const PNRAddErrorResponse = {
							input: pnrAddMultiElementResponse,
							params: bookRequest,
							secrets: process.env,
							headers,
						}
						let pnrAddErrorExternalOutput
						if (
							PNRAddErrorResponse.input['soap:Envelope']['soap:Body'][
								'soap:Fault'
							]?.faultcode?._text ||
							(PNRAddErrorResponse.input['soap:Envelope']['soap:Body'].PNR_Reply
								?.generalErrorInfo &&
								PNRAddErrorResponse.input['soap:Envelope']['soap:Body']
									.PNR_Reply?.generalErrorInfo?.errorOrWarningCodeDetails
									?.errorDetails?.errorCategory._text === 'EC')
						) {
							const checkResponse = async () => {
								const inputData = {
									...PNRAddErrorResponse,
								}
								delete inputData.params
								delete inputData.secrets
								delete inputData.headers
								const CallSignoutAPIEndpoint = {
									input: inputData,
									params: bookRequest,
									secrets: process.env,
									headers,
								}

								let signoutResponse = await callSignout(
									corelationId,
									CallSignoutAPIEndpoint,
									CallSignoutAPIEndpoint.input.input,
									templateType
								)

								const bookingUpdate =
									await prisma.$executeRaw`UPDATE "Booking" SET "status" = 'FAILED' WHERE id = ${CallSignoutAPIEndpoint?.params.body.id}`
								const ReturnSuccessRespons = {
									internalOutput: inputData,
									params: bookRequest,
									secrets: process.env,
									headers,
								}
								const updatedReturnSuccessRes = {
									...ReturnSuccessRespons,
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
							pnrAddErrorExternalOutput = resultCheck

							return resultCheck
						}
					}
					const resultCheck = await checkResponse()
					airSellExternalOutput = resultCheck

					return resultCheck
				}
				const AirSellErrorResponse = {
					input: airSellResponse,
					params: bookRequest,
					secrets: process.env,
					headers,
				}
				let airSellErrorExternalOutput
				if (
					AirSellErrorResponse.input['soap:Envelope']['soap:Body']['soap:Fault']
						?.faultcode?._text ||
					(AirSellErrorResponse.input['soap:Envelope']['soap:Body']
						.Air_SellFromRecommendationReply?.errorAtMessageLevel &&
						AirSellErrorResponse.input['soap:Envelope']['soap:Body']
							.Air_SellFromRecommendationReply?.errorAtMessageLevel
							?.errorSegment?.errorDetails?.errorCategory._text === 'EC')
				) {
					const checkResponse = async () => {
						const inputData = {
							...AirSellErrorResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers

						const CallSignoutAPIEndpoint = {
							input: inputData,
							params: bookRequest,
							secrets: process.env,
							headers,
						}

						let signoutResponse = await callSignout(
							corelationId,
							CallSignoutAPIEndpoint,
							CallSignoutAPIEndpoint.input.input,
							templateType
						)

						const bookingUpdate =
							await prisma.$executeRaw`UPDATE "Booking" SET "status" = 'FAILED' WHERE id = ${CallSignoutAPIEndpoint?.params.body.id}`
						const ReturnSuccessResponse = {
							internalOutput: inputData,
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
					airSellErrorExternalOutput = resultCheck

					return resultCheck
				}
			}
			const resultCheck = await checkResponse()
			bookingExternalOuput.push(resultCheck)
		}
		const IfBookingSuccess = {
			input: bookingExternalOuput,
			params: bookRequest,
			secrets: process.env,
			headers,
		}
		let bookingSuccessExternalOutput
		if (
			IfBookingSuccess.input[0].created &&
			IfBookingSuccess.input[0].created.status === 'SUCCESS'
		) {
			const checkResponse = async () => {
				const inputData = {
					...IfBookingSuccess,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const ReturnSuccessResponse = {
					response: inputData.input[0],
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
			bookingSuccessExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		const IfGetPriceDifference = {
			input: bookingExternalOuput,
			params: bookRequest,
			secrets: process.env,
			headers,
		}
		let priceDifferenceExternalOutput
		if (
			IfGetPriceDifference.input[0].internalOutput != null &&
			IfGetPriceDifference.input[0].internalOutput['input'].boolean == true
		) {
			const checkResponse = async () => {
				const inputData = {
					...IfGetPriceDifference,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const GetRecordValue = {
					input: inputData,
					params: bookRequest,
					secrets: process.env,
					headers,
				}
				const pickedValue =
					GetRecordValue.input.input[0].internalOutput['input'].isPriceChanged
				const ReturnSuccessResponse = {
					response: pickedValue,
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
			priceDifferenceExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		const IfGetError = {
			input: bookingExternalOuput,
			params: bookRequest,
			secrets: process.env,
			headers,
		}
		let getErrorExternalOutput
		if (IfGetError.input[0].statusCode != 500 && !IfGetError.input[0].created) {
			const checkResponse = async () => {
				const inputData = {
					...IfGetError,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const GetRecordValue = {
					input: inputData,
					params: bookRequest,
					secrets: process.env,
					headers,
				}
				const pickedValue =
					GetRecordValue.input.input[0].internalOutput.input['soap:Envelope'][
						'soap:Body'
					]
				const ReturnSuccessRespons = {
					response: pickedValue,
					params: bookRequest,
					secrets: process.env,
					headers,
				}
				const updatedReturnSuccessRes = {
					...ReturnSuccessRespons,
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
			getErrorExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		const IfBookingFailed = {
			input: bookingExternalOuput,
			params: bookRequest,
			secrets: process.env,
			headers,
		}
		let bookingFailedExternalOutput
		if (
			IfBookingFailed.input[0].created &&
			IfBookingFailed.input[0].created.status === 'FAILED'
		) {
			const checkResponse = async () => {
				const inputData = {
					...IfBookingFailed,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const GetRecordValue = {
					input: inputData,
					params: bookRequest,
					secrets: process.env,
					headers,
				}
				const pickedValue = GetRecordValue.input.input[0].created
				const ReturnSuccessResponse = {
					response: pickedValue,
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
			bookingFailedExternalOutput = resultCheck
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
	amadeusbook,
}
