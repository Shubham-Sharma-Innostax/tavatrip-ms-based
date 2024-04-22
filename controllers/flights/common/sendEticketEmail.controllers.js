const { sendticketingemail } = require('../../../helpers/service.js')
const { tavaLogger } = require('../../../helpers/index.js')

const sendeticketemail = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const subflowRequest = {
			input: req,
			params: req,
			secrets: process.env,
			headers,
		}
		const sendEmailResponse = await sendticketingemail(
			subflowRequest,
			res,
			next,
			corelationId,
			url
		)
		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: { output: sendEmailResponse } },
			templateType
		)
		res.json({ output: sendEmailResponse })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}
module.exports = {
	sendeticketemail,
}
