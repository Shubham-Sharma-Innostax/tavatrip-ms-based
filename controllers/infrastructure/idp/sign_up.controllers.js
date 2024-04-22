const { tavaLogger } = require('../../../helpers')
const { idpAuthentication } = require('../../../services/tbo/idpAuthentication')

const signup = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const request = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const idpAuthenticationResponse = await idpAuthentication(request, 'signup')

		if (idpAuthenticationResponse.response.error)
			throw idpAuthenticationResponse.response.error
		const ReturnSuccessResponse = {
			output: idpAuthenticationResponse,
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
		const ReturnErrorResponse = {}
		const createErrorData = ReturnErrorResponse
		delete createErrorData.params
		delete createErrorData.secrets
		delete createErrorData.headers
		if (!res.headersSent)
			return res
				.status(400)
				.json(Object.keys(createErrorData).length ? createErrorData : error)
	}
}

module.exports = {
	signup,
}
