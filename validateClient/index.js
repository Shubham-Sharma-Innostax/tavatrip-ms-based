const CryptoJS = require('crypto-js')
const secretKey = process.env.CLIENT_VALIDATION_KEY
const env = process.env.ENV

const validateKeyAndExpiration = (key) => {
	if (['PRODUCTION', 'STAGING'].includes(env)) {
		try {
			const [encryptedKey, encryptedTimestamp] = key.split('.')
			const decryptedKey = CryptoJS.AES.decrypt(
				encryptedKey,
				secretKey
			).toString(CryptoJS.enc.Utf8)
			const decryptedTimestamp = CryptoJS.AES.decrypt(
				encryptedTimestamp,
				secretKey
			).toString(CryptoJS.enc.Utf8)
			const expirationTimestamp = parseInt(decryptedTimestamp, 10)
			const isValid =
				decryptedKey === secretKey + '.' + expirationTimestamp &&
				Math.floor(Date.now() / 1000) < expirationTimestamp
			return isValid
		} catch (error) {
			console.error(error)
			return false
		}
	} else return true
}

const validateClient = async (req, res, next) => {
	const { headers } = req
	const key = headers['x-referer'] || ''
	const isValidHost = validateKeyAndExpiration(key)
	if (!isValidHost)
		return res
			.status(401)
			.json({ error: "You don't have permission to access this resource" })
	else next()
}

module.exports = validateClient
