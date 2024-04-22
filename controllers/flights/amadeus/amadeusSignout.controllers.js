const { tavaLogger } = require('../../../helpers')
const axios = require('axios')
const XMLWriter = require('xml-writer')
const { xml2js } = require('xml-js')

const amadeussignout = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const signoutRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const RequestData = {
			input: signoutRequest,
			params: signoutRequest,
			secrets: process.env,
			headers,
		}

		const createSignoutAPIRequest = async function () {
			const sessionData =
				RequestData.input.body['soap:Envelope']['soap:Header']['awsse:Session']
			const securityToken = sessionData['awsse:SecurityToken']._text
			const sessionId = sessionData['awsse:SessionId']._text
			const sequenceNumber =
				parseInt(sessionData['awsse:SequenceNumber']._text) + 1
			function amadeusHeader() {
				const { v4: uuidv4 } = require('uuid')

				const generateCredentials = () => {
					const password = 'AMADEUS100'

					function generateUUID() {
						return uuidv4()
					}
					const messageID = generateUUID()
					const uniqueID = generateUUID()
					return {
						messageId: messageID,
						uniqueId: uniqueID,
					}
				}
				return generateCredentials()
			}
			const headerData = amadeusHeader()
			const createSoapEnvelope = (xmlWriter) => {
				xmlWriter
					.startElement('soap:Envelope')
					.writeAttribute(
						'xmlns:soap',
						'http://schemas.xmlsoap.org/soap/envelope/'
					)
				return xmlWriter
			}

			const createSoapHeader = (xmlWriter) => {
				xmlWriter
					.startElement(
						'soap:Header',
						'xmlns:soap',
						'http://schemas.xmlsoap.org/soap/envelope/'
					)
					.startElement('awsse:Session')
					.writeAttribute(
						'xmlns:awsse',
						'http://xml.amadeus.com/2010/06/Session_v3'
					)
					.writeAttribute('TransactionStatusCode', 'End')
					.startElement('awsse:SessionId')
					.text(sessionId)
					.endElement()
					.startElement('awsse:SequenceNumber')
					.text(sequenceNumber)
					.endElement()
					.startElement('awsse:SecurityToken')
					.text(securityToken)
					.endElement()
					.endElement()
					.startElement('add:MessageID')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(headerData.messageId) //
					.endElement()
					.startElement('add:Action')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text('http://webservices.amadeus.com/VLSSOQ_04_1_1A')
					.endElement()
					.startElement('add:To')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(RequestData.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
					.endElement()
					.startElement('link:TransactionFlowLink')
					.writeAttribute(
						'xmlns:link',
						'http://wsdl.amadeus.com/2010/06/ws/Link_v1'
					)
					.startElement('link:Consumer')
					.startElement('link:UniqueID')
					.text(headerData.uniqueId)
					.endElement()
					.endElement()
					.endElement()
					.startElement('AMA_SecurityHostedUser')
					.writeAttribute('xmlns', 'http://xml.amadeus.com/2010/06/Security_v1')
					.endElement()
					.endElement()

				return xmlWriter
			}

			const createSoapBody = (xmlWriter) => {
				xmlWriter
					.startElement('soap:Body')
					.startElement('Security_SignOut')
					.endElement()
					.endElement()

				return xmlWriter
			}

			const request = () => {
				const xmlWriter = new XMLWriter({
					indent: '  ',
				})

				createSoapEnvelope(xmlWriter)
				createSoapHeader(xmlWriter)
				createSoapBody(xmlWriter)

				xmlWriter.endElement()

				return xmlWriter.toString()
			}

			return request()
		}
		const signoutAPIRequest = await createSignoutAPIRequest()
		const CallSignoutSOAPAPI = {
			input: signoutAPIRequest,
			params: signoutRequest,
			secrets: process.env,
			headers,
		}

		const xmlToJson = (data = '') =>
			xml2js(data, {
				compact: true,
				textKey: '_text',
				cdataKey: '_text',
			})

		let signoutResponse
		let responseType = 'json'
		tavaLogger(
			corelationId,
			'Request',
			url,
			CallSignoutSOAPAPI.input,
			templateType
		)
		try {
			signoutResponse = await axios(
				`${CallSignoutSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
				{
					method: 'post',
					headers: {
						SOAPAction: `http://webservices.amadeus.com/VLSSOQ_04_1_1A`,
					},
					data: CallSignoutSOAPAPI.input,
				}
			).then(async (res) => {
				tavaLogger(corelationId, 'Response', url, res, templateType)
				return responseType === 'json'
					? xmlToJson(res.data)
					: {
							data: res.data,
							responseType: responseType,
					  }
			})
		} catch (error) {
			if (error.response) {
				const { status, data } = error?.response
				tavaLogger(corelationId, 'Error', url, error, templateType)
				throw res.status(status).json(xmlToJson(data))
			}
			throw error
		}
		const ReturnSuccessResponse = {
			output: signoutResponse,
			params: signoutRequest,
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
	amadeussignout,
}
