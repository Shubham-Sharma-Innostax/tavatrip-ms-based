const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient

const logsdetails = async (req, res, next) => {
	const templateType = 'travel'
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']

	try {
		const parseInputData = (inputData) => {
			const regex = /"(\w+)"\s*=\s*'([^']+)'(?:\s*(AND|OR))?/g
			const output = []
			let match
			while ((match = regex.exec(inputData)) !== null) {
				const [, key, value, operator] = match
				output.push({
					key,
					value,
					operator,
				})
			}
			return output
		}
		const formattedQuery = `"corelationId" = '${req.query.corelationId}'`
		const outputData = parseInputData(formattedQuery)
		let query = ''
		let preOperator = ''
		outputData.forEach((item) => {
			if (!item.value.includes('undefined')) {
				query += `${query ? preOperator : ''} "${item.key}" = '${item.value}'`
			}
			preOperator = item.operator
		})
		const isFormattedQueryExist = query ? `WHERE ${query}` : ''
		const sortObj = []
		let sortObjExpression = ''
		if (sortObj.length) {
			const orderByClause = sortObj
				.map((order) => {
					const [key, value] = Object.entries(order)[0]
					return `"${key}" ${value.toUpperCase()}`
				})
				.join(', ')
			sortObjExpression = `ORDER BY ${orderByClause}`
		}
		const size = parseInt(req.query.size) || 10
		const page = parseInt(req.query.page) || 1
		const skip = (page - 1) * size
		const getLoggingRecords = await prisma.$queryRawUnsafe(
			`SELECT * FROM "logging" ${isFormattedQueryExist} ${sortObjExpression} LIMIT ${size} OFFSET ${skip};`
		)
		let rowsCount = await prisma.$queryRawUnsafe(
			`SELECT count(*) from "logging" ${isFormattedQueryExist}`
		)
		rowsCount = Number(rowsCount[0].count)
		const countInfo = {
			count: rowsCount,
			totalPage: Math.ceil(rowsCount / size),
			currentPage: page,
			size: size,
		}
		const result = getLoggingRecords
		return res.send({ output: { countInfo, result } })
	} catch (error) {
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error?.data)
	}
}

const processSearchRequest = async (searchData, req) => {
	const output =
		await prisma.$queryRaw`SELECT * FROM function_a6c14702_b616_41d5_b7cc_77cd6ddec290 (${searchData});`

	const processedResult = await processResult(output, req)
	return processedResult
}

const processEmptySearchRequest = async (req) => {
	const { url, headers } = req
	const output =
		await prisma.$queryRaw`SELECT * FROM function_0e0f80fe_382e_4849_98f1_433c28d42558 ();`

	const processedResult = await processResult(output, req)
	return processedResult
}

const processResult = async (data, req) => {
	const { query } = req.params

	const sortedData = sortByCreatedAt(data, query.order)

	const paginatedResult = paginate(sortedData, query.page, query.size)

	return paginatedResult
}

const sortByCreatedAt = (data, order = 'asc') => {
	return data.sort((a, b) => {
		const dateA = new Date(a.tava_date).getTime()
		const dateB = new Date(b.tava_date).getTime()

		let comparison = dateA - dateB

		if (order === 'desc') {
			comparison = dateB - dateA
		}

		return comparison
	})
}

const paginate = (data, pageNumber = 1, pageSize = 10) => {
	const offset = (pageNumber - 1) * pageSize
	const paginatedData = data.slice(offset, offset + pageSize)
	const totalPages = Math.ceil(data.length / pageSize)
	return {
		count: data.length,
		totalPages,
		pageNumber,
		output: paginatedData,
	}
}

const logsdetailsv2 = async (req, res, next) => {
	try {
		const { headers, url, params, query } = req
		const searchData = params.query.search
		if (searchData?.length > 0) {
			const searchResult = await processSearchRequest(searchData, req)
			return res.send(searchResult)
		} else {
			const emptySearchResult = await processEmptySearchRequest(req)
			return res.send(emptySearchResult)
		}
	} catch (error) {
		const { url, headers } = req
		const correlationId = headers['x-request-id']
		const templateType = 'travel'

		if (error?.statusCode && error?.message) {
			return res.status(error.statusCode).json(error)
		}

		const errorMessage = error?.message
		if (errorMessage && errorMessage.includes(`Message:`)) {
			return res
				.status(400)
				.json(errorMessage.split(`Message:`)[1] || errorMessage)
		}

		return res.status(400).json(errorMessage || error)
	}
}

module.exports = {
	logsdetails,
	logsdetailsv2,
}
