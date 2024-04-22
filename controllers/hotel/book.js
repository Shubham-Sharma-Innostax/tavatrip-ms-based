const {
	callBook,
	callGetBookingDetail,
} = require('../../services/tbo/hotelAPIHandler')
const { tavaLogger } = require('../../helpers/tavaLogger')
const {
	createAuthRequest,
	callAuthRESTAPI,
} = require('../../services/tbo/authentication')
const ejs = require('ejs')
const { convert } = require('html-to-text')
const fs = require('fs')
const RabbitMQClient = require('../../rabbitmq/client')
const prismaClient = require('../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')
const cheerio = require('cheerio')
const { callPayment } = require('../infrastructure/payment/payment.controllers')
const {
	getCurrencySymbolFromCode,
} = require('../../helpers/getCurrencySymbolFromCode')

const hotelbook = async (req, res, next) => {
	const { body, url, headers } = req
	const templateType = 'travel'
	const corelationId = headers['x-request-id'] || ''

	try {
		const tavaBookingId = body.bookingRequest.tavaBookingId
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
		const TokenId = authResponse.TokenId

		const bookingRequest = {
			TokenId,
			...body.bookingRequest,
		}

		const generateBookRecordRequest = () => {
			const TokenId = authResponse.TokenId

			const getEmail = (accountEmail, leadPaxEmail) => {
				const userEmail = accountEmail || leadPaxEmail
				return {
					userEmail,
					guestEmail: leadPaxEmail,
				}
			}

			// Check for corelation ID
			const updatedBookingRequestJson = JSON.parse(
				JSON.stringify(bookingRequest)
			)
			delete updatedBookingRequestJson.tavaBookingId
			delete updatedBookingRequestJson.accountEmail

			const emailData = getEmail(
				body.bookingRequest.accountEmail,
				body.bookingRequest.HotelRoomsDetails[0].HotelPassenger[0].Email
			)
			const guestEmail = emailData.guestEmail
			const userEmail = emailData.userEmail
			const checkInDate =
				body?.blockRoomRes?.BlockRoomResult?.HotelRoomsDetails?.[0]
					?.DayRates?.[0]?.Date
			const formattedCheckInDate = checkInDate
				? new Date(checkInDate).toISOString()
				: null

			return {
				bookingReqJson: updatedBookingRequestJson,
				guestEmail: guestEmail,
				userEmail: userEmail,
				tavaBookingId: bookingRequest.tavaBookingId,
				isVoucheredBooking: bookingRequest.IsVoucherBooking !== 'false',
				blockRoomReqJson: {
					TokenId,
					...body.blockRoomReq,
				},
				blockRoomResJson: body.blockRoomRes,
				voucherExpiryDate: bookingRequest.HotelRoomsDetails[0].LastVoucherDate,
				corelationId: corelationId,
				createdAt: new Date(),
				updatedAt: new Date(),
				checkInDate: formattedCheckInDate,
			}
		}

		const createBookingRecord = await prisma.hotelBooking.create({
			data: generateBookRecordRequest(),
		})
		let response

		if (body.bookingRequest.IsVoucherBooking === 'false') {
			const nonVoucerbookingRequest = JSON.parse(JSON.stringify(bookingRequest))
			delete nonVoucerbookingRequest.tavaBookingId
			delete nonVoucerbookingRequest.accountEmail
			const bookResponse = await callBook(
				corelationId,
				nonVoucerbookingRequest,
				templateType
			)

			if (bookResponse.BookResult.Error.ErrorCode === 0) {
				const getDetailsRequest = {
					EndUserIp: body.bookingRequest.EndUserIp,
					TokenId: authResponse.TokenId,
					BookingId: bookResponse.BookResult.BookingId,
				}

				await prisma.hotelBooking.updateMany({
					where: {
						tavaBookingId: body.bookingRequest.tavaBookingId,
					},
					data: {
						bookingResJson: JSON.stringify(bookResponse),
						bookingId: bookResponse.BookResult.BookingId?.toString(),
						confirmationNo: bookResponse.BookResult.ConfirmationNo,
						bookingRefNo: bookResponse.BookResult.BookingRefNo,
						bookingStatus:
							bookResponse.BookResult.HotelBookingStatus?.toUpperCase(),
					},
				})

				const getBookingDetailsResponse = await callGetBookingDetail(
					corelationId,
					getDetailsRequest,
					templateType
				)

				if (
					getBookingDetailsResponse.GetBookingDetailResult.Error.ErrorCode === 0
				) {
					await prisma.hotelBooking.updateMany({
						where: {
							tavaBookingId: body.bookingRequest.tavaBookingId,
						},
						data: {
							invoiceNo:
								getBookingDetailsResponse.GetBookingDetailResult.InvoiceNo,
							bookingStatus:
								getBookingDetailsResponse.GetBookingDetailResult.HotelBookingStatus.toUpperCase(),
							getBookingDetailRes: JSON.stringify(getBookingDetailsResponse),
						},
					})

					hotelEmailMapper = async function () {
						const bookings = getBookingDetailsResponse

						function getTravelerDetails(bookings) {
							const travelerDetails = []

							if (bookings?.GetBookingDetailResult?.HotelRoomsDetails) {
								bookings.GetBookingDetailResult.HotelRoomsDetails.forEach(
									(room) => {
										if (room?.HotelPassenger) {
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
									}
								)
							}

							return travelerDetails
						}

						function getCompleteAddress(bookings) {
							const { AddressLine1, City, CountryCode } =
								bookings?.GetBookingDetailResult || {}
							return `${AddressLine1 || ''}, ${City || ''}, ${
								CountryCode || ''
							}`
						}

						const address = getCompleteAddress(bookings).replace(/,\s*/g, ', ')

						function calculateTotalGuests(bookings) {
							let totalAdults = 0
							let totalChildren = 0

							const roomDetails =
								bookings?.GetBookingDetailResult?.HotelRoomsDetails || []

							roomDetails.forEach((booking) => {
								totalAdults += booking.AdultCount || 0
								totalChildren += booking.ChildCount || 0
							})

							return {
								totalAdults,
								totalChildren,
							}
						}

						function calculateNights(checkInDate, checkOutDate) {
							const diffTime = Math.abs(
								new Date(checkOutDate) - new Date(checkInDate)
							)
							const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
							return diffDays
						}

						const numberOfNights = calculateNights(
							bookings.GetBookingDetailResult?.CheckInDate,
							bookings.GetBookingDetailResult?.CheckOutDate
						)

						function extractRoomTypeNames(data) {
							const roomTypeNames = []
							const roomTypeNameRegex = /"RoomTypeName":\s*"([^"]*)"/g

							let match
							while (
								(match = roomTypeNameRegex.exec(JSON.stringify(data))) !== null
							) {
								roomTypeNames.push(match[1])
							}

							return roomTypeNames
						}

						const roomTypeNames = extractRoomTypeNames(bookings)

						function extractAmenities(data) {
							const amenities = []
							const roomDetails =
								data?.GetBookingDetailResult?.HotelRoomsDetails || []

							roomDetails.forEach((room) => {
								if (room.Amenities && room.Amenities.length > 0) {
									amenities.push(...room.Amenities)
								}
							})

							return amenities
						}

						const amenities = extractAmenities(bookings)

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

							const checkInTimeBegin =
								$('body')
									.text()
									.match(/CheckIn Time-Begin: (.*?)(?=CheckOut Time)/)?.[1]
									?.trim() || ''
							const checkOutTime =
								$('body')
									.text()
									.match(/CheckOut Time: (.*?)(?=CheckIn Instructions)/)?.[1]
									?.trim() || ''
							const checkInInstructions =
								$('body')
									.text()
									.match(/CheckIn Instructions: (.*)/)?.[1]
									?.trim() || ''

							return {
								checkInTimeBegin,
								checkOutTime,
								checkInInstructions,
							}
						}

						const extractedInformation = extractInformation(
							body.blockRoomRes.BlockRoomResult.HotelPolicyDetail
						)

						const currencySymbol = await getCurrencySymbolFromCode(
							body.paymentRequest.currency
						)

						return {
							tavaBookingId: tavaBookingId,
							roomType: roomTypeNames,
							aminityDetails: amenities,
							hotelPolicy: extractedInformation,
							bookingData: bookings,
							propertyAddress: address,
							travelerData: getTravelerDetails(bookings),
							travelerCount: calculateTotalGuests(bookings),
							noOfNights: numberOfNights,
							price: parseFloat(body.paymentRequest.amount) - 1.8,
							grandTotal: parseFloat(body.paymentRequest.amount),
							currencySymbol: currencySymbol,
							serviceCharge: '1.18 (0.18 GST @18%)',
							currencyCode: body.paymentRequest.currency,
						}
					}
					const emailData = await hotelEmailMapper()

					const nonVoucheredEmailConfirmation = {
						from: process.env.EMAIL_USER,
						to: body?.bookingRequest?.HotelRoomsDetails[0].HotelPassenger[0]
							.Email,
						subject: 'Hotel Booking Email',
						html: ``,
					}

					const fileContent = fs.readFileSync(
						__dirname.split(`\controllers`)[0] +
							`/htmlfiles/CreateEmailMessageForVoucherBookingFalse.ejs`,
						`utf8`
					)
					const htmlText = ejs.render(fileContent, {
						emailData,
					})
					let htmlContent = String(htmlText)
					if (htmlText.startsWith('&lt;'))
						htmlContent = convert(htmlContent, {
							wordwrap: 130,
						})
					let attachments = []
					const emailServer = {
						host: process.env.EMAIL_HOST,
						port: process.env.EMAIL_PORT,
						auth: {
							user: process.env.EMAIL_USERNAME,
							pass: process.env.EMAIL_PASSWORD,
						},
					}

					const emailMessageContent = {
						...nonVoucheredEmailConfirmation,
						emailServer,
						html: htmlContent,
						attachments: [...attachments],
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
					return res.status(200).json({
						internalOutput: { input: { ...getBookingDetailsResponse } },
					})
				}
			} else {
				await prisma.hotelBooking.updateMany({
					where: {
						tavaBookingId: body.bookingRequest.tavaBookingId,
					},
					data: {
						bookingResJson: JSON.stringify(bookResponse),
						bookingStatus: 'FAILED',
					},
				})
				return res.status(200).json({ output: { bookResponse } })
			}
		} else {
			let paymentResponse = await callPayment(
				corelationId,
				body.paymentRequest,
				templateType
			)
			await prisma.hotelBooking.updateMany({
				where: {
					tavaBookingId: body.bookingRequest.tavaBookingId,
				},
				data: {
					paymentSessionId: paymentResponse.session.id,
					paymentStatus: 'PENDING',
				},
			})
			tavaLogger(
				corelationId,
				'Response',
				url,
				{ status: 200, data: { output: { ...paymentResponse } } },
				templateType
			)
			return res.status(200).json({ output: { ...paymentResponse } })
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

module.exports = {
	hotelbook,
}
