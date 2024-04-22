const { tavaLogger } = require('../../../helpers')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const { Base64 } = require('js-base64')

const amadeusheaderdata = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const request = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const DataRequest = {
			input: request,
			params: request,
			secrets: process.env,
			headers,
		}

		const createHeaderData = async function () {
			const data = DataRequest.input

			function amadeusHeader(data) {
				const generateCredentials = () => {
					const password = process.env.AMADEUS_PASSWORD

					function generateUUID() {
						return uuidv4()
					}

					const messageID = generateUUID()
					const uniqueID = generateUUID()

					const nonce = Math.random().toString(15).slice(2)
					const base64Nonce = Base64.encode(nonce)

					const time = new Date().toISOString()
					const created = time.split('.')[0] + 'Z'

					const buffer = Buffer.concat([
						Buffer.from(nonce),
						Buffer.from(created),
						crypto.createHash('sha1').update(password).digest(),
					])

					const hashedPassword = crypto
						.createHash('sha1')
						.update(buffer)
						.digest('base64')

					return {
						messageID,
						uniqueID,
						base64Nonce,
						hashedPassword,
						created,
					}
				}

				return generateCredentials()
			}

			return amadeusHeader(data)
		}
		const headerResponse = await createHeaderData()
		const ReturnSuccessResponse = {
			output: headerResponse,
			params: request,
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

		if (Object.keys(updatedReturnSuccessRes).length || finalResponse.length) {
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
				? res.json({ output: finalResponse })
				: res.json(updatedReturnSuccessRes)
		} else return res.json('successfully run')
	} catch (error) {
		const templateType = 'travel'
		const { url, headers } = req
		let corelationId = headers['x-request-id']
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

module.exports = {
	amadeusheaderdata,
}
