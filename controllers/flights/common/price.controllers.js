const { subflowcacheget } = require('../../../helpers/service.js')
const { tavaLogger } = require('../../../helpers/index.js') 
const { simulateAPICall } = require('../../../gdsApiCall/simulateApiCall.js')
const {
	fetchOrStoreDataInCache,
} = require('../../../helpers/fetchAndUpdateCacheData.js')
const prismaClient = require('../../../prismaClient.js')
const { prisma } = prismaClient
const axios = require('axios')
const XMLWriter = require('xml-writer')
const moment = require('moment')
const { xml2js, json2xml } = require('xml-js')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../../services/tbo/authentication.js')
const {
	callHeaderData,
} = require('../../../services/amadeus/callHeaderData.js')
const { callSignout } = require('../../../services/amadeus/signout.js')
const {
	callIBPricingAPI,
} = require('../../../services/amadeus/informativeBP.js')
const { callMiniRuleAPI } = require('../../../services/amadeus/miniRule.js')

const price = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const priceRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const tboPriceRequest = {
			input: priceRequest,
			params: priceRequest,
			secrets: process.env,
			headers,
		}
		let tboPriceExternalOutput
		if (tboPriceRequest.input.body.source === 'TBO') {
			const checkResponse = async () => {
				const inputData = {
					...tboPriceRequest,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers
				const internalOutput = inputData

				const tboAuthRequest = {
					input: internalOutput,
					params: priceRequest,
					secrets: process.env,
					headers,
				}

				const authRequest = await createAuthRequest(
					tboAuthRequest.secrets,
					tboAuthRequest.input.input.body
				)
				const CallAuthRESTAPI = {
					input: authRequest,
					params: priceRequest,
					secrets: process.env,
					headers,
				}

				let authResponse = await callAuthRESTAPI(
					corelationId,
					CallAuthRESTAPI,
					templateType
				)

				const tboFareRuleRequest = {
					input: authResponse,
					params: priceRequest,
					secrets: process.env,
					headers,
				}

				const createFareRuleRequest = async function () {
					function inputMapper(input) {
						const { TokenId } = input.input
						const { endUserIp, traceId, resultIndex } = input.params.body
						return {
							EndUserIp: endUserIp,
							TokenId: TokenId,
							TraceId: traceId,
							ResultIndex: resultIndex,
						}
					}

					return inputMapper(tboFareRuleRequest)
				}
				const fareRuleRequest = await createFareRuleRequest()

				const CallFareRuleRESTAPI = {
					input: fareRuleRequest,
					params: priceRequest,
					secrets: process.env,
					headers,
				}

				let fareRuleResponse
				try {
					const cacheKey = ''
					const cacheExpireTime = 0
					const isCacheRequired = false
					tavaLogger(
						corelationId,
						'Request',
						`${CallFareRuleRESTAPI.secrets.TBO_BASE_URL}/FareRule?`,
						CallFareRuleRESTAPI.input,
						templateType
					)
					const fetchData = async () =>
						await simulateAPICall(
							CallFareRuleRESTAPI.input,
							'FLIGHT', 
							'fareRule'
						).then(async (res) => {
							tavaLogger(
								corelationId, 
								'Response',
								`${CallFareRuleRESTAPI.secrets.TBO_BASE_URL}/FareRule?`,
								res,
								templateType
							)
							return res
						})
					fareRuleResponse = isCacheRequired
						? await fetchOrStoreDataInCache(
								fetchData,
								cacheKey,
								cacheExpireTime
						  )
						: await fetchData()
				} catch (error) {
					console.log(
						'Error occurred in :  `${CallFareRuleRESTAPI.secrets.TBO_BASE_URL}/FareRule?`',
						error
					)
					if (error.response) {
						const { status, data } = error?.response
						tavaLogger(
							corelationId,
							'Error',
							`${CallFareRuleRESTAPI.secrets.TBO_BASE_URL}/FareRule?`,
							error,
							templateType
						)
						throw res.status(status).json(data)
					}
					throw error
				}

				const fareRuleIsTrue = {
					input: fareRuleRequest,
					params: priceRequest,
					secrets: process.env,
					headers,
					output: fareRuleResponse,
				}
				let externalOutput_74ab8b11_7fe9_4e04_97b5_a1c6f22e7721
				if (fareRuleIsTrue.output.Response?.Error?.ErrorCode == 0) {
					const checkResponse = async () => {
						const inputData = {
							...fareRuleIsTrue,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers
						const internalOutput = inputData

						const CallFareQuoteRESTAPI = {
							input: internalOutput,
							params: priceRequest,
							secrets: process.env,
							headers,
						}

						let fareQuoteResponse
						try {
							const cacheKey = ''
							const cacheExpireTime = 0
							const isCacheRequired = false
							tavaLogger(
								corelationId,
								'Request',
								`${CallFareQuoteRESTAPI.secrets.TBO_BASE_URL}/FareQuote?`,
								CallFareQuoteRESTAPI.input.input,
								templateType
							)
							const fetchData = async () =>
								await simulateAPICall(
									CallFareQuoteRESTAPI.input.input,
									'FLIGHT',
									'fareQuote' 
								).then(async (res) => {
									tavaLogger(
										corelationId,
										'Response',
										`${CallFareRuleRESTAPI.secrets.TBO_BASE_URL}/FareQuote?`,
										res,
										templateType
									) 
									return res
								})
							fareQuoteResponse = isCacheRequired
								? await fetchOrStoreDataInCache(
										fetchData,
										cacheKey,
										cacheExpireTime
								  )
								: await fetchData()
						} catch (error) {
							console.log(
								'Error occurred in :  `${CallFareQuoteRESTAPI.secrets.TBO_BASE_URL}/FareQuote?`',
								error
							)
							if (error.response) {
								const { status, data } = error?.response
								tavaLogger(
									corelationId,
									'Error',
									`${CallFareQuoteRESTAPI.secrets.TBO_BASE_URL}/FareQuote?`,
									error,
									templateType
								)
								throw res.status(status).json(data)
							}
							throw error
						}
						const tboPriceResponse = {
							input: fareQuoteResponse,
							params: priceRequest,
							secrets: process.env,
							headers,
							internalOutput: internalOutput,
						}

						const priceResponseMapper = async function () {
							return {
								...tboPriceResponse.input,
								fareRuleResponse: tboPriceResponse.internalOutput.output,
								journeyId: tboPriceResponse?.params?.body?.journeyId,
							}
						}

						const finalPriceResponse = await priceResponseMapper()

						const Subflow = {
							input: finalPriceResponse,
							params: priceRequest,
							secrets: process.env,
							headers,
						}
						const created = await subflowcacheget(Subflow, res, next, '', url)
						const ReturnSuccessResponse = {
							tboResponse: finalPriceResponse,
							params: priceRequest,
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
					externalOutput_74ab8b11_7fe9_4e04_97b5_a1c6f22e7721 = resultCheck
					return res.send(resultCheck)
				}
				const fareRuleIsFalse = {
					input: fareRuleResponse,
					params: priceRequest,
					secrets: process.env,
					headers,
				}
				let externalOutput_9decc603_1157_4b73_b671_95786fbf6831
				if (fareRuleIsFalse.input.Response?.Error?.ErrorCode != 0) {
					const checkResponse = async () => {
						const inputData = {
							...fareRuleIsFalse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers
						const internalOutput = inputData

						const ReturnSuccessResponse = {
							fareRuleResponse: internalOutput.input.Response,
							params: priceRequest,
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
					externalOutput_9decc603_1157_4b73_b671_95786fbf6831 = resultCheck
					return res.send(resultCheck)
				}
			}
			const resultCheck = await checkResponse()
			tboPriceExternalOutput = resultCheck

			return resultCheck
		}
		const amadeusPriceRequest = {
			input: priceRequest,
			params: priceRequest,
			secrets: process.env,
			headers,
		}
		let amadeusExternalOutput
		if (amadeusPriceRequest.input.body.source === 'AMADEUS') {
			const checkResponse = async () => {
				const inputData = {
					...amadeusPriceRequest,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers
				const internalOutput = inputData

				const GetPriceRule = {
					input: internalOutput,
					params: priceRequest,
					secrets: process.env,
					headers,
				}
				const fareRules = await prisma.$queryRawUnsafe(
					`SELECT "enable","indicators" FROM "specialServiceRuleTable" WHERE "request" = 'InformativeBestPricingWithoutPNR'`
				)

				const CallAmadeusHeaderDataRESTAPIEndpoint = {
					input: fareRules,
					params: priceRequest,
					secrets: process.env,
					headers,
				}

				let headerDataResponse = await callHeaderData(
					corelationId,
					CallAmadeusHeaderDataRESTAPIEndpoint,
					templateType
				)

				const headerData = {
					output: fareRules,
					params: priceRequest,
					secrets: process.env,
					headers,
					output1: headerDataResponse,
					input: internalOutput,
				}

				const createPriceRequest = async function () {
					const data = headerData.input.input.body.price
					const rule = headerData.output[0] || 'RU,RP,VC'
					const credentials = headerData.output1
					const companyCodes = new Set()
					const indicators = rule.split(',').map((item) => item.trim())
					const getTravelerData = (flightData) => {
						const travelerDetails = flightData.travelerDetails
						const travelerTypes = {}
						for (let i = 0; i < travelerDetails.length; i++) {
							const traveler = travelerDetails[i]
							const travelerType = traveler.travelerType
							if (travelerTypes[travelerType]) {
								travelerTypes[travelerType]++
							} else {
								travelerTypes[travelerType] = 1
							}
						}
						const passengerTypes = {
							Adult: 'ADT',
							Child: 'CH',
							Infant: 'IN',
						}
						const formattedData = Object.keys(travelerTypes).map((key) => {
							return {
								passengerType: passengerTypes[key],
								quantity: travelerTypes[key],
							}
						})
						return formattedData
					}
					const createSoapEnvelope = (xmlWriter) => {
						xmlWriter
							.startElement('soap:Envelope')
							.writeAttribute(
								'xmlns:soap',
								'http://schemas.xmlsoap.org/soap/envelope/'
							)
						return xmlWriter
					}
					const createSoapHeader = (xmlWriter, credentials) => {
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
							.text(credentials.output.messageID)
							.endElement()
							.startElement('add:Action')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text('http://webservices.amadeus.com/TIPNRQ_21_1_1A')
							.endElement()
							.startElement('add:To')
							.writeAttribute(
								'xmlns:add',
								'http://www.w3.org/2005/08/addressing'
							)
							.text(headerData.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
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
							.text(credentials.output.base64Nonce)
							.endElement()
							.startElement('oas:Password')
							.writeAttribute(
								'Type',
								'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest'
							)
							.text(credentials.output.hashedPassword)
							.endElement()
							.startElement('oas1:Created')
							.text(credentials.output.created)
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
					const createTripsGroup = (itineraries, xmlWriter) => {
						let segmentCount = 1
						let flightCount = 1
						for (let i = 0; i < itineraries.length; i++) {
							const itinerary = itineraries[i]
							for (const segment of itinerary.segments) {
								const departure = moment(segment.departure.date)
								const arrival = moment(segment.arrival.date)
								const bookingClass = segment.bookingClass
								const flightNumber = segment.flightNumber
								const marketingCarrierCode = segment.carrierCode
								const operatingCarrierCode = segment.operatingCarrierCode
								companyCodes.add(segment?.company)
								xmlWriter.startElement('segmentGroup')
								xmlWriter.startElement('segmentInformation')
								xmlWriter.startElement('flightDate')
								xmlWriter.writeElement(
									'departureDate',
									departure.format('DDMMYY')
								)
								xmlWriter.writeElement(
									'departureTime',
									moment(segment.departure.time, 'HH:mm').format('Hmm')
								)
								xmlWriter.writeElement('arrivalDate', arrival.format('DDMMYY'))
								xmlWriter.writeElement(
									'arrivalTime',
									moment(segment.arrival.time, 'HH:mm').format('Hmm')
								)
								xmlWriter.endElement()
								xmlWriter.startElement('boardPointDetails')
								xmlWriter.writeElement(
									'trueLocationId',
									segment.departure.iataCode
								)
								xmlWriter.endElement()
								xmlWriter.startElement('offpointDetails')
								xmlWriter.writeElement(
									'trueLocationId',
									segment.arrival.iataCode
								)
								xmlWriter.endElement()
								xmlWriter.startElement('companyDetails')
								xmlWriter.writeElement('marketingCompany', marketingCarrierCode)
								xmlWriter.writeElement('operatingCompany', operatingCarrierCode)
								xmlWriter.endElement()
								xmlWriter.startElement('flightIdentification')
								xmlWriter.writeElement('flightNumber', flightNumber)
								xmlWriter.writeElement('bookingClass', bookingClass)
								xmlWriter.endElement()
								xmlWriter.startElement('flightTypeDetails')
								xmlWriter.writeElement('flightIndicator', flightCount)
								xmlWriter.endElement()
								xmlWriter.writeElement('itemNumber', segmentCount)
								segmentCount++
								xmlWriter.endElement()
								xmlWriter.endElement()
							}
							flightCount++
						}
						writePricingOptionGroup(xmlWriter, companyCodes)
						return xmlWriter
					}
					const writePricingOptionGroup = (xmlWriter, companyCodes) => {
						indicators.forEach((element) => {
							xmlWriter.startElement('pricingOptionGroup')
							xmlWriter.startElement('pricingOptionKey')
							xmlWriter.writeElement('pricingOptionKey', element)
							xmlWriter.endElement()
							if (element === 'VC') {
								xmlWriter.startElement('carrierInformation')
								xmlWriter.startElement('companyIdentification')
								companyCodes?.forEach((code) => {
									xmlWriter.writeElement('otherCompany', code)
								})
								xmlWriter.endElement()
								xmlWriter.endElement()
							}
							xmlWriter.endElement()
						})
					}
					const typeOfPax = (array) => {
						const typeSet = new Set()
						array.forEach((item) => {
							const { passengerType, quantity } = item
							if (quantity > 0) {
								typeSet.add(passengerType)
							}
						})
						return typeSet
					}
					const quantityMapper = (paxTypeSet) => {
						if (
							paxTypeSet.has('ADT') &&
							paxTypeSet.has('CH') &&
							paxTypeSet.has('IN')
						) {
							return {
								ADT: '1',
								CH: '2',
								IN: '3',
							}
						} else if (paxTypeSet.has('ADT') && paxTypeSet.has('CH')) {
							return {
								ADT: '1',
								CH: '2',
							}
						} else if (paxTypeSet.has('ADT') && paxTypeSet.has('IN')) {
							return {
								ADT: '1',
								IN: '2',
							}
						} else {
							return {
								ADT: '1',
							}
						}
					}
					const createPassengersGroup = (passengers, xmlWriter) => {
						let count = 1
						const paxTypeSet = typeOfPax(passengers)
						const quantityValues = quantityMapper(paxTypeSet)
						for (const pax of passengers) {
							const { passengerType, quantity } = pax
							const paxTypeVal = quantityValues[passengerType]
							xmlWriter.startElement('passengersGroup')
							xmlWriter.startElement('segmentRepetitionControl')
							xmlWriter.startElement('segmentControlDetails')
							xmlWriter.writeElement('quantity', paxTypeVal)
							xmlWriter.writeElement('numberOfUnits', quantity)
							xmlWriter.endElement()
							xmlWriter.endElement()
							xmlWriter.startElement('travellersID')
							for (let i = 1; i <= quantity; i++) {
								xmlWriter.startElement('travellerDetails')
								xmlWriter.writeElement('measurementValue', count)
								xmlWriter.endElement()
								count++
							}
							xmlWriter.endElement()
							xmlWriter.startElement('discountPtc')
							xmlWriter.writeElement('valueQualifier', passengerType)
							xmlWriter.endElement()
							xmlWriter.endElement()
						}
						return xmlWriter
					}
					const createSoapBody = (requestData, xmlWriter) => {
						xmlWriter.startElement('soap:Body')
						xmlWriter.startElement('Fare_InformativePricingWithoutPNR')
						createPassengersGroup(getTravelerData(requestData), xmlWriter)
						createTripsGroup(requestData.itineraries, xmlWriter)
						xmlWriter.endElement()
						xmlWriter.endElement()
					}
					const request = (requestData, credentials) => {
						const xmlWriter = new XMLWriter({ indent: '  ' })
						createSoapEnvelope(xmlWriter)
						createSoapHeader(xmlWriter, credentials)
						createSoapBody(requestData, xmlWriter)
						xmlWriter.endElement()
						return xmlWriter.toString()
					}
					return request(data, credentials)
				}
				const amadeusPriceAPIRequest = await createPriceRequest()

				const CallPriceSOAPAPI = {
					input: amadeusPriceAPIRequest,
					params: priceRequest,
					secrets: process.env,
					headers,
				}

				let amadeusPriceResponse = await callIBPricingAPI(
					corelationId,
					CallPriceSOAPAPI,
					templateType,
					url,
					res
				)

				const priceSuccessResponse = {
					input: amadeusPriceResponse,
					params: priceRequest,
					secrets: process.env,
					headers,
				}
				let priceSuccessExternalOutput
				if (
					!(
						priceSuccessResponse.input['soap:Envelope']['soap:Body'][
							'soap:Fault'
						]?.faultcode?._text ||
						(priceSuccessResponse.input['soap:Envelope']['soap:Body']
							.Fare_InformativePricingWithoutPNRReply?.errorGroup &&
							priceSuccessResponse.input['soap:Envelope']['soap:Body']
								.Fare_InformativePricingWithoutPNRReply?.errorGroup
								?.errorOrWarningCodeDetails?.errorDetails?.errorCategory
								._text === 'EC')
					)
				) {
					const checkResponse = async () => {
						const inputData = {
							...priceSuccessResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers
						const internalOutput = inputData
						const GetMiniRules = {
							input: internalOutput,
							params: priceRequest,
							secrets: process.env,
							headers,
						}
						const miniRules = await prisma.$queryRawUnsafe(
							`SELECT "indicators" FROM "specialServiceRuleTable" WHERE "request" = 'MiniRule_GetFromRec'`
						)
						const MiniRulesData = {
							input: miniRules,
							params: priceRequest,
							secrets: process.env,
							headers,
							internalOutput: internalOutput,
						}

						const createMiniRuleRequest = async function () {
							const sessionData =
								MiniRulesData.internalOutput.input['soap:Envelope'][
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
									.text('http://webservices.amadeus.com/TMRXRQ_23_1_1A')
									.endElement()
									.startElement('add:To')
									.writeAttribute(
										'xmlns:add',
										'http://www.w3.org/2005/08/addressing'
									)
									.text(
										MiniRulesData.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO'
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
								xmlWriter.startElement('soap:Body')
								xmlWriter.startElement('MiniRule_GetFromRec')
								xmlWriter.startElement('groupRecords')
								xmlWriter.startElement('recordID')
								xmlWriter.writeElement('referenceType', 'FRN')
								xmlWriter.writeElement('uniqueReference', 'ALL')
								xmlWriter.endElement()
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

							return request()
						}
						const miniRuleRequest = await createMiniRuleRequest()
						const CallMiniRuleSOAPAPI = {
							input: miniRuleRequest,
							params: priceRequest,
							secrets: process.env,
							headers,
						}

						let miniRuleAPIResponse = await callMiniRuleAPI(
							corelationId,
							CallMiniRuleSOAPAPI,
							templateType,
							url,
							res
						)

						const miniRulesResponse = {
							input:
								miniRuleAPIResponse['soap:Envelope']['soap:Body']
									?.MiniRule_GetFromRecReply,
							params: priceRequest,
							secrets: process.env,
							headers,
							internalOutput: internalOutput,
						}

						const miniRuleMapper = async function () {
							const miniRules = miniRulesResponse.input
							const informativePricing = miniRulesResponse.internalOutput

							return {
								miniRules: miniRules,
								informativePricing: informativePricing,
								journeyId: miniRulesResponse?.params?.body?.journeyId,
							}
						}
						const finalMiniRuleResponse = await miniRuleMapper()
						const CacheGetSubflow = {
							input: finalMiniRuleResponse,
							params: priceRequest,
							secrets: process.env,
							headers,
						}
						const created = await subflowcacheget(
							CacheGetSubflow,
							res,
							next,
							'',
							url
						)
						const ReturnSuccessResponse = {
							output: finalMiniRuleResponse,
							params: priceRequest,
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
					priceSuccessExternalOutput = resultCheck
					return res.send(resultCheck)
				}
				const priceErrorResponse = {
					input: amadeusPriceResponse,
					params: priceRequest,
					secrets: process.env,
					headers,
				}
				let priceErrorExternalOutput
				if (
					priceErrorResponse.input['soap:Envelope']['soap:Body']['soap:Fault']
						?.faultcode?._text ||
					(priceErrorResponse.input['soap:Envelope']['soap:Body']
						.Fare_InformativePricingWithoutPNRReply?.errorGroup &&
						priceErrorResponse.input['soap:Envelope']['soap:Body']
							.Fare_InformativePricingWithoutPNRReply?.errorGroup
							?.errorOrWarningCodeDetails?.errorDetails?.errorCategory._text ===
							'EC')
				) {
					const checkResponse = async () => {
						const inputData = {
							...priceErrorResponse,
						}
						delete inputData.params
						delete inputData.secrets
						delete inputData.headers
						const internalOutput = inputData
						const CallSignoutAPIEndpoint = {
							input: internalOutput,
							params: priceRequest,
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
							informativePricing: internalOutput,
							params: priceRequest,
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
					priceErrorExternalOutput = resultCheck
					return res.send(resultCheck)
				}
			}
			const resultCheck = await checkResponse()
			amadeusExternalOutput = resultCheck

			return resultCheck
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
	price,
}
