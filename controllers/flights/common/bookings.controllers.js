const { tavaLogger } = require('../../../helpers')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const { idpAuthentication } = require('../../../services/tbo/idpAuthentication')

const getallbookings = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, query, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const authentication = await idpAuthentication(req, 'authorize')

		if (authentication.response.error) throw authentication.response.error

		const getUser = await prisma.users.findUnique({
			where: {
				id: authentication.response.decodedUserInfo.id,
			},
		})

		const size = parseInt(req?.query?.pageSize) || 10
		const page = parseInt(req?.query?.page) || 1
		const skip = (page - 1) * size

		if (getUser?.role === 'ADMIN' || getUser?.role === 'SUPER_ADMIN') {
			const getBookingAndTicketingStatusCount = async () => {
				const bookingStatusesList = [
					'AWAITINGPAYMENT',
					'CONFIRMED',
					'CANCELED',
					'FAILED',
				]
				const ticketingStatusesList = ['CONFIRMED', 'FAILED', 'CANCELED']

				let bookingStatusCount = {}
				let ticketingStatusCount = {}

				for (const status of bookingStatusesList) {
					const count = await prisma.booking.count({
						where: {
							status: status,
						},
					})
					bookingStatusCount[`${status}`] = count
				}

				bookingStatusCount['UNSUCCESSFUL'] = await prisma.booking.count({
					where: {
						NOT: [{ status: 'CONFIRMED' }, { status: 'CANCELED' }],
					},
				})

				for (const status of ticketingStatusesList) {
					const count = await prisma.booking.count({
						where: {
							ticketingStatus: status,
						},
					})
					ticketingStatusCount[`${status}`] = count
				}
				ticketingStatusCount['UNSUCCESSFUL'] = await prisma.booking.count({
					where: {
						NOT: [
							{ ticketingStatus: 'CONFIRMED' },
							{ ticketingStatus: 'CANCELED' },
						],
					},
				})

				return { ticketingStatusCount, bookingStatusCount }
			}
			let counts = await getBookingAndTicketingStatusCount()

			if (query.q) {
				const result = await prisma.booking.findMany({
					where: {
						OR: [
							{ tavaBookingId: { contains: query.q, mode: 'insensitive' } },
							{ providerBookingId: { contains: query.q, mode: 'insensitive' } },
							{ pnr: { contains: query.q, mode: 'insensitive' } },
							{ status: { contains: query.q, mode: 'insensitive' } },
							{ provider: { contains: query.q, mode: 'insensitive' } },
							{ userEmail: { contains: query.q, mode: 'insensitive' } },
							{ paymentSessionId: { contains: query.q, mode: 'insensitive' } },
							{ paymentStatus: { contains: query.q, mode: 'insensitive' } },
							{ paymentId: { contains: query.q, mode: 'insensitive' } },
							{ orderType: { contains: query.q, mode: 'insensitive' } },
							{ ticketingStatus: { contains: query.q, mode: 'insensitive' } },
							{ cancelationStatus: { contains: query.q, mode: 'insensitive' } },
							{ corelationId: { contains: query.q, mode: 'insensitive' } },
							{ travelerEmail: { contains: query.q, mode: 'insensitive' } },
						],
					},
					take: size,
					skip: skip,
				})

				const rowsCount = await prisma.booking.count({
					where: {
						OR: [
							{ tavaBookingId: { contains: query.q, mode: 'insensitive' } },
							{ providerBookingId: { contains: query.q, mode: 'insensitive' } },
							{ pnr: { contains: query.q, mode: 'insensitive' } },
							{ status: { contains: query.q, mode: 'insensitive' } },
							{ provider: { contains: query.q, mode: 'insensitive' } },
							{ userEmail: { contains: query.q, mode: 'insensitive' } },
							{ paymentSessionId: { contains: query.q, mode: 'insensitive' } },
							{ paymentStatus: { contains: query.q, mode: 'insensitive' } },
							{ paymentId: { contains: query.q, mode: 'insensitive' } },
							{ orderType: { contains: query.q, mode: 'insensitive' } },
							{ ticketingStatus: { contains: query.q, mode: 'insensitive' } },
							{ cancelationStatus: { contains: query.q, mode: 'insensitive' } },
							{ corelationId: { contains: query.q, mode: 'insensitive' } },
							{ travelerEmail: { contains: query.q, mode: 'insensitive' } },
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
			} else {
				const whereConditions = {}

				// Iterate over the query parameters and add conditions only for non-empty parameters
				Object.entries(req.query).forEach(([key, value]) => {
					if (value) {
						whereConditions[key] = { contains: value, mode: 'insensitive' }
					}
				})

				delete whereConditions.page
				delete whereConditions.pageSize
				delete whereConditions.bookingStatus

				const getMultiRecordsAndCount = await prisma.booking.findMany({
					where: {
						AND: [whereConditions],
					},
					take: size,
					skip: skip,
				})

				let rowsCount = await prisma.Booking.count({
					where: {
						AND: [whereConditions],
					},
				})
				const { result, countInfo } = {
					countInfo: {
						count: rowsCount,
						totalPage: Math.ceil(rowsCount / size),
						currentPage: page,
						size: size,
					},
					result: getMultiRecordsAndCount,
				}
				const response = {
					result,
					countInfo,
					...counts,
				}

				tavaLogger(
					corelationId,
					'Response',
					url,
					{ status: 200, data: { output: response } },
					templateType
				)
				return res.status(200).json({ output: response })
			}
		} else if (getUser?.role === 'GUEST' || getUser?.role === 'USER') {
			let counts
			const validateBookingCountByStatus = async (getUser) => {
				const userEmail = getUser.email
				const bookingStatusesList = [
					'AWAITINGPAYMENT',
					'CONFIRMED',
					'CANCELED',
					'FAILED',
					'NA',
				]
				const ticketingStatusesList = ['CONFIRMED', 'FAILED', 'CANCELED']
				let bookingStatusCount = {}
				let ticketingStatusCount = {}
				for (const status of bookingStatusesList) {
					const count = await prisma.booking.count({
						where: {
							userEmail: authentication.response.decodedUserInfo.email,
							AND: [
								{ status: status },
								{
									userEmail,
								},
							],
						},
					})
					bookingStatusCount[`${status}`] = count
				}
				bookingStatusCount['UNSUCCESSFUL'] = await prisma.booking.count({
					where: {
						userEmail: authentication.response.decodedUserInfo.email,
						NOT: [{ status: 'CONFIRMED' }, { status: 'CANCELED' }],
					},
				})

				for (const status of ticketingStatusesList) {
					const count = await prisma.Booking.count({
						where: {
							userEmail: authentication.response.decodedUserInfo.email,
							AND: [
								{ ticketingStatus: status },
								{
									userEmail,
								},
							],
						},
					})
					ticketingStatusCount[`${status}`] = count
				}
				ticketingStatusCount['UNSUCCESSFUL'] = await prisma.booking.count({
					where: {
						userEmail: authentication.response.decodedUserInfo.email,
						NOT: [
							{ ticketingStatus: 'CONFIRMED' },
							{ ticketingStatus: 'CANCELED' },
						],
					},
				})
				return { ticketingStatusCount, bookingStatusCount }
			}

			counts = await validateBookingCountByStatus(getUser)

			if (!query.q) {
				const { status, bookingStatus, secStatus, terStatus } = req.query
				const statusParams = [status, bookingStatus, secStatus, terStatus]

				const statusValues = []

				for (const param of statusParams) {
					if (param) statusValues.push(param)
				}

				// Construct the where object for the Prisma query
				let where = {
					userEmail: authentication.response.decodedUserInfo.email,
					status: {
						in: statusValues,
					},
				}

				let currentDate = new Date().toISOString()

				if (status === 'UPCOMING' || status === 'CONFIRMED') {
					where = {
						userEmail: authentication.response.decodedUserInfo.email,
						status: {
							in: ['CONFIRMED'],
						},
						departureDateTime: {
							[status === 'UPCOMING' ? 'gt' : 'lt']: currentDate,
						},
					}
				}

				const getAllBookings = await prisma.booking.findMany({
					where,
					take: size,
					skip: skip,
				})

				let rowsCount = await prisma.booking.count({
					where,
				})
				const { result, countInfo } = {
					countInfo: {
						count: rowsCount,
						totalPage: Math.ceil(rowsCount / size),
						currentPage: page,
						size: size,
					},
					result: getAllBookings,
				}
				const response = { result, countInfo, ...counts }

				tavaLogger(
					corelationId,
					'Response',
					url,
					{ status: 200, data: { output: response } },
					templateType
				)
				return res.status(200).json({ output: response })
			} else {
				const getBookingByUser = await prisma.booking.findMany({
					where: {
						userEmail: authentication.response.decodedUserInfo.email,
						OR: [
							{ tavaBookingId: { contains: query.q, mode: 'insensitive' } },
							{ providerBookingId: { contains: query.q, mode: 'insensitive' } },
							{ pnr: { contains: query.q, mode: 'insensitive' } },
							{ status: { contains: query.q, mode: 'insensitive' } },
							{ provider: { contains: query.q, mode: 'insensitive' } },
							{ userEmail: { contains: query.q, mode: 'insensitive' } },
							{ paymentSessionId: { contains: query.q, mode: 'insensitive' } },
							{ paymentStatus: { contains: query.q, mode: 'insensitive' } },
							{ paymentId: { contains: query.q, mode: 'insensitive' } },
							{ orderType: { contains: query.q, mode: 'insensitive' } },
							{ ticketingStatus: { contains: query.q, mode: 'insensitive' } },
							{ cancelationStatus: { contains: query.q, mode: 'insensitive' } },
							{ corelationId: { contains: query.q, mode: 'insensitive' } },
							{ travelerEmail: { contains: query.q, mode: 'insensitive' } },
						],
					},
					take: size,
					skip: skip,
				})

				const rowsCount = await prisma.booking.count({
					where: {
						userEmail: authentication.response.decodedUserInfo.email,
						OR: [
							{ tavaBookingId: { contains: query.q, mode: 'insensitive' } },
							{ providerBookingId: { contains: query.q, mode: 'insensitive' } },
							{ pnr: { contains: query.q, mode: 'insensitive' } },
							{ status: { contains: query.q, mode: 'insensitive' } },
							{ provider: { contains: query.q, mode: 'insensitive' } },
							{ userEmail: { contains: query.q, mode: 'insensitive' } },
							{ paymentSessionId: { contains: query.q, mode: 'insensitive' } },
							{ paymentStatus: { contains: query.q, mode: 'insensitive' } },
							{ paymentId: { contains: query.q, mode: 'insensitive' } },
							{ orderType: { contains: query.q, mode: 'insensitive' } },
							{ ticketingStatus: { contains: query.q, mode: 'insensitive' } },
							{ cancelationStatus: { contains: query.q, mode: 'insensitive' } },
							{ corelationId: { contains: query.q, mode: 'insensitive' } },
							{ travelerEmail: { contains: query.q, mode: 'insensitive' } },
						],
					},
				})

				const countInfo = {
					count: rowsCount,
					totalPage: Math.ceil(rowsCount / size),
					currentPage: page,
					size: size,
				}

				const result = getBookingByUser
				const response = { countInfo, result, ...counts }
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
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

const getbookingsbyid = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const authentication = await idpAuthentication(req, 'authorize')

		if (authentication.response.error) throw authentication.response.error

		const getUser = await prisma.users.findUnique({
			where: { id: authentication.response.decodedUserInfo.id },
		})

		if (getUser.role === 'ADMIN' || getUser.role === 'SUPERADMIN') {
			const getBookingsById = await prisma.booking.findMany({
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
					data: { result: getBookingsById },
				},
				templateType
			)
			return res.status(200).json({ output: { result: getBookingsById } })
		} else if (getUser.role === 'GUEST' || getUser.role === 'USER') {
			const getBookingsById = await prisma.booking.findMany({
				where: {
					tavaBookingId: params.id,
					userEmail: getUser.email,
				},
			})
			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: { output: { result: getBookingsById } },
				},
				templateType
			)
			return res.status(200).json({ result: getBookingsById })
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

const updatebooking = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const cancelBookingResponse = await prisma.booking.updateMany({
			where: {
				tavaBookingId: params.id,
			},
			data: {
				status: 'CANCELED',
				paymentStatus: 'CANCELED',
			},
		})
		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: { output: cancelBookingResponse } },
			templateType
		)
		res.status(200).json({ message: 'Booking Canceled' })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}
module.exports = {
	getallbookings,
	getbookingsbyid,
	updatebooking,
}
