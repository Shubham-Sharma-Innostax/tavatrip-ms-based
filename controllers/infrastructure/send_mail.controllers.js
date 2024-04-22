const { tavaLogger } = require('../../helpers')
const fs = require('fs')
const RabbitMQClient = require('../../rabbitmq/client')
const ejs = require('ejs')
const { convert } = require('html-to-text')

const sendmail = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const emailHeader = {
			from: email,
			to: 'support@tavatrip.com',
			subject: 'Query',
			text: `phone : ${body.phoneNumber} message: ${body.message}`,
		}
		const fileContent = fs.readFileSync(
			__dirname.split(`\controllers`)[0] +
				`/htmlfiles/CreateEmailMessage_e06d11a8_1764_435f_9d22_43aa1ccd0ea2.ejs`,
			`utf8`
		)
		const htmlText = ejs.render(fileContent, {
			body,
		})
		let htmlContent = String(htmlText)
		if (htmlText.startsWith('&lt;'))
			htmlContent = convert(htmlContent, { wordwrap: 130 })
		let attachments = []

		const emailServer = {
			host: process.env.EMAIL_HOST,
			port: process.env.EMAIL_PORT,
			auth: {
				user: process.env.EMAIL_USERNAME,
				pass: process.env.EMAIL_PASSWORD,
			},
		}
		const messageContent = {
			...emailHeader,
			emailServer: emailServer,
			html: htmlContent,
			attachments: [...attachments],
		}
		const queueResponse = await RabbitMQClient.produce({
			data: messageContent,
			queueName: process.env.RABBITMQ_EMAIL_QUEUE,
		})
		if (queueResponse.emailResponse.error || queueResponse.error)
			return res.json(queueResponse.emailResponse.error || queueResponse.error)

		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: { output: queueResponse } },
			templateType
		)
		return res.json({ output: queueResponse })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}
module.exports = {
	sendmail,
}
