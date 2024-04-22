const express = require('express')
const router = express.Router()

const login = require('../controllers/infrastructure/idp/login.controllers')
const signUp = require('../controllers/infrastructure/idp/sign_up.controllers')
const token = require('../controllers/infrastructure/idp/token.controllers')
const resetPassword = require('../controllers/infrastructure/idp/reset_password.controllers')
const forgotPassword = require('../controllers/infrastructure/idp/forgot_password.controllers')
const verifyOtp = require('../controllers/infrastructure/idp/verify_otp.controllers')

router.post('/verify-otp', verifyOtp.verifyotp)
router.post('/forgot-password', forgotPassword.forgotpassword)
router.post('/reset-password', resetPassword.resetpassword)
router.post('/login', login.login)
router.post('/sign-up', signUp.signup)
router.post('/token', token.token)

module.exports = router
