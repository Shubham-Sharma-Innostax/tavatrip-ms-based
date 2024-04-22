const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../../services/tbo/authentication')
const { tavaLogger } = require('../../../helpers')
const {
	callGetCancellationCharges,
} = require('../../../services/tbo/flightAPIHandler')

const cancellationcharges = async (req, res, next) => {
	const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		const templateType = 'travel' 
	try { 
		tavaLogger(corelationId, 'Request', url, req, templateType)

		// Authenticate
		const authRequest = { input: body, secrets: process.env, headers }
		const tboAuthRequest = await createAuthRequest(
			authRequest.secrets,
			authRequest.input
		)
		const CallAuthRESTAPIEndpoint = {
			input: tboAuthRequest,
			secrets: process.env,
			headers,
		}
		const authResponse = await callAuthRESTAPI(
			corelationId,
			CallAuthRESTAPIEndpoint,
			templateType
		)
		const { TokenId } = authResponse

		const getFlightBookings = await prisma.booking.findMany({
			where: { pnr: body.pnr },
		})

		if (Object.keys(getFlightBookings).length === 0) {
			res.error().json({ error: 'Booking Not Found' })
		}

		if (getFlightBookings[0].provider === 'TBO') {
			const getCancellationChargesRequest = {
				BookingId: getFlightBookings[0]?.providerBookingId,
				RequestType: body.requestType || 2,
				Remarks: body.remarks,
				EndUserIp: body.endUserIp,
				TokenId,
			}
			const getCancellationCharges = await callGetCancellationCharges(
				corelationId,
				getCancellationChargesRequest,
				templateType
			)
			const { id, pnr, bookingId } = getFlightBookings[0]
			const response = {
				id,
				source: 'TBO',
				bookingId,
				pnr,
				response: getCancellationCharges,
			}
			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: getCancellationCharges,
				},
				templateType
			)
			res.send({ charges: response  })
		} else if (['AM', 'AMADEUS'].includes(getFlightBookings.provider)) {
			const mapAMrequest = (getFlightBookings) => {
				const { pnr, tavaBookingId, ticketingJSON, id } = getFlightBookings
				const rawTicketNumbers = JSON.parse(
					ticketingJSON
				).ticketJSON.ticketsnumber.map((ticket) => ticket.number)
				const ticketNumbers = rawTicketNumbers.map((ele) => {
					return ele.replaceAll('-', '')
				})
				return {
					ticketJson: {
						ticketNumbers,
						status: 'CONFIRMED',
						marketIataCode: 'IN',
					},
					pnr,
					tavaBookingId,
					id,
				}
			}

			let initRefundResponse
			try {
				const amadeusInitRefundRequest = mapAMrequest(getFlightBookings.input)
				tavaLogger(
					corelationId,
					'Request',
					`${process.env.BACKEND_DEPLOYED_INSTANCE_URL}/initRefund?`,
					amadeusInitRefundRequest,
					templateType
				)

				initRefundResponse = await axios
					.post(
						`${process.env.BACKEND_DEPLOYED_INSTANCE_URL}/initRefund?`,
						amadeusInitRefundRequest,
						{ headers: {} }
					)
					.then(async (res) => {
						tavaLogger(
							corelationId,
							'Response',
							`${process.env.BACKEND_DEPLOYED_INSTANCE_URL}/initRefund?`,
							res,
							templateType
						)
						return res.data
					})
			} catch (error) {
				console.log(
					'Error occurred in :  `${process.env.BACKEND_DEPLOYED_INSTANCE_URL}/initRefund?`',
					error
				)
				if (error.response) {
					const { status, data } = error?.response
					tavaLogger(
						corelationId,
						'Error',
						`${process.env.BACKEND_DEPLOYED_INSTANCE_URL}/initRefund?`,
						error,
						templateType
					)
					throw res.status(status).json(data)
				}
				throw error
			}

			const response = {
				id,
				source: 'AM',
				pnr,
				response: initRefundResponse,
			}

			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: updatedReturnSuccessRes_1c80fb91_87d3_411e_9565_8083f25464ca,
				},
				templateType
			)
			res.send(200).json({ output: { charges: response } })
		} else {
			const error = new Error()
			error.statusCode = '404'
			error.message = 'Unable to get details for selected PNR'
			return res.send(error)
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}
module.exports = {
	cancellationcharges,
}
