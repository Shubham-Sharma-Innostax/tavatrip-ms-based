const express = require('express')
const router = express.Router()
const hotel = require('../controllers/hotel/hotel.controllers')
const hotelBook = require('../controllers/hotel/book')
const hotelBookcallback = require('../controllers/hotel/bookCallback')
const hotelGenerateVoucher = require('../controllers/hotel/generateVoucher')
const validateClient = require('../validateClient/index')
const hotelSearch = require('../controllers/hotel/search')
const hotelPrice = require('../controllers/hotel/price')
const hotelBlockRoom = require('../controllers/hotel/blockRoom')
const abortHotelBookings = require('../controllers/hotel/abortBookings')

router.post(
	'/hotels/verify-price-policy',
	validateClient,
	hotelBlockRoom.hotelBlockRoom
)
router.post('/hotels/search', validateClient, hotelSearch.hotelsearch)
router.post('/hotels/price', validateClient, hotelPrice.hotelPrice)
router.patch(
	'/hotels/bookings/:tavaBookingId/abort',
	validateClient,
	abortHotelBookings.aborthotelbooking
)

router.get(
	'/hotel/book-callback',
	validateClient,
	hotelBookcallback.hotelbookcallback
)
router.post('/hotel/book', validateClient, hotelBook.hotelbook)
router.get('/hotel/bookings', validateClient, hotel.gethotelbookings)
router.get(
	'/hotel/generate-voucher',
	validateClient,
	hotelGenerateVoucher.generatevoucher
)
router.post(
	'/hotel/bookings/:id/cancel',
	validateClient,
	hotel.cancelhotelbooking
)
router.get('/hotel/bookings/:id', validateClient, hotel.gethotelbookingsbyid)

module.exports = router
