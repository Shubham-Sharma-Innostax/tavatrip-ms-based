const { tavaLogger } = require('../../../helpers')

const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')

const qs = require('qs')

const payment = async (req, res, next) => {
	const { body, url, headers } = req
	const templateType = 'travel'
	const corelationId = headers['x-request-id'] || ''

	const selectedPaymentPortal = body.selectedPaymentPortal
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		if (body.selectedPaymentPortal === 'RAZORPAY') {
			const razorpayPaymentRequest = {
				amount: Number(body?.amount) * 100,
				currency: body.currency,
			}
			const config = {
				method: 'post',
				url: 'https://api.razorpay.com/v1/orders',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Basic ${Buffer.from(
						process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET
					).toString('base64')}`,
				},
				data: JSON.stringify(razorpayPaymentRequest),
			}

			tavaLogger(
				corelationId,
				'Request',
				config.url,
				config,
				templateType
			)
			const razorpayResponse = await axios(config).then(async (response) => {
				tavaLogger(
					corelationId,
					'Response',
					config.url,
					response,
					templateType
				)
				return response.data
			})

			const mappedresponse = {
				currency: razorpayResponse.currency,
				amount: razorpayResponse.amount,
				session_status: 'CREATED',
				session_id: razorpayResponse.id,
				createdAt: razorpayResponse.created_at.toString(),
				paymentGateway: body.selectedPaymentPortal,
				division: body.division,
				useremail: body.email,
			}

			const paymentSession = await prisma.paymentSession.create({
				data: mappedresponse,
			})
			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: { session: paymentSession },
				},
				templateType
			)
			return res.status(200).json({ session: paymentSession })
		} else if (selectedPaymentPortal === 'STRIPE') {
			const data = {
				line_items: body.lineItems,
				metadata: {},
				mode: 'payment',

				success_url: body.successUrl,
				cancel_url: body.cancelUrl,
				payment_method_types: ['card'],

				phone_number_collection: {
					enabled: false,
				},
				payment_intent_data: {
					metadata: {},
				},
			}
			let config = {
				method: 'post',
				maxBodyLength: Infinity,
				url: 'https://api.stripe.com/v1/checkout/sessions',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: `Basic ${Buffer.from(
						process.env.STRIPE_SECRET_KEY
					).toString('base64')}`,
				},
				data: qs.stringify(data),
			}

			tavaLogger(
				corelationId,
				'Request',
				config.url,
				data,
				templateType
			)
			const stripeResponse = await axios
				.request(config)
				.then(async (response) => {
					tavaLogger(
						corelationId,
						'Request',
						config.url,
						response.data,
						templateType
					)
					return response.data
				})
			const mappedresponse = {
				currency: stripeResponse.currency,
				amount: stripeResponse.amount,
				session_status: 'CREATED',
				session_id: stripeResponse.id,
				createdAt: stripeResponse.created_at.toString(),
				paymentGateway: body.selectedPaymentPortal,
				division: body.division,
				useremail: body.email,
			}

			const paymentSession = await prisma.paymentSession.create({
				data: mappedresponse,
			})
			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: { output: { session: paymentSession } },
				},
				templateType
			)
			return res.status(200).json({ output: { session: paymentSession } })
		} else if (selectedPaymentPortal === 'BANCSTAC') {
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}

const callPayment = async (corelationId, request, templateType) => {
	const url = 'https://api.razorpay.com/v1/orders'
	const selectedPaymentPortal = request.selectedPaymentPortal
	try {
		tavaLogger(corelationId, 'Request', url, request, templateType)

		if (request.selectedPaymentPortal === 'RAZORPAY') {
			const razorpayPaymentRequest = {
				amount: Number(request?.amount) * 100,
				currency: request.currency,
			}
			const config = {
				method: 'post',
				url: 'https://api.razorpay.com/v1/orders',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Basic ${Buffer.from(
						process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET
					).toString('base64')}`,
				},
				data: JSON.stringify(razorpayPaymentRequest),
			}
			tavaLogger(
				corelationId,
				'Request',
				config.url,
				config,
				templateType
			)
			const razorpayResponse = await axios(config).then(async (response) => {
				tavaLogger(
					corelationId,
					'Response',
					config.url,
					response,
					templateType
				)
				return response.data
			})

			const mappedresponse = {
				currency: razorpayResponse.currency,
				amount: razorpayResponse.amount,
				session_status: 'CREATED',
				session_id: razorpayResponse.id,
				createdAt: razorpayResponse.created_at.toString(),
				paymentGateway: request.selectedPaymentPortal,
				division: request.division,
				useremail: request.email,
			}

			const paymentSession = await prisma.paymentSession.create({
				data: mappedresponse,
			})
			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: { session: paymentSession },
				},
				templateType
			)
			return { session: paymentSession }
		} else if (selectedPaymentPortal === 'STRIPE') {
			const data = {
				line_items: body.lineItems,
				metadata: {},
				mode: 'payment',

				success_url: body.successUrl,
				cancel_url: body.cancelUrl,
				payment_method_types: ['card'],

				phone_number_collection: {
					enabled: false,
				},
				payment_intent_data: {
					metadata: {},
				},
			}
			let config = {
				method: 'post',
				maxBodyLength: Infinity,
				url: 'https://api.stripe.com/v1/checkout/sessions',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: `Basic ${Buffer.from(
						process.env.STRIPE_SECRET_KEY
					).toString('base64')}`,
				},
				data: qs.stringify(data),
			}

			tavaLogger(
				corelationId,
				'Request',
				config.url,
				data,
				templateType
			)
			const stripeResponse = await axios
				.request(config)
				.then(async (response) => {
					tavaLogger(
						corelationId,
						'Request',
						config.url,
						response.data,
						templateType
					)
					return response.data
				})
			const mappedresponse = {
				currency: stripeResponse.currency,
				amount: stripeResponse.amount,
				session_status: 'CREATED',
				session_id: stripeResponse.id,
				createdAt: stripeResponse.created_at.toString(),
				paymentGateway: body.selectedPaymentPortal,
				division: body.division,
				useremail: body.email,
			}

			const paymentSession = await prisma.paymentSession.create({
				data: mappedresponse,
			})
			tavaLogger(
				corelationId,
				'Response',
				url,
				{
					status: 200,
					data: { output: { session: paymentSession } },
				},
				templateType
			)
			return res.status(200).json({ output: { session: paymentSession } })
		} else if (selectedPaymentPortal === 'BANCSTAC') {
		}
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		throw (
			error?.response?.status ||
			error?.response?.data ||
			error?.message ||
			error
		)
	}
}

module.exports = {
	payment,
	callPayment,
}
