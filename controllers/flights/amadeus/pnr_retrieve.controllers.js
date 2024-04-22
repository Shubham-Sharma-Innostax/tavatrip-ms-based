const { tavaLogger } = require('../../../helpers')
const XMLWriter = require('xml-writer')
const { callPNRRetrieveAPI } = require('../../../services/amadeus/pnrRetrieve')

const pnrRetrieve = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const retrieveRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const PNRRetrieveRequest = {
			input: retrieveRequest,
			params: retrieveRequest,
			secrets: process.env,
			headers,
		}

		const createPNRRetrieveAPIRequest = async function () {
			let createSecondSoapHeader
			const data = PNRRetrieveRequest.input.originalUrl
			const regex = /pnr=([^&]+)/
			const headerData = PNRRetrieveRequest.input.body.output
			if (!headerData) {
				const sessionData =
					PNRRetrieveRequest.input.body['soap:Envelope']['soap:Header'][
						'awsse:Session'
					]
				const securityToken = sessionData['awsse:SecurityToken']._text
				const sessionId = sessionData['awsse:SessionId']._text
				const sequenceNumber =
					parseInt(sessionData['awsse:SequenceNumber']._text) + 1

				createSecondSoapHeader = (xmlWriter) => {
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
						.writeAttribute('TransactionStatusCode', 'InSeries')
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
						.text(generalHeaderData.messageId)
						.endElement()
						.startElement('add:Action')
						.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
						.text('http://webservices.amadeus.com/PNRRET_21_1_1A')
						.endElement()
						.startElement('add:To')
						.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
						.text(
							PNRRetrieveRequest.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO'
						)
						.endElement()
						.startElement('link:TransactionFlowLink')
						.writeAttribute(
							'xmlns:link',
							'http://wsdl.amadeus.com/2010/06/ws/Link_v1'
						)
						.startElement('link:Consumer')
						.startElement('link:UniqueID')
						.text(generalHeaderData.uniqueId)
						.endElement()
						.endElement()
						.endElement()
						.startElement('AMA_SecurityHostedUser')
						.writeAttribute(
							'xmlns',
							'http://xml.amadeus.com/2010/06/Security_v1'
						)
						.endElement()
						.endElement()
					return xmlWriter
				}
			}

			function amadeusHeader() {
				const { v4: uuidv4 } = require('uuid')
				const generateCredentials = () => {
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
			const generalHeaderData = amadeusHeader()
			const expectedFlow = PNRRetrieveRequest.params.query.flow

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
					.startElement('ses:Session')
					.writeAttribute(
						'xmlns:ses',
						'http://xml.amadeus.com/2010/06/Session_v3'
					)
					.writeAttribute('TransactionStatusCode', 'Start')
					.endElement()
					.startElement('add:MessageID')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(headerData.messageID)
					.endElement()
					.startElement('add:Action')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text('http://webservices.amadeus.com/PNRRET_21_1_1A')
					.endElement()
					.startElement('add:To')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(
						PNRRetrieveRequest.secrets.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO'
					)
					.endElement()
					.startElement('link:TransactionFlowLink')
					.writeAttribute(
						'xmlns:link',
						'http://wsdl.amadeus.com/2010/06/ws/Link_v1'
					)
					.endElement()
					.startElement('oas:Security')
					.writeAttribute(
						'xmlns:oas',
						'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd'
					)
					.startElement('oas:UsernameToken')
					.writeAttribute(
						'xmlns:oas1',
						'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'
					)
					.writeAttribute('oas1:Id', 'UsernameToken-1')
					.startElement('oas:Username')
					.text('WSIOOTAV')
					.endElement()
					.startElement('oas:Nonce')
					.writeAttribute(
						'EncodingType',
						'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary'
					)
					.text(headerData.base64Nonce)
					.endElement()
					.startElement('oas:Password')
					.writeAttribute(
						'Type',
						'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest'
					)
					.text(headerData.hashedPassword)
					.endElement()
					.startElement('oas1:Created')
					.text(headerData.created)
					.endElement()
					.endElement()
					.endElement()
					.startElement('AMA_SecurityHostedUser')
					.writeAttribute('xmlns', 'http://xml.amadeus.com/2010/06/Security_v1')
					.startElement('UserID')
					.writeAttribute('POS_Type', '1')
					.writeAttribute('PseudoCityCode', 'DELVS38SM')
					.writeAttribute('AgentDutyCode', 'SU')
					.writeAttribute('RequestorType', 'U')
					.endElement()
					.endElement()
					.endElement()
				return xmlWriter
			}

			const createSoapbody = (xmlWriter, expectedFlow, pnr) => {
				let soapBody = xmlWriter
					.startElement('soap:Body')
					.startElement('PNR_Retrieve')
					.startElement('retrievalFacts')
					.startElement('retrieve')
					.startElement('type')
					.text('2')
					.endElement()
					.endElement()
					.startElement('reservationOrProfileIdentifier')
					.startElement('reservation')

				if (expectedFlow === 'ticket') {
					soapBody = soapBody
						.startElement('controlNumber')
						.text(PNRRetrieveRequest.input.body.internalOutput.pnr)
						.endElement()
				} else {
					soapBody = soapBody
						.startElement('controlNumber')
						.text(data.match(regex)[1])
						.endElement()
				}

				soapBody = soapBody
					.endElement()
					.endElement()
					.endElement()
					.endElement()
					.endElement()

				return soapBody
			}
			const request = () => {
				const xmlWriter = new XMLWriter({ indent: '  ' })
				createSoapEnvelope(xmlWriter)
				if (expectedFlow === 'ticket') {
					createSecondSoapHeader(xmlWriter)
				} else {
					createSoapHeader(xmlWriter)
				}
				createSoapbody(xmlWriter)
				xmlWriter.endElement()
				return xmlWriter.toString()
			}
			return request()
		}
		const pnrRetrieveRequest = await createPNRRetrieveAPIRequest()
		const CallPNRRetrieveSOAPAPIEndpoint = {
			input: pnrRetrieveRequest,
			params: retrieveRequest,
			secrets: process.env,
			headers,
		}

		let pnrRetrieveAPIResponse = await callPNRRetrieveAPI(
			corelationId,
			CallPNRRetrieveSOAPAPIEndpoint,
			CallPNRRetrieveSOAPAPIEndpoint.input,
			templateType,
			url,
			res
		)

		const ReturnSuccessResponse = {
			output: pnrRetrieveAPIResponse,
			params: retrieveRequest,
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
	pnrRetrieve,
}
