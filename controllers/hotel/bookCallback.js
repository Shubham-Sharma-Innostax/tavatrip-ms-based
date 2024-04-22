const ejs = require('ejs');
const fs = require('fs');
const { convert } = require('html-to-text');
const RabbitMQClient = require('../../rabbitmq/client');
const prismaClient = require('../../prismaClient');
const { prisma } = prismaClient;
const { callPaymentCallback } = require('../infrastructure/payment/paymentCallback.controllers')
const {
	callBook,
	callGetBookingDetail,
	callBlockRoom,
} = require('../../services/tbo/hotelAPIHandler')
const { tavaLogger } = require('../../helpers/tavaLogger')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../services/tbo/authentication')
const { createRefundEntry } = require('./createRefundEntry')
const cheerio = require('cheerio')
const { getCurrencySymbolFromCode } = require('../../helpers/getCurrencySymbolFromCode')

const hotelbookcallback = async (req, res, next) => {
	const { body, url, headers, query } = req
	const templateType = 'travel'
	const corelationId = headers['x-request-id'] || ''
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

		const CallPaymentCallbackRESTAPIEndpoint = {
			input: req,
			params: req,
			secrets: process.env,
			headers,
		}

		const isPaymentIdExist = await prisma.paymentSession
			.findMany({
				where: {
					paymentId: query.paymentId,
				},
			})
			.catch((error) => {
				return res
					.status(error?.response?.status || 500)
					.json(error?.response?.data || error?.message || error)
			})

		if (isPaymentIdExist.length !== 0)
			return res.status(200).json({ output: 'Payment ID already used' })

		let paymentCallbackResponse = await callPaymentCallback(
			corelationId,
			CallPaymentCallbackRESTAPIEndpoint,
			templateType
		)

		if (paymentCallbackResponse?.output?.status === 'CAPTURED') {
			await prisma.hotelBooking.updateMany({
				where: { tavaBookingId: query.tavaBookingId },
				data: {
					paymentStatus: paymentCallbackResponse.output.status,
					paymentId: paymentCallbackResponse.output.id,
				},
			})

			const getHotelBookingDetails = await prisma.hotelBooking.findFirst({
				where: { tavaBookingId: query.tavaBookingId },
			})

			const blockRoomRequest = getHotelBookingDetails.blockRoomReqJson
			const blockRoomResponse = await callBlockRoom(
				corelationId,
				blockRoomRequest,
				templateType
			)

			let refund = null
			if (blockRoomResponse.BlockRoomResult.Error.ErrorCode !== 0) {
				await prisma.hotelBooking.updateMany({
					where: { paymentSessionId: query.paymentSessionId },
					data: { bookingStatus: 'FAILED' },
				})
				refund = await createRefundEntry(
					corelationId,
					query,
					blockRoomResponse,
					templateType,
					url
				)
				return res.send({ output: { refund } })
			} else {
				const bookRequest = getHotelBookingDetails.bookingReqJson
				const bookResponse = await callBook(
					corelationId,
					bookRequest,
					templateType
				)

				if (bookResponse.BookResult.Error.ErrorCode === 0) {
					await prisma.hotelBooking.updateMany({
						where: { tavaBookingId: query.tavaBookingId },
						data: {
							bookingResJson: JSON.stringify(bookResponse),
							bookingId: bookResponse.BookResult.BookingId?.toString(),
							confirmationNo: bookResponse.BookResult.ConfirmationNo,
							bookingRefNo: bookResponse.BookResult.BookingRefNo,
							bookingStatus:
								bookResponse.BookResult.HotelBookingStatus.toUpperCase(),
						},
					})

					const getBookingDetailsRequest = {
						EndUserIp: getHotelBookingDetails.bookingReqJson.EndUserIp,
						TokenId,
						BookingId: bookResponse.BookResult.BookingId,
					}

					const getBookingDetailsResponse = await callGetBookingDetail(
						corelationId,
						getBookingDetailsRequest,
						templateType
					)

					if (
						getBookingDetailsResponse.GetBookingDetailResult.Error.ErrorCode ===
						0
					) {
						const { InvoiceNo, HotelBookingStatus } =
							getBookingDetailsResponse.GetBookingDetailResult

						await prisma.hotelBooking.updateMany({
							where: { tavaBookingId: query.tavaBookingId },
							data: {
								invoiceNo: InvoiceNo,
								bookingStatus: HotelBookingStatus.toUpperCase(),
								getBookingDetailRes: JSON.stringify(getBookingDetailsResponse),
							},
						})

						const getBookingSingleRecord =
							await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(
								`SELECT * FROM "hotelBooking" WHERE "tavaBookingId" = '${query.tavaBookingId}' LIMIT 1`
							)}`

						const emailDataMapper = async function () {
							let bookings = getBookingDetailsResponse

							function getTravelerDetails(bookings) {
								const travelerDetails = []

								if (
									bookings &&
									bookings.GetBookingDetailResult &&
									bookings.GetBookingDetailResult.HotelRoomsDetails
								) {
									const rooms =
										bookings.GetBookingDetailResult.HotelRoomsDetails

									rooms.forEach((room) => {
										if (room && room.HotelPassenger) {
											room.HotelPassenger.forEach((passenger) => {
												if (passenger) {
													const traveler = {
														firstName: passenger.FirstName || '',
														lastName: passenger.LastName || '',
														email: passenger.Email || '',
														phoneNumber: passenger.Phoneno || '',
														age: passenger.Age || 0,
														title: passenger.Title || '',
													}

													travelerDetails.push(traveler)
												}
											})
										}
									})
								}

								return travelerDetails
							}

							function getCompleteAddress(bookings) {
								const addressLine1 =
									bookings?.GetBookingDetailResult?.AddressLine1 ?? ''
								const city = bookings?.GetBookingDetailResult?.City ?? ''
								const countryCode =
									bookings?.GetBookingDetailResult?.CountryCode ?? ''

								return `${addressLine1}, ${city}, ${countryCode}`
							}

							let address = getCompleteAddress(bookings)
							address.replace(/,\s*/g, ', ')

							function calculateTotalGuests(bookings) {
								const roomDetails =
									bookings.GetBookingDetailResult.HotelRoomsDetails
								let totalAdults = 0
								let totalChildren = 0

								const counts = roomDetails.map((booking) => {
									const adultCount = booking.AdultCount
									const childCount = booking.ChildCount

									totalAdults += adultCount
									totalChildren += childCount
								})
								return {
									totalAdults,
									totalChildren,
								}
							}

							function calculateNights(checkInDate, checkOutDate) {
								const checkIn = new Date(checkInDate)
								const checkOut = new Date(checkOutDate)
								const diffTime = Math.abs(checkOut - checkIn)
								const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
								return diffDays
							}

							const numberOfNights = calculateNights(
								bookings.GetBookingDetailResult.CheckInDate,
								bookings.GetBookingDetailResult.CheckOutDate
							)

							function extractRoomTypeNames(data) {
								const roomTypeNameRegex = /"RoomTypeName":\s*"([^"]*)"/g
								const roomTypeNames = []
								let match
								while (
									(match = roomTypeNameRegex.exec(JSON.stringify(data))) !==
									null
								) {
									roomTypeNames.push(match[1])
								}
								return roomTypeNames
							}

							const roomTypeNames = extractRoomTypeNames(bookings)

							function extractAmenities(data) {
								const amenities = []
								data.GetBookingDetailResult.HotelRoomsDetails.forEach(
									(room) => {
										if (room.Amenities && room.Amenities.length > 0) {
											room.Amenities.forEach((amenity) => {
												amenities.push(amenity)
											})
										}
									}
								)
								return amenities
							}

							let amenities = extractAmenities(bookings)

							function extractInformation(htmlString) {
								const plainText = convert(htmlString, {
									wordwrap: false,
									ignoreHref: true,
									ignoreImage: true,
									preserveNewlines: true,
									tags: {
										ul: {
											format: 'block',
											options: {},
										},
										li: {
											format: 'block',
											options: {},
										},
									},
								})

								const $ = cheerio.load(plainText)

								let checkInTimeBegin = $('body')
									.text()
									.match(/CheckIn Time-Begin: (.*?)(?=CheckOut Time)/)[1]
									.trim()
								const checkOutTime = $('body')
									.text()
									.match(/CheckOut Time: (.*?)(?=CheckIn Instructions)/)[1]
									.trim()
								const checkInInstructions = $('body')
									.text()
									.match(/CheckIn Instructions: (.*)/)[1]
									.trim()

								return {
									checkInTimeBegin,
									checkOutTime,
									checkInInstructions,
								}
							}

							const extractedInformation = extractInformation(
								getBookingSingleRecord[0].blockRoomResJson.BlockRoomResult
									.HotelPolicyDetail
							)

							const paymentSessionId = query.paymentSessionId

							if (!paymentSessionId) {
								console.error('Payment session ID is missing.')
							}
				
							const paymentSessionData = await prisma.paymentSession.findUnique({
								where: { id: paymentSessionId },
							})
				
							const currencySymbol = await getCurrencySymbolFromCode(paymentSessionData.currency)
							const totalPrice = paymentSessionData.amount / 100;

							return {
								tavaBookingId: query.tavaBookingId,
								roomType: roomTypeNames,
								aminityDetails: amenities,
								hotelPolicy: extractedInformation,
								bookingData: bookings,
								propertyAddress: address,
								travelerData: getTravelerDetails(bookings),
								travelerCount: calculateTotalGuests(bookings),
								noOfNights: numberOfNights,
								price: totalPrice - 1.8,
								grandTotal: totalPrice,
								currencySymbol: currencySymbol,
								serviceCharge: '1.18 (0.18 GST @18%)',
								currencyCode : paymentSessionData.currency
							}
						}

						const emailData = await emailDataMapper()

						const voucheredEmailConfirmation = {
							from: process.env.EMAIL_USER,
							to: getHotelBookingDetails.bookingReqJson.HotelRoomsDetails[0].HotelPassenger[0].Email,
							subject: 'Hotel Booking Email',
							html: '',
						}

						const fileContent = fs.readFileSync(
							__dirname.split('controllers')[0] +
								'/htmlfiles/CreateEmailMessageForHotelBooking.ejs',
							'utf8'
						)
						let htmlContent = ejs.render(fileContent, { emailData })
						if (htmlContent.startsWith('&lt;'))
							htmlContent = convert(htmlContent, { wordwrap: 130 })

						const emailServer = {
							host: process.env.EMAIL_HOST,
							port: process.env.EMAIL_PORT,
							auth: {
								user: process.env.EMAIL_USERNAME,
								pass: process.env.EMAIL_PASSWORD,
							},
						}
						const emailMessageContent = {
							...voucheredEmailConfirmation,
							emailServer,
							html: htmlContent,
							attachments: [],
						}

						const rabbitMQQueueResponse = await RabbitMQClient.produce({
							data: emailMessageContent,
							queueName: process.env.RABBITMQ_EMAIL_QUEUE,
						})
						if (
							rabbitMQQueueResponse.emailResponse.error ||
							rabbitMQQueueResponse.error
						)
							return res.json(
								rabbitMQQueueResponse.emailResponse.error ||
									rabbitMQQueueResponse.error
							)

						tavaLogger(
							corelationId,
							'Response',
							url,
							{
								status: 200,
								data: {
									internalOutput: { input: { ...getBookingDetailsResponse } },
								},
							},
							templateType
						)
						return res
							.status(200)
							.json({
								internalOutput: { input: { ...getBookingDetailsResponse } },
							})
					} else {
						await prisma.hotelBooking.updateMany({
							where: { paymentSessionId: query.paymentSessionId },
							data: { bookingStatus: 'FAILED' },
						})
						refund = await createRefundEntry(
							corelationId,
							query,
							getBookingDetailsResponse,
							templateType,
							url
						)
						return res.send({ output: { refund } })
					}
				} else {
					await prisma.hotelBooking.updateMany({
						where: { paymentSessionId: query.paymentSessionId },
						data: { bookingStatus: 'FAILED' },
					})
					refund = await createRefundEntry(
						corelationId,
						query.tavaBookingId,
						bookResponse,
						templateType,
						url
					)
					return res.send({ output: { refund } })
				}
			}
		} else {
			await prisma.hotelBooking.updateMany({
				where: { paymentSessionId: query.paymentSessionId },
				data: {
					paymentStatus: paymentCallbackResponse.output.status,
					bookingStatus: 'PENDING',
				},
			})
			const returnPaymentFailed = {
				paymentStatus: paymentCallbackResponse.output.status,
				bookingStatus: 'Pending',
			}
			return res.send({ output: { returnPaymentFailed } })
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}

module.exports = {
	hotelbookcallback,
}
