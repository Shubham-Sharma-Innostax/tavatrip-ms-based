const { atcrefundsubflow } = require('../../../helpers/service.js')
const { tavaLogger } = require('../../../helpers/index.js')
const axios = require('axios')
const XMLWriter = require('xml-writer')
const { xml2js, json2xml } = require('xml-js')
const { callSignout } = require('../../../services/amadeus/signout.js')

const atcInitRefund = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const refundRequest = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const Subflow = {
			input: refundRequest,
			params: refundRequest,
			secrets: process.env,
			headers,
		}
		const created = await atcrefundsubflow(
			Subflow,
			res,
			next,
			corelationId,
			url
		)
		const TicketIgnoreRefundData = {
			input: created,
			params: refundRequest,
			secrets: process.env,
			headers,
		}

		const createTicketIgnoreRefundRequest = async function () {
			const sessionData =
				TicketIgnoreRefundData.input.internalOutput.input['soap:Envelope'][
					'soap:Header'
				]['awsse:Session']
			const refundBreakup =
				TicketIgnoreRefundData.input.internalOutput.input['soap:Envelope'][
					'soap:Body'
				]
			const securityToken = sessionData['awsse:SecurityToken']._text
			const sessionId = sessionData['awsse:SessionId']._text
			const sequenceNumber =
				parseInt(sessionData['awsse:SequenceNumber']._text) + 1
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
					.text(headerData.messageId)
					.endElement()
					.startElement('add:Action')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text('http://webservices.amadeus.com/Ticket_IgnoreRefund_3.0')
					.endElement()
					.startElement('add:To')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(process.env.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
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
				xmlWriter.startDocument()
				xmlWriter.startElement('soap:Body')
				xmlWriter.startElement('AMA_TicketIgnoreRefundRQ')
				xmlWriter.writeAttribute(
					'xmlns',
					'http://xml.amadeus.com/2010/06/TicketGTP_v3'
				)
				xmlWriter.writeAttribute('Version', '3.000')
				xmlWriter.endElement()
				xmlWriter.endElement()
				xmlWriter.endDocument()
				return xmlWriter
			}

			const request = () => {
				const xmlWriter = new XMLWriter({ indent: '  ' })

				createSoapEnvelope(xmlWriter)
				createSoapHeader(xmlWriter)
				createSoapBody(xmlWriter)

				xmlWriter.endElement()

				return xmlWriter.toString()
			}
			const reqForIgnoreRefund = request()

			return {
				req: reqForIgnoreRefund,
				refundBreakup: refundBreakup,
			}
		}
		const ticketIgnoreRefundRequest = await createTicketIgnoreRefundRequest()
		const CallIgroreRefundSOAPAPI = {
			input: ticketIgnoreRefundRequest,
			params: refundRequest,
			secrets: process.env,
			headers,
		}

		const xmlToJson = (data = '') =>
			xml2js(data, {
				compact: true,
				textKey: '_text',
				cdataKey: '_text',
			})

		let ticketIgnoreRefundResponse
		let responseType = 'json'
		tavaLogger(
			corelationId,
			'Request',
			url,
			CallIgroreRefundSOAPAPI.input.req,
			templateType
		)
		try {
			ticketIgnoreRefundResponse = await axios(
				`${CallIgroreRefundSOAPAPI.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
				{
					method: 'post',
					headers: {
						SOAPAction: `http://webservices.amadeus.com/Ticket_IgnoreRefund_3.0`,
					},
					data: CallIgroreRefundSOAPAPI.input.req,
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
		const TicketIgnoreRefundSuccessResponse = {
			input: ticketIgnoreRefundResponse,
			params: refundRequest,
			secrets: process.env,
			headers,
		}
		let successExternalOutput
		if (
			TicketIgnoreRefundSuccessResponse.input['soap:Envelope']['soap:Body'][
				'soap:Fault'
			]?.faultcode?._text ||
			TicketIgnoreRefundSuccessResponse.input['soap:Envelope']['soap:Body']
				?.AMA_TicketIgnoreRefundRS?.Errors?.['ama:Error'] ||
			!TicketIgnoreRefundSuccessResponse.input['soap:Envelope']['soap:Body']
				?.AMA_TicketIgnoreRefundRS?.Success
		) {
			const checkResponse = async () => {
				const inputData = {
					...TicketIgnoreRefundSuccessResponse,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const FinalTicketIgnoreResponse = {
					input: inputData,
					params: refundRequest,
					secrets: process.env,
					headers,
				}

				const mapper = async function () {
					const req = FinalTicketIgnoreResponse.input.input
					const res =
						FinalTicketIgnoreResponse.input.input['soap:Envelope']['soap:Body']
					return {
						req: req,
						res: res,
					}
				}
				const finalResponse = await mapper()
				const CallSignoutRESTAPIEndpoint = {
					input: finalResponse,
					params: refundRequest,
					secrets: process.env,
					headers,
				}

				let signoutResponse = await callSignout(
					corelationId,
					CallSignoutRESTAPIEndpoint,
					CallSignoutRESTAPIEndpoint.input.req,
					templateType
				)

				const FinalAPIResponse = {
					output: signoutResponse,
					params: refundRequest,
					secrets: process.env,
					headers,
					input: finalResponse,
				}

				const ReturnSuccessResponse = {
					output: FinalAPIResponse.input.res,
					params: refundRequest,
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

				if (
					Object.keys(updatedReturnSuccessRes).length ||
					finalResponse.length
				) {
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
						? { output: finalResponse }
						: updatedReturnSuccessRes
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			successExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		const GetRecordValue = {
			input: ticketIgnoreRefundRequest,
			params: refundRequest,
			secrets: process.env,
			headers,
		}
		const pickedValue = GetRecordValue.input.refundBreakup
		const AddMultiElementsData = {
			input: ticketIgnoreRefundResponse,
			params: refundRequest,
			secrets: process.env,
			headers,
			pickedValue: pickedValue,
		}

		const CreateAddMultiElementsRequest = async function () {
			const ignoreRefund = AddMultiElementsData.input
			const refundBreakup = AddMultiElementsData.pickedValue
			const sessionData =
				ignoreRefund['soap:Envelope']['soap:Header']['awsse:Session']
			const securityToken = sessionData['awsse:SecurityToken']._text
			const sessionId = sessionData['awsse:SessionId']._text
			const sequenceNumber =
				parseInt(sessionData['awsse:SequenceNumber']._text) + 1
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
					.text(headerData.messageId)
					.endElement()
					.startElement('add:Action')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text('http://webservices.amadeus.com/PNRADD_21_1_1A')
					.endElement()
					.startElement('add:To')
					.writeAttribute('xmlns:add', 'http://www.w3.org/2005/08/addressing')
					.text(process.env.AMADEUS_API_BASE_URL + '/1ASIWTAVIOO')
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

			const createSoapbody = (xmlWriter) => {
				xmlWriter
					.startElement('soap:Body')
					.startElement('PNR_AddMultiElements')
					.startElement('pnrActions')
					.writeElement('optionCode', '20')
					.endElement()
					.endElement()
					.endElement()
			}

			const request = () => {
				const xmlWriter = new XMLWriter({ indent: ' ' })
				createSoapEnvelope(xmlWriter)
				createSoapHeader(xmlWriter)
				createSoapbody(xmlWriter)
				xmlWriter.endElement()
				return xmlWriter.toString()
			}
			const addMultiElementReq = request()
			return {
				refundDetails: refundBreakup,
				req: addMultiElementReq,
			}
		}
		const addMultiElementsRequest = await CreateAddMultiElementsRequest()
		const CallAddMultiElementsSOAPAPIEndpoint = {
			input: addMultiElementsRequest,
			params: refundRequest,
			secrets: process.env,
			headers,
		}

		const xmlToJsonAddMultiElementsAPI = (data = '') =>
			xml2js(data, {
				compact: true,
				textKey: '_text',
				cdataKey: '_text',
			})

		let addMultiElementsAPIResponse
		let responseTypeJSON = 'json'
		tavaLogger(
			corelationId,
			'Request',
			url,
			CallAddMultiElementsSOAPAPIEndpoint.input.req,
			templateType
		)
		try {
			addMultiElementsAPIResponse = await axios(
				`${CallAddMultiElementsSOAPAPIEndpoint.secrets.AMADEUS_API_BASE_URL}/1ASIWTAVIOO?`,
				{
					method: 'post',
					headers: {
						SOAPAction: `http://webservices.amadeus.com/PNRADD_21_1_1A`,
					},
					data: CallAddMultiElementsSOAPAPIEndpoint.input.req,
				}
			).then(async (res) => {
				tavaLogger(corelationId, 'Response', url, res, templateType)
				return responseTypeJSON === 'json'
					? xmlToJsonAddMultiElementsAPI(res.data)
					: {
							data: res.data,
							responseType: responseTypeJSON,
					  }
			})
		} catch (error) {
			if (error.response) {
				const { status, data } = error?.response
				tavaLogger(corelationId, 'Error', url, error, templateType)
				throw res.status(status).json(xmlToJsonAddMultiElementsAPI(data))
			}
			throw error
		}
		const AddMultiErrorResponse = {
			input: addMultiElementsAPIResponse,
			params: refundRequest,
			secrets: process.env,
			headers,
		}
		let addMultiErrorResponseExternalOutput
		if (
			AddMultiErrorResponse.input['soap:Envelope']['soap:Body']['soap:Fault']
				?.faultcode?._text ||
			(AddMultiErrorResponse.input['soap:Envelope']['soap:Body'].PNR_Reply
				?.generalErrorInfo &&
				AddMultiErrorResponse.input['soap:Envelope']['soap:Body'].PNR_Reply
					?.generalErrorInfo?.errorOrWarningCodeDetails?.errorDetails
					?.errorCategory._text === 'EC')
		) {
			const checkResponse = async () => {
				const inputData = {
					...AddMultiErrorResponse,
				}
				delete inputData.params
				delete inputData.secrets
				delete inputData.headers

				const ReturnSuccessResponse = {
					internalOutput: inputData,
					params: refundRequest,
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

				if (
					Object.keys(updatedReturnSuccessRes).length ||
					finalResponse.length
				) {
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
						? { output: finalResponse }
						: updatedReturnSuccessRes
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			addMultiErrorResponseExternalOutput = resultCheck
			return res.send(resultCheck)
		}
		const GetRefundDetails = {
			input: addMultiElementsRequest,
			params: refundRequest,
			secrets: process.env,
			headers,
		}
		const ReturnSuccessResponse = {
			pickedValue: GetRefundDetails.input.refundDetails,
			params: refundRequest,
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
	atcInitRefund,
}
