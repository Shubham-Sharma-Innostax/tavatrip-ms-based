const express = require('express')
const router = express.Router()
const validateClient = require('../validateClient/index')

const tboSearch = require('../controllers/flights/tbo/tboSearch.controllers')
const tboReissuance = require('../controllers/flights/tbo/tboReissuance.controllers')
const specialServices = require('../controllers/flights/tbo/specialServices.controllers')
const reissuanceCallback = require('../controllers/flights/tbo/reissuanceCallback.controllers')
const cancellationCharges = require('../controllers/flights/tbo/cancellationCharges.controllers')

router.post('/cancellation-charges', cancellationCharges.cancellationcharges)
router.post('/reissuance-callback', reissuanceCallback.reissuanceCallback)
router.post('/tbo-search', validateClient, tboSearch.tbosearch)
router.post('/tbo-Reissuance', validateClient, tboReissuance.tboreissuance)
router.post('/special-services', validateClient, specialServices.specialService)

module.exports = router
