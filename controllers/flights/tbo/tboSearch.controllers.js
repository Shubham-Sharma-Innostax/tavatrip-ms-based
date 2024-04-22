const { subflowcacheget } = require('../../../helpers/service.js')
const { tavaLogger } = require('../../../helpers/index.js')
const moment = require('moment')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../../services/tbo/authentication.js')
const { callSearch } = require('../../../services/tbo/flightAPIHandler.js')

let isProcessing = false // Flag to track whether API is currently processing a request
const requestQueue = [] // Queue to store incoming requests
const tbosearch = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, headers } = req
	let corelationId = headers['x-request-id']
	try {
		const request = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const AuthRequest = {
			input: body,
			params: req,
			secrets: process.env,
			headers,
		}
		const tboAuthRequest = await createAuthRequest(
			AuthRequest.secrets,
			AuthRequest.input
		)

		const CallAuthRESTAPIEndpoint = {
			input: tboAuthRequest,
			params: request,
			secrets: process.env,
			headers,
		}

		let authResponse = await callAuthRESTAPI(
			corelationId,
			CallAuthRESTAPIEndpoint,
			templateType
		)

		const searchRequest = {
			auth: authResponse,
			params: request,
			secrets: process.env,
			headers,
			input: request.body,
		}

		const createSearchRequest = async function () {
			const getSegments = (input) => {
				const flightCabinClass = {
					ECONOMY: 2,
					PREMIUM_ECONOMY: 3,
					BUSINESS: 4,
					PREMIUM_BUSINESS: 5,
					FIRST: 6,
				}[input.travelClass]
				if (input.tripType == 'roundTrip') {
					const outboundSegment = {
						Origin: input.journeys[0].originCode,
						Destination: input.journeys[0].destCode,
						PreferredDepartureTime: input.journeys[0].departureDate,
						FlightCabinClass: flightCabinClass,
					}

					const returnSegment = {
						Origin: input.journeys[0].destCode,
						Destination: input.journeys[0].originCode,
						PreferredDepartureTime: input.journeys[0].returnDate,
						FlightCabinClass: flightCabinClass,
					}

					return [outboundSegment, returnSegment]
				} else {
					return input.journeys.map((each) => {
						return {
							Origin: each.originCode,
							Destination: each.destCode,
							FlightCabinClass: {
								ECONOMY: 2,
								PREMIUM_ECONOMY: 3,
								BUSINESS: 4,
								PREMIUM_BUSINESS: 5,
								FIRST: 6,
							}[input.travelClass],
							PreferredDepartureTime: moment(
								`${each.departureDate} ${each.departureTime}`,
								'YYYYMMDD HHmm'
							).format('yyyy-MM-DDTHH:mm:ss'),
						}
					})
				}
			}
			const getFareType = (fareType) =>
				({
					Student: 3,
					ArmedForce: 4,
					SeniorCitizen: 5,
				}[fareType] || 2)
			const requestMapper = (input, auth) => {
				return {
					EndUserIp: input.endUserIp,
					TokenId: auth.TokenId, 
					AdultCount: input.passengersCount.adult,
					ChildCount: input.passengersCount.children,
					InfantCount: input.passengersCount.infants,
					DirectFlight: input?.isDirectFlight || 'false',
					OneStopFlight: input?.isOneStopFlight || 'false',
					JourneyType: {
						oneWay: 1,
						roundTrip: 2,
						multiCity: 3,
					}[input.tripType],
					PreferredAirlines: null,
					Segments: getSegments(input),
					Sources: null,
					ResultFareType: getFareType(input?.fareType),
				}
			}
			return requestMapper(searchRequest.input, searchRequest.auth)
		}
		const tboSearchRequest = await createSearchRequest()

		const CallSearchRESTAPIEndpoint = {
			input: tboSearchRequest,
			params: request,
			secrets: process.env,
			headers,
		}

		const searchResponse = await callSearch(
			corelationId,
			tboSearchRequest,
			templateType
		)
		const searchResponseMapper = async function () {
			const sessionId = body.sessionId
			const mapResponsebody = (input) => {
				return {
					source: 'TBO',
					traceId: input.Response.TraceId,
					error: input.Response.Error,
					destination: input.Response.Destination,
					origin: input.Response.Origin,
					result: input.Response.Results,
					sessionId: sessionId,
				}
			}

			return mapResponsebody(searchResponse)
		}
		const flightResult = await searchResponseMapper()

		const Subflow = {
			input: flightResult,
			params: request,
			secrets: process.env,
			headers,
		}
		const created = await subflowcacheget(Subflow, res, next, '', url)
		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: { output: flightResult } },
			templateType
		)
		return res.json({ output: flightResult })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}
module.exports = {
	tbosearch,
}
