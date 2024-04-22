const getUrlAndParams = (url) => {
	const [endpoint, params] = url.split('?')
	const splitEndpoint = endpoint.split('/')
	const [serviceName] = splitEndpoint.slice(-1)
	return { serviceName, params }
}

module.exports = { getUrlAndParams }
