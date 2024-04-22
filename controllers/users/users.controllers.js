const aws = require('aws-sdk')
const RabbitMQClient = require('../../rabbitmq/client')
const { tavaLogger } = require('../../helpers')
const prismaClient = require('../../prismaClient')
const { idpAuthentication } = require('../../services/tbo/idpAuthentication')
const { prisma } = prismaClient

const addtravelers = async (req, res, next) => {
	// Initialize variables
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']

	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const data = {
			...body,
			userId: params.id,
		}
		const addTravelerResponse = await prisma.travelers.create({
			data: data,
		})

		// Log the final response to the database
		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: addTravelerResponse },
			templateType
		)

		// Send the final response back to the client
		return res.json({ output: addTravelerResponse })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

const getuserdetails = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)

		const authentication = await idpAuthentication(req, 'authorize')
		if (authentication.response.error) throw authentication.response.error

		const user = await prisma.users.findUnique({
			where: {
				id: params.id, // Assuming id is an integer
			},
		})
		let travelers = []
		if (Object.keys(user).length === 0 && user.constructor === Object) {
			throw new Error('User not found')
		} else {
			travelers = await prisma.travelers.findMany({
				where: {
					id: user.id, // Assuming id is an integer
				},
			})
		}

		const response = { user, travelers }
		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: response },
			templateType
		)

		// Send the final response back to the client
		return res.json({ output: response })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

const updateuserdetails = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const authentication = await idpAuthentication(req, 'authorize')
		if (authentication.response.error) throw authentication.response.error

		const { profilePic, profileName } = body

		const resp = (resdata) => {
			if (profilePic) {
				const body = profilePic.split(',')[1]
				const buffer = Buffer.from(body, 'base64')
				return { buffer, fileName: profileName }
			}
		}
		const updateProfile = resp({ profilePic, profileName })
		const defaultAWSRegion = 'ap-south-1'
		const S3 = new aws.S3({
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			signatureVersion: 'v4',
			region: process.env.AWS_REGION || defaultAWSRegion,
		})

		const uploadPdf = {
			Bucket: 'testuploadpdftava',
			Key: updateProfile.fileName,
			Body: updateProfile.buffer,
		}

		S3.upload(uploadPdf, (err, data) => {
			if (err) console.error('Error uploading file to S3: ', err)
			else console.log('File uploaded successfully to S3:', data.Location)
		})

		const urlParams = {
			Bucket: 'testuploadpdftava',
			Key: updateProfile.fileName,
		}

		const uploadMessage = S3.getSignedUrl('getObject', urlParams)

		// Update Body for profile data
		body.profilePic = uploadMessage

		const updateDetaile = await prisma.users.update({
			where: {
				id: params.id,
			},
			data: body,
		})

		tavaLogger(
			corelationId,
			'Response',
			url,
			{ status: 200, data: { output: updateDetaile } },
			templateType
		)
		return res.status(200).json({ output: { ...updateDetaile } })
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}
module.exports = {
	addtravelers,
	getuserdetails,
	updateuserdetails,
}
