const { setDataInCache } = require('../../../helpers/setDataInCache')
const { v4: uuidv4 } = require('uuid')
const { getDataFromCache } = require('../../../helpers/getDataFromCache')
const { tavaLogger } = require('../../../helpers')
const mongoose = require('mongoose')

const sessioncreate = async (req, res, next) => {
	const finalResponse = []
	const templateType = 'travel'
	const request = req
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		const createRecord = {
			input: request,
			params: request,
			secrets: process.env,
			headers,
		}
		const sessionRequestBody = {
			modelName: `sm1`,
			data: createRecord.input.body,
		}
		const ModelDataSchema = new mongoose.Schema({}, { strict: false })

		const dataModelQuery =
			mongoose.models[sessionRequestBody.modelName] ||
			mongoose.model(sessionRequestBody.modelName, ModelDataSchema)
		let outputData = await dataModelQuery
			.insertMany(inputData_374e8f09_82fa_4f31_9f29_3cffbbef8d9c.data)
			.then((res) => res)
			.catch((err) => {
				throw new Error('Failed to insert data', err)
			})
		const ReturnSuccessResponse = {
			output: outputData,
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
			return finalResponse.length
				? res.json({ output: finalResponse })
				: res.json(updatedReturnSuccessRes)
		} else return res.json('successfully run')
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}

const sessiondelete = async (req, res, next) => {
	const finalResponse = []
	const templateType = 'travel'
	const request = req
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']

	try {
		const DeleteMultiRecordsByQuery = {
			input: request,
			params: request,
			secrets: process.env,
			headers,
		}
		const inputData = {
			modelName: `sm1`,
			conditionField: {
				sessionId: DeleteMultiRecordsByQuery.params.params.id,
			},
		}
		const ModelDataSchema = new mongoose.Schema({}, { strict: false })

		const dataModel_f1fe29ad_8d18_430d_9b37_68f2abb00f64 =
			mongoose.models[inputData.modelName] ||
			mongoose.model(inputData.modelName, ModelDataSchema)
		let outpouData = await dataModel_f1fe29ad_8d18_430d_9b37_68f2abb00f64
			.deleteMany(inputData.conditionField)
			.then((res) => res)
			.catch((err) => {
				throw new Error('Failed to delete data.', err)
			})
		const ReturnSuccessResponse = {
			output: outpouData,
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
			return finalResponse.length
				? res.json({ output: finalResponse })
				: res.json(updatedReturnSuccessRes)
		} else return res.json('successfully run')
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}
const sessionfetch = async (req, res, next) => {
	const finalResponse = []
	const templateType = 'travel'
	const request = req
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		const finalResponse = []
		const templateType = 'travel'
		const request = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']

		const sessionFetchRequest = {
			input: request,
			params: request,
			secrets: process.env,
			headers,
		}

		const sessionMapper = async function () {
			const sessionEncodedId = sessionFetchRequest.params.params.id
			function extractUuidAndDecodedIP(sessionString) {
				const uuid = sessionString.substring(0, 36)
				const encodedIP = sessionString.substring(37)
				const decodedIP = atob(encodedIP)
				return {
					uuid: uuid,
					decodedIP: decodedIP,
				}
			}
			return extractUuidAndDecodedIP(sessionEncodedId)
		}
		const sessionMapperResponse = await sessionMapper()
		const GetCacheData = {
			input: sessionMapperResponse,
			params: request,
			secrets: process.env,
			headers,
		}
		const cacheKey = GetCacheData.input.uuid
		const outputData = await getDataFromCache(cacheKey)
		const formattedRequestBody = {
			input: outputData,
			params: request,
			secrets: process.env,
			headers,
			output: sessionMapperResponse,
		}

		const updatedSessionDataMapper = async function () {
			const data = formattedRequestBody.input
			const decodedIP = formattedRequestBody.output.decodedIP
			const ipSpecificData = data?.allIps[decodedIP]
			if (data && ipSpecificData && Object.keys(ipSpecificData).length !== 0) {
				return {
					sessionData: data.allIps[decodedIP],
				}
			} else {
				return {
					sessionData: 'EXPIRED',
				}
			}
		}
		const formattedOutputData = await updatedSessionDataMapper()
		const sessionDataRequestBody = {
			input: formattedOutputData,
			params: request,
			secrets: process.env,
			headers,
		}
		if (sessionDataRequestBody.input.sessionData === 'EXPIRED') {
			const checkResponse = async () => {
				const error = new Error()
				error.statusCode = '410'
				error.message = 'Session Expired'
				return { data: error }
			}
			const resultCheck = await checkResponse()
			return res.send(resultCheck)
		}

		if (sessionDataRequestBody.input.sessionData !== 'EXPIRED') {
			const checkResponse = async () => {
				const GetRecordValue = {
					input: sessionDataRequestBody.input,
					params: request,
					secrets: process.env,
					headers,
				}
				const pickedValue = GetRecordValue.input.sessionData
				const ReturnSuccessResponse = {
					session: pickedValue,
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

				if (
					Object.keys(updatedReturnSuccessRes).length ||
					finalResponse.length
				) {
					return finalResponse.length
						? { output: finalResponse }
						: updatedReturnSuccessRes
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			return res.send(resultCheck)
		}
		return res.json(
			'Node has completed its execution without any response. No response node (e.g., success response, error response) connected to the service.'
		)
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}
const sessionupdate = async (req, res, next) => {
	const finalResponse = []
	const templateType = 'travel'
	const request = req
	const { body, url, params, method, headers } = req
	let corelationId = headers['x-request-id']
	try {
		const finalResponse = []
		const templateType = 'travel'
		const request = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']

		const sessionupdateRequest = {
			input: request,
			params: request,
			secrets: process.env,
			headers,
		}

		const sessionExtractionMapper = async function () {
			const sessionEncodedIp = sessionupdateRequest.params.params.id
			function extractUuidAndDecodedIP(sessionString) {
				const uuid = sessionString.substring(0, 36)
				const encodedIP = sessionString.substring(37)
				const decodedIP = atob(encodedIP)
				return {
					sessionId: uuid,
					decodedIP: decodedIP,
				}
			}
			return extractUuidAndDecodedIP(sessionEncodedIp)
		}
		const sessionExtractionResponse = await sessionExtractionMapper()
		const GetCacheData = {
			input: sessionExtractionResponse,
			params: request,
			secrets: process.env,
			headers,
		}
		const cacheKey = GetCacheData.input.sessionId
		const outputData = await getDataFromCache(cacheKey)
		const formattedRequestBody = {
			input: outputData,
			params: request,
			secrets: process.env,
			headers,
			output: sessionExtractionResponse,
		}

		const updatedSessionDataMapper = async function () {
			const data = formattedRequestBody.input
			const currentIp = formattedRequestBody.output.decodedIP
			const parentIp = formattedRequestBody.params.body.parentIp
			const sessionId = formattedRequestBody.output.sessionId
			if (data) {
				return {
					sessionDataForIp: data,
					currentIp: currentIp,
					parentIp: parentIp,
					sessionId: sessionId,
				}
			} else {
				return {
					sessionDataForIp: 'EXPIRED',
				}
			}
		}
		const formattedOutputData = await updatedSessionDataMapper()
		const sessionDataRequestBody = {
			input: formattedOutputData,
			params: request,
			secrets: process.env,
			headers,
		}

		if (sessionDataRequestBody.input.sessionDataForIp === 'EXPIRED') {
			const checkResponse = async () => {
				const error = new Error()
				error.statusCode = '410'
				error.message = 'Session Expired'
				return { data: error }
			}
			const resultCheck = await checkResponse()
			return res.send(resultCheck)
		}

		let externalOutput_0c9a667f_9671_4419_9518_5529ad955038
		if (!(sessionDataRequestBody.input.sessionDataForIp === 'EXPIRED')) {
			const checkResponse = async () => {
				const GetRecordValue = {
					input: sessionDataRequestBody.input,
					params: request,
					secrets: process.env,
					headers,
				}
				const formattedSessionRequest = {
					input: GetRecordValue,
					params: request,
					secrets: process.env,
					headers,
				}
				let externalOutput_42793fac_2ec3_4ccb_aad7_36810b066fb0
				if (
					formattedSessionRequest.input.parentIp ===
					formattedSessionRequest.input.currentIp
				) {
					const checkResponse = async () => {
						const sessionStoreDataMapper = async function () {
							const sessionData =
								formattedSessionRequest.input.input.sessionDataForIp
							const currentSessionIp =
								formattedSessionRequest.input.input.currentIp
							const sessionId = formattedSessionRequest.input.input.sessionId
							const body = formattedSessionRequest.params.body.data
							const _ = require('lodash')
							if (!sessionData) {
								const error = new Error()
								error.statusCode = '410'
								error.message = 'Session Expired'
								throw error
							}
							const currentSessionData = _.cloneDeep(
								sessionData.allIps[currentSessionIp]
							)
							const updateSessionData = (alreadyAvailableData) => {
								const updatedSessionData = {
									...alreadyAvailableData,
									reduxState: body,
								}
								return updatedSessionData
							}

							const ipCacheUpdated = updateSessionData(currentSessionData)
							sessionData.allIps[currentSessionIp] = ipCacheUpdated
							return { sessionDataUpdated: sessionData, sessionId: sessionId }
						}
						const sessionStoreDataResponse = await sessionStoreDataMapper()
						const SetCacheData = {
							input: sessionStoreDataResponse,
							params: request,
							secrets: process.env,
							headers,
						}
						const cacheKey = SetCacheData.input.sessionId
						const cacheExpireTime = 15 * 60
						const fetchData = SetCacheData.input.sessionDataUpdated
						const outputData = await setDataInCache(
							fetchData,
							cacheKey,
							cacheExpireTime
						)
						const ReturnSuccessResponse = {
							output: outputData,
							params: request,
							secrets: process.env,
							headers,
						}
						const updatedReturnSuccessRes = { ...ReturnSuccessResponse }

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
							return finalResponse.length
								? { output: finalResponse }
								: updatedReturnSuccessRes
						} else return 'successfully run'
					}
					const resultCheck = await checkResponse()

					return resultCheck
				}

				if (
					formattedSessionRequest.input.parentIp !==
					formattedSessionRequest.input.currentIp
				) {
					const checkResponse = async () => {
						const sessionDataMapper = async function () {
							const sessionData =
								formattedSessionRequest.input.input.sessionDataForIp
							const currentSessionIp =
								formattedSessionRequest.input.input.currentIp
							const parentSessionIp =
								formattedSessionRequest.input.input.parentIp
							const sessionId = formattedSessionRequest.input.input.sessionId
							const body = formattedSessionRequest.params.body.data
							const _ = require('lodash')
							if (!sessionData) {
								const error = new Error()
								error.statusCode = '410'
								error.message = 'Session Expired'
								return { data: error }
							}
							const parentData = _.cloneDeep(
								sessionData.allIps[parentSessionIp]
							)
							parentData.count = 0
							const updateSessionData = (alreadyAvailableData) => {
								const updatedSessionData = {
									...alreadyAvailableData,
									reduxState: body,
								}
								return updatedSessionData
							}
							const ipCacheUpdated = updateSessionData(parentData)
							sessionData.allIps[currentSessionIp] = ipCacheUpdated
							return { sessionDataUpdated: sessionData, sessionId: sessionId }
						}
						const sessionMapperDataResponse = await sessionDataMapper()
						const SetFormattedCacheData = {
							input: sessionMapperDataResponse,
							params: request,
							secrets: process.env,
							headers,
						}
						const cacheFormattedKey = SetFormattedCacheData.input.sessionId
						const cacheFormattedExpireTime = 15 * 60
						const fetchFormattedData =
							SetFormattedCacheData.input.sessionDataUpdated
						const outputResponse = await setDataInCache(
							fetchFormattedData,
							cacheFormattedKey,
							cacheFormattedExpireTime
						)
						const ReturnSuccessRes = {
							output: outputResponse,
							params: request,
							secrets: process.env,
							headers,
						}
						const updatedReturnSuccessResponse = { ...ReturnSuccessRes }

						if (updatedReturnSuccessResponse?.output?.responseType === 'xml') {
							delete updatedReturnSuccessResponse.headers
							return res
								.set('Content-Type', 'application/xml')
								.send(updatedReturnSuccessResponse.output.data)
						}

						delete updatedReturnSuccessResponse.params
						delete updatedReturnSuccessResponse.secrets
						delete updatedReturnSuccessResponse.headers

						if (
							Object.keys(updatedReturnSuccessResponse).length ||
							finalResponse.length
						) {
							return finalResponse.length
								? { output: finalResponse }
								: updatedReturnSuccessResponse
						} else return 'successfully run'
					}
					const resultCheck = await checkResponse()
					return resultCheck
				}
			}
			const resultCheck = await checkResponse()
			externalOutput_0c9a667f_9671_4419_9518_5529ad955038 = resultCheck
			return res.send(resultCheck)
		}
		return res.json(
			'Node has completed its execution without any response. No response node (e.g., success response, error response) connected to the service.'
		)
	} catch (error) {
		tavaLogger(corelationId, 'Error', url, error, templateType)
		return res
			.status(error?.response?.status || 500)
			.json(error?.response?.data || error?.message || error)
	}
}
module.exports = {
	sessioncreate,
	sessiondelete,
	sessionfetch,
	sessionupdate,
}
