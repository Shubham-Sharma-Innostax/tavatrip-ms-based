const amadeusFlights = require('./amadeus.flights.routes')
const commonFilght = require('./common.flights.routes')
const hotel = require('./hotel.routes')
const users = require('./users.routes')
const idp = require('./idp.routes')
const infrastructure = require('./infrastructure.routes')
const tboFlight = require('./tbo.flights.routes')

const selectionRoute = (app) => {
	app.use('/', amadeusFlights)
	app.use('/', commonFilght)
	app.use('/', hotel)
	app.use('/', users)
	app.use('/', idp)
	app.use('/', infrastructure)
	app.use('/', tboFlight)
}
module.exports = { selectionRoute }
