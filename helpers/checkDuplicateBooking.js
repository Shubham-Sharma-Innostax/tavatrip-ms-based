const prismaClient = require('../prismaClient')
const { prisma } = prismaClient
const { tavaLogger } = require('../helpers')

const checkDuplicateBooking = async (req, res, next, corelationId, url) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const { headers } = req.params

		const parseInputData = (inputData) => {
			const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
			const output = []
			let match
			while ((match = regex.exec(inputData)) !== null) {
				const [, key, value, operator] = match
				output.push({
					key,
					value,
					operator,
				})
			}
			return output
		}

		const formatQuery = (parsedData) => {
			let query = ''
			let preOperator = ''
			parsedData.forEach((item) => {
				if (!item.value.includes('undefined')) {
					query += `${query ? preOperator : ''} "${item.key}" = '${item.value}'`
				}
				preOperator = item.operator
			})
			return query ? `WHERE ${query}` : ''
		}

		const buildSortExpression = (sortObj) => {
			if (!sortObj.length) return ''
			const orderByClause = sortObj
				.map((order) => {
					const [key, value] = Object.entries(order)[0]
					return `"${key}" ${value.toUpperCase()}`
				})
				.join(', ')
			return `ORDER BY ${orderByClause}`
		}

		const parseAndExecuteQuery = async (formattedQuery, sortObj) => {
			const isFormattedQueryExist = formattedQuery
				? `WHERE ${formattedQuery}`
				: ''
			const sortObjExpression = buildSortExpression(sortObj)
			const query = `SELECT * FROM "Booking" ${isFormattedQueryExist} ${sortObjExpression} OFFSET 0 ROWS FETCH NEXT '500' ROWS ONLY`
			return await prisma.$queryRaw`${prismaClient.PrismaInstance.raw(query)}`
		}

		const parseAndExecuteMainQuery = async (inputData) => {
			const parsedData = parseInputData(inputData)
			const formattedQuery = formatQuery(parsedData)
			const sortObj = []
			return await parseAndExecuteQuery(formattedQuery, sortObj)
		}

		const queryToFetchRec = `"createdAt" >= current_timestamp - interval '24 hours'`
		const pastDayRecords = await parseAndExecuteMainQuery(queryToFetchRec)

		const duplicateCheckMajor = async (req, pastDayRecords) => {
			const requestBody = req.input.body
			const bookingData = pastDayRecords

			function compareSegments(segment1, segment2) {
				return (
					segment1.departure.date === segment2.departure.date &&
					segment1.departure.time === segment2.departure.time &&
					segment1.departure.airportName === segment2.departure.airportName &&
					segment1.departure.iataCode === segment2.departure.iataCode &&
					segment1.arrival.date === segment2.arrival.date &&
					segment1.arrival.time === segment2.arrival.time &&
					segment1.arrival.airportName === segment2.arrival.airportName &&
					segment1.arrival.iataCode === segment2.arrival.iataCode &&
					segment1.carrierCode === segment2.carrierCode &&
					segment1.flightNumber === segment2.flightNumber
				)
			}

			function compareItineraries(itinerary1, itinerary2) {
				if (itinerary1.segments.length !== itinerary2.segments.length) {
					return false
				}

				for (let i = 0; i < itinerary1.segments.length; i++) {
					if (
						!compareSegments(itinerary1.segments[i], itinerary2.segments[i])
					) {
						return false
					}
				}

				return true
			}

			function compareJourneys(journey1, journey2) {
				if (journey1.itineraries.length !== journey2.itineraries.length) {
					return false
				}

				for (let i = 0; i < journey1.itineraries.length; i++) {
					if (
						!compareItineraries(
							journey1.itineraries[i],
							journey2.itineraries[i]
						)
					) {
						return false
					}
				}

				return journey2
			}

			function checkForDuplicateSegmentsInBookings(requestBody, bookingData) {
				const requestJourneys = requestBody.bookingRequest.journeyDetails
				const bookingRecords = bookingData
				let bookingJourneys
				for (let i = 0; i < bookingRecords.length; i++) {
					bookingJourneys = bookingRecords[i].bookingJSON.journeyDetails

					for (let j = 0; j < requestJourneys.length; j++) {
						for (let k = 0; k < bookingJourneys.length; k++) {
							if (
								compareJourneys(requestJourneys[j], bookingJourneys[k]) &&
								bookingRecords[i].pnr !== ''
							) {
								console.log('Duplicate booking found!')
								return {
									isDuplicate: true,
									originalBookingDetail: bookingRecords[i],
									duplicateBookingDetail: requestBody.bookingRequest,
								}
							}
						}
					}
				}

				console.log('No duplicate bookings found.')
				return false
			}

			function compareTravelersInBookingDetails(bookingData, requestBody) {
				const travelerDetails = Array.isArray(bookingData)
					? bookingData[0].travelerDetails
					: bookingData.travelerDetails
				const journeyDetails = requestBody.travelerDetails

				if (travelerDetails.length !== journeyDetails.length) {
					return false
				}

				for (let i = 0; i < travelerDetails.length; i++) {
					const traveler = travelerDetails[i]
					const journey = journeyDetails[i]

					if (
						traveler.givenName?.toLowerCase() !==
							journey.givenName?.toLowerCase() ||
						traveler.familyName?.toLowerCase() !==
							journey.familyName?.toLowerCase() ||
						traveler.dateOfBirth !== journey.dateOfBirth
					) {
						return false
					}
				}

				return true
			}
			let isMatch = false
			for (const booking of bookingData) {
				for (const journey of requestBody.bookingRequest.journeyDetails) {
					isMatch = compareTravelersInBookingDetails(
						booking.bookingJSON.journeyDetails,
						journey
					)
					if (isMatch && booking.pnr !== '') {
						break
					}
				}
				if (isMatch && booking.pnr !== '') {
					break
				}
			}

			const duplicateBookingStatus = checkForDuplicateSegmentsInBookings(
				requestBody,
				bookingData
			)

			if (
				duplicateBookingStatus.isDuplicate &&
				(!duplicateBookingStatus.originalBookingDetail ||
					duplicateBookingStatus.originalBookingDetail.pnr === '')
			) {
				return {
					isDuplicateBooking: false,
					message: 'No duplicate booking found.',
				}
			} else if (duplicateBookingStatus.isDuplicate && isMatch) {
				return {
					isDuplicateBooking: true,
					duplicateTavaId:
						duplicateBookingStatus.duplicateBookingDetail.tavaBookingId,
					tavaBookingId:
						duplicateBookingStatus.originalBookingDetail.tavaBookingId,
					correspondingPNR: duplicateBookingStatus.originalBookingDetail.pnr,
				}
			} else {
				return {
					isDuplicateBooking: false,
					message: 'No duplicate booking found.',
				}
			}
		}

		const duplicateResponse = await duplicateCheckMajor(req, pastDayRecords)
		if (duplicateResponse.isDuplicateBooking === true) {
			const checkResponse = async () => {
				const objForDuplicateRecord = {
					tavaBookingId: duplicateResponse.tavaBookingId,
					correspondingPNR: duplicateResponse.correspondingPNR,
					duplicateTavaId: duplicateResponse.duplicateTavaId,
				}

				const createDuplicateRecord = await prisma.duplicateBooking.create({
					data: objForDuplicateRecord,
				})
				const ReturnSuccessResponse = {
					output: duplicateResponse,
					params: req,
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
			return resultCheck
		}
		if (duplicateResponse.isDuplicateBooking === false) {
			const checkResponse = async () => {
				const ReturnSuccessResponse = {
					output: duplicateResponse,
					params: req,
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
			return resultCheck
		}
	} catch (error) {
		const templateType = 'travel'

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

module.exports = { checkDuplicateBooking }
