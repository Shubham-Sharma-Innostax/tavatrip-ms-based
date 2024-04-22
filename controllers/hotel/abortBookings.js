const { tavaLogger } = require('../../helpers')
const prismaClient = require('../../prismaClient')
const { prisma } = prismaClient

const aborthotelbooking = async (req, res, next) => {
	const { url, headers, params } = req
	const templateType = 'travel'
	const corelationId = headers['x-request-id'] || ''

	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const abortedbookings = await prisma.hotelBooking.updateMany({
			where: { tavaBookingId: params.tavaBookingId },
			data: {
				paymentStatus: 'CANCELED',
				bookingStatus: 'CANCELED',
			},
		})
		tavaLogger(
			corelationId,
			'Response',
			url,
			{
				status: 200,
				data: abortedbookings,
			},
			templateType
		)
		res.send(200)
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}

module.exports = {
	aborthotelbooking,
}
