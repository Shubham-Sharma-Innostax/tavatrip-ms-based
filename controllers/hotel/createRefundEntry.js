const { tavaLogger } = require('../../helpers')
const prismaClient = require('../../prismaClient')
const { prisma } = prismaClient

const createRefundEntry = async (
	corelationId,
	query,
	apiResponse,
	templateType,
	url
) => {
	const { tavaBookingId } = query
	const dbData = await prisma.hotelBooking.findFirst({
		where: {
			tavaBookingId,
		},
	})

	const calculateNetAmount = (hotelRoomsDetails) => {
		//dbData.bookingReqJson.hotelRoomsDetails
		let totalAmount = 0
		for (let i = 0; i < hotelRoomsDetails.length; i++) {
			let amount = hotelRoomsDetails[i].Price.PublishedPrice
			totalAmount += amount * hotelRoomsDetails[i].HotelPassenger.length
		}
		return totalAmount * 100
	}

	const refundQueueRequest = {
		tavaBookingId: dbData.tavaBookingId,
		isCompleted: false,
		refundAmount: calculateNetAmount(
			dbData.bookingReqJson.HotelRoomsDetails
		)?.toString(),
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		source: 'TBO',
		bookingId: dbData.id,
		paymentId: dbData.paymentId,
		division: 'HOTEL',
		currency: dbData.currency,
		remarks: apiResponse,
	}
	const refundEntry = await prisma.refundQueue.create({
		data: refundQueueRequest,
	})

	const returnResponse = {
		output: apiResponse,
		created: refundEntry,
	}

	tavaLogger(
		corelationId,
		'Response',
		url,
		{
			status: 200,
			data: returnResponse,
		},
		templateType
	)
	return returnResponse
}

module.exports = { createRefundEntry }
