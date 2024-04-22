// Import required modules
const { tavaLogger } = require('../../../helpers')
const axios = require('axios')
const qs = require('qs')

// Define the function to verify OTP asynchronously
const verifyotp = async (req, res, next) => {
	// Initialize variables
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']

	try {
		// Log the incoming request to the database
		tavaLogger(corelationId, 'Request', url, req, templateType)

		// Extract required environment variables
		const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID } =
			process.env
		const { phone, code } = body

		// Construct the URL for OTP verification
		const verifyOtpUrl = `https://verify.twilio.com/v2/Services/${TWILIO_SERVICE_SID}/VerificationCheck`

		// Prepare data to be sent in the request
		const data = qs.stringify({ To: phone, Code: code })

		// Prepare configuration for axios request
		const config = {
			method: 'post',
			maxBodyLength: Infinity,
			url: verifyOtpUrl,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: `Basic ${Buffer.from(
					TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN
				).toString('base64')}`,
			},
			data: data,
		}

		// Send the OTP verification request and handle the response
		const verifyOtpResponse = await axios
			.request(config)
			.then(async (response) => {
				// Log the response to the database
				tavaLogger(
					corelationId,
					'Response',
					url,
					response,
					templateType
				)
				return response.data.status
			})
			.catch((error) => {
				// Log any errors that occur during the request
				console.log(error)
				throw new Error(error)
			})

		// Log the final response to the database
		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: verifyOtpResponse },
			templateType
		)

		// Send the final response back to the client
		return res.json({ output: verifyOtpResponse })
	} catch (error) {
		// If an error occurs, log it to the database and send an appropriate response back to the client
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

// Export the function to be used by other modules
module.exports = {
	verifyotp,
}
