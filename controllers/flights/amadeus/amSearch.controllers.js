const { subflowcacheget } = require('../../../helpers/service.js')
const { tavaLogger } = require('../../../helpers/index.js')
const XMLWriter = require('xml-writer')
const moment = require('moment')
const {
	callHeaderData,
} = require('../../../services/amadeus/callHeaderData.js')
const { callMPTBSearchAPI } = require('../../../services/amadeus/searchMPTB.js')

const amadeusSearchSplit = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const searchRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const CallAmadeusHeaderDataRESTAPIEndpoint = {
			input: searchRequest.body,
			params: searchRequest,
			secrets: process.env,
			headers,
		}

		let headerResponse = await callHeaderData(
			corelationId,
			CallAmadeusHeaderDataRESTAPIEndpoint,
			templateType
		)

		const headerData = {
			params: searchRequest,
			secrets: process.env,
			headers,
			output: headerResponse,
		}

		const createSearchRequest = async function () {
			const requestData = headerData.params.body
			const credentials = headerData.output
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
				return xmlWriter
					.startElement('soap:Header')
					.writeAttribute(
						'xmlns:soap',
						'http://schemas.xmlsoap.org/soap/envelope/'
					)
					.startElement('add:MessageID')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(credentials.messageID)
					.endElement()
					.startElement('add:Action')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text('http://webservices.amadeus.com/FMPTBQ_23_2_1A')
					.endElement()
					.startElement('add:To')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(headerData.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
					.endElement()
					.startElement('link:TransactionFlowLink')
					.writeAttribute(
						'xmlns:link',
						'http://wsdl.amadeus.com/2010/06/ws/Link_v1'
					)
					.startElement('link:Consumer')
					.startElement('link:UniqueID')
					.text(credentials.uniqueID)
					.endElement()
					.endElement()
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
					.text(credentials.base64Nonce)
					.endElement()
					.startElement('oas:Password')
					.writeAttribute(
						'Type',
						'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest'
					)
					.text(credentials.hashedPassword)
					.endElement()
					.startElement('oas1:Created')
					.text(credentials.created)
					.endElement()
					.endElement()
					.endElement()
					.startElement('AMA_SecurityHostedUser')
					.writeAttribute('xmlns', 'http://xml.amadeus.com/2010/06/Security_v1')
					.startElement('UserID')
					.writeAttribute('POS_Type', '1')
					.writeAttribute('PseudoCityCode', 'DELVS38SM')
					.writeAttribute('AgentDutyCode', 'SU')
					.writeAttribute('RequestorType', 'U')
					.endElement()
					.endElement()
					.endElement()
			}
			const createSoapBody = (xmlWriter, requestData) => {
				const passengers = requestData.passengersCount
				let segref = 1
				const totalpassengers = Object.entries(passengers).reduce(
					(acc, [key, value]) => {
						if (key !== 'infants') {
							return acc + Number(value)
						}
						return acc
					},
					0
				)
				const passengersTypes = {
					adult: {
						ptc: 'ADT',
					},
					children: {
						ptc: 'CH',
					},
					infants: {
						ptc: 'INF',
						infantIndicator: 1,
					},
				}
				xmlWriter.startElement('soap:Body')
				xmlWriter.startElement('Fare_MasterPricerTravelBoardSearch')
				createNumberOfUnits(xmlWriter, totalpassengers, requestData)
				createPaxReference(xmlWriter, passengersTypes, passengers)
				createFareOptions(xmlWriter, requestData)
				createTravelInfo(xmlWriter)

				requestData.journeys.forEach((itinerary) => {
					let originCode = itinerary.originCode
					let destinationcode = itinerary.destCode
					let departDate = itinerary.departureDate
					if (requestData.tripType === 'roundTrip') {
						let retrunDate = itinerary.returnDate
						createItineraries(
							xmlWriter,
							originCode,
							destinationcode,
							departDate,
							segref
						)
						segref++
						createItineraries(
							xmlWriter,
							destinationcode,
							originCode,
							retrunDate,
							segref
						)
					} else {
						createItineraries(
							xmlWriter,
							originCode,
							destinationcode,
							departDate,
							segref
						)
						segref++
					}
				})
				xmlWriter.endElement()
				xmlWriter.endElement()
				return xmlWriter.toString()
			}
			const createNumberOfUnits = (xmlWriter, totalPassengers, requestData) => {
				xmlWriter
					.startElement('numberOfUnit')
					.startElement('unitNumberDetail')
					.writeElement('numberOfUnits', '100')
					.writeElement('typeOfUnit', 'RC')
					.endElement()
					.startElement('unitNumberDetail')
					.writeElement('numberOfUnits', totalPassengers)
					.writeElement('typeOfUnit', 'PX')
					.endElement()

				if (
					requestData.tripType === 'roundTrip' &&
					requestData.travelType === 'domestic'
				) {
					xmlWriter
						.startElement('unitNumberDetail')
						.writeElement('numberOfUnits', '20')
						.writeElement('typeOfUnit', 'OWO')
						.endElement()
						.startElement('unitNumberDetail')
						.writeElement('numberOfUnits', '50')
						.writeElement('typeOfUnit', 'OWI')
						.endElement()
						.startElement('unitNumberDetail')
						.writeElement('numberOfUnits', '0')
						.writeElement('typeOfUnit', 'RT')
						.endElement()
				}

				xmlWriter.endElement()
			}

			const createPaxReference = (xmlWriter, passengersTypes, passengers) => {
				for (const [passengerType, passengerData] of Object.entries(
					passengersTypes
				)) {
					if (passengers[passengerType] > 0) {
						xmlWriter
							.startElement('paxReference')
							.startElement('ptc')
							.text(passengerData.ptc)
							.endElement()
						for (let i = 1; i <= passengers[passengerType]; i++) {
							let ref = 1
							if (passengerData.ptc == 'CH') {
								ref = i + passengers.adult
							} else {
								ref = i
							}
							xmlWriter
								.startElement('traveller')
								.startElement('ref')
								.text(ref.toString())
								.endElement()

							if (passengerData.infantIndicator) {
								xmlWriter
									.startElement('infantIndicator')
									.text(passengerData.infantIndicator.toString())
									.endElement()
							}
							xmlWriter.endElement()
						}
						xmlWriter.endElement()
					}
				}
				return xmlWriter
			}

			const createTravelInfo = (xmlWriter) => {
				xmlWriter.startElement('travelFlightInfo')

				let cabinCode = 'M'
				if (requestData.travelClass === 'PREMIUM_ECONOMY') {
					cabinCode = 'W'
				} else if (requestData.travelClass === 'BUSINESS') {
					cabinCode = 'C'
				} else if (requestData.travelClass === 'FIRST') {
					cabinCode = 'F'
				}
				xmlWriter.startElement('cabinId')
				xmlWriter.writeElement('cabin', cabinCode)
				xmlWriter.endElement()

				if (requestData?.isDirectFlight || requestData?.isOneStopFlight) {
					xmlWriter.startElement('flightDetail')
					if (requestData?.isDirectFlight) {
						xmlWriter.writeElement('flightType', 'N')
					} else if (requestData?.isOneStopFlight) {
						xmlWriter.writeElement('flightType', 'D')
						xmlWriter.writeElement('flightType', 'C')
					}

					xmlWriter.endElement()
				}

				xmlWriter.endElement()
				return xmlWriter
			}

			const createFareOptions = (xmlWriter, requestData) => {
				xmlWriter.startElement('fareOptions')

				xmlWriter.startElement('pricingTickInfo')
				xmlWriter.startElement('pricingTicketing')

				if (
					requestData.tripType === 'roundTrip' &&
					requestData.travelType === 'domestic'
				) {
					xmlWriter.writeElement('priceType', 'MTK')
				}
				xmlWriter.writeElement('priceType', 'MNR')

				xmlWriter.endElement()
				xmlWriter.endElement()

				xmlWriter.endElement()
			}

			const createItineraries = (
				xmlWriter,
				originCode,
				destinationcode,
				departDate,
				segref
			) => {
				const departure = moment(departDate)
				xmlWriter.startElement('itinerary')
				xmlWriter.startElement('requestedSegmentRef')
				xmlWriter.startElement('segRef').text(segref).endElement()
				xmlWriter.endElement()
				xmlWriter.startElement('departureLocalization')
				xmlWriter.startElement('departurePoint')
				xmlWriter.startElement('locationId').text(originCode).endElement()
				xmlWriter.endElement()
				xmlWriter.endElement()
				xmlWriter.startElement('arrivalLocalization')
				xmlWriter.startElement('arrivalPointDetails')
				xmlWriter.startElement('locationId').text(destinationcode).endElement()
				xmlWriter.endElement()
				xmlWriter.endElement()
				xmlWriter.startElement('timeDetails')
				xmlWriter.startElement('firstDateTimeDetail')
				xmlWriter
					.startElement('date')
					.text(departure.format('DDMMYY'))
					.endElement()
				xmlWriter.endElement()
				xmlWriter.endElement()
				xmlWriter.endElement()

				return xmlWriter
			}

			const request = () => {
				const xmlWriter = new XMLWriter({
					indent: '  ',
				})

				createSoapEnvelope(xmlWriter)
				createSoapHeader(xmlWriter, credentials.output)
				createSoapBody(xmlWriter, requestData)
				xmlWriter.endElement()
				return xmlWriter.toString()
			}
			return request()
		}
		const amadeusSearchRequest = await createSearchRequest()
		const CallSearchSOAPAPI = {
			input: amadeusSearchRequest,
			params: searchRequest,
			secrets: process.env,
			headers,
		}

		let searchResponse = await callMPTBSearchAPI(
			corelationId,
			CallSearchSOAPAPI,
			templateType,
			url,
			res
		)

		const amadeusSearchResponse = {
			input: searchResponse,
			params: searchRequest,
			secrets: process.env,
			headers,
		}

		const searchResponseMapper = async function () {
			let masterPricerTravelBoardSearchReply
			if (
				amadeusSearchResponse.input['soap:Envelope']['soap:Body']['soap:Fault']
			) {
				masterPricerTravelBoardSearchReply =
					amadeusSearchResponse.input['soap:Envelope']['soap:Body'][
						'soap:Fault'
					]
			} else {
				masterPricerTravelBoardSearchReply =
					amadeusSearchResponse.input['soap:Envelope']['soap:Body'][
						'Fare_MasterPricerTravelBoardSearchReply'
					]
			}
			const tripType = amadeusSearchResponse.params.body.tripType
			const flights = (masterPricerTravelBoardSearchReply) => {
				let result = []
				let outBoundResult = []
				let inBoundResult = []
				if (masterPricerTravelBoardSearchReply?.flightIndex) {
					if (!Array.isArray(masterPricerTravelBoardSearchReply?.flightIndex)) {
						result.push(masterPricerTravelBoardSearchReply?.flightIndex)
					} else {
						if (tripType === 'roundTrip') {
							outBoundResult.push(
								masterPricerTravelBoardSearchReply?.flightIndex[0]
							)
							inBoundResult.push(
								masterPricerTravelBoardSearchReply?.flightIndex[1]
							)
						} else
							masterPricerTravelBoardSearchReply.flightIndex.forEach(
								(flight) => {
									outBoundResult.push(flight)
								}
							)
					}
					result.push(outBoundResult)
					if (inBoundResult.length !== 0) result.push(inBoundResult)
				}
				return result
			}

			const mapAmadeusResBody = (masterPricerTravelBoardSearchReply) => {
				let output
				if (masterPricerTravelBoardSearchReply?.faultcode) {
					output = {
						source: 'AMADEUS',
						result: [],
						fault: masterPricerTravelBoardSearchReply,
					}
				} else {
					output = {
						source: 'AMADEUS',
						result: [],
						recommendation: masterPricerTravelBoardSearchReply?.recommendation,
						replyStatus: masterPricerTravelBoardSearchReply?.replyStatus,
						errorMessage: masterPricerTravelBoardSearchReply?.errorMessage,
						serviceFeesGrp: [],
						familyInformation: [],
						warningInfo: masterPricerTravelBoardSearchReply?.warningInfo,
					}
					output.result = flights(masterPricerTravelBoardSearchReply)
					if (masterPricerTravelBoardSearchReply?.serviceFeesGrp) {
						output.serviceFeesGrp.push(
							masterPricerTravelBoardSearchReply?.serviceFeesGrp
						)
					}
					if (masterPricerTravelBoardSearchReply?.familyInformation) {
						output.familyInformation.push(
							masterPricerTravelBoardSearchReply?.familyInformation
						)
					}
				}
				return output
			}
			return mapAmadeusResBody(masterPricerTravelBoardSearchReply)
		}
		const finalSearchResponse = await searchResponseMapper()

		const CacheGetSubflow = {
			input: finalSearchResponse,
			params: searchRequest,
			secrets: process.env,
			headers,
		}
		const created = await subflowcacheget(CacheGetSubflow, res, next, '', url)
		const ReturnSuccessResponse = {
			output: finalSearchResponse,
			params: searchRequest,
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
	amadeusSearchSplit,
}
