const express = require('express')
const router = express.Router()
const validateClient = require('../validateClient/index')

const amadeusBooking = require('../controllers/flights/amadeus/amadeusBooking.controllers')
const amadeusSignout = require('../controllers/flights/amadeus/amadeusSignout.controllers')
const amadeusSearch = require('../controllers/flights/amadeus/amSearch.controllers')
const amadeusHeader_data = require('../controllers/flights/amadeus/amadeusHeader_data.controllers')
const amadeusTicket = require('../controllers/flights/amadeus/amadeusTicket.controllers')
const processRefund = require('../controllers/flights/amadeus/processRefund.controllers')
const pnrRetrieve = require('../controllers/flights/amadeus/pnr_retrieve.controllers')
const initRefund = require('../controllers/flights/amadeus/initRefund.controllers')

router.post('/initRefund', initRefund.atcInitRefund)
router.post('/pnr-retrieve', pnrRetrieve.pnrRetrieve)
router.post('/amadeus-booking', amadeusBooking.amadeusbook)
router.get('/amadeus-header-data', amadeusHeader_data.amadeusheaderdata)
router.post('/am-search', validateClient, amadeusSearch.amadeusSearchSplit)

router.post('/amadeus-signout', amadeusSignout.amadeussignout)
router.post('/amadeus-ticket', amadeusTicket.amadeusticketing)
router.post('/processRefund', processRefund.atcProcessRefund)

module.exports = router
