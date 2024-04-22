const express = require('express')
const router = express.Router()
const users = require('../controllers/users/users.controllers')
const authentication = require('../middleware/authentication')
const travelers = require('../controllers/users/travelers.controllers')

router.delete('/travelers/:id', travelers.deletetraveler)
router.patch('/travelers/:id', authentication, travelers.updatetraveler)
router.post('/users/:id', authentication, users.addtravelers)
router.get('/users/:id', users.getuserdetails)
router.patch('/users/:id', users.updateuserdetails)
module.exports = router
