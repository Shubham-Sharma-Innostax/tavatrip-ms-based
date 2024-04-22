require('dotenv').config()

const helmet = require('helmet')
const {
	createOrReplaceProcedures,
} = require('./database/storedProceduresScript.js')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const { selectionRoute } = require('./routes')
const RabbitMQClient = require('./rabbitmq/client')
require('./dbConnection/dbConnect')

const port = process.env.PORT

const app = express()
const corsOptions = {
	origin: '*',
	allowedHeaders: [
		'x-request-id',
		'content-type',
		'Authorization',
		'x-referer',
	],
}

app.set('view engine', 'ejs')
app.use(helmet())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ limit: '10mb' }))
app.use(bodyParser.text({ type: 'application/xml' }))
app.use(cors(corsOptions))
app.use('/', express.static('public'))
app.get(selectionRoute(app))
app.listen(port, async function () {
	await RabbitMQClient.initialize()
	console.log(`Server started on port ${port}`)
})
createOrReplaceProcedures()
module.exports = app
