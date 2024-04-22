const { tavaLogger } = require('../../../helpers')
const {
	fetchOrStoreDataInCache,
} = require('../../../helpers/fetchAndUpdateCacheData')
const prismaClient = require('../../../prismaClient')
const { prisma } = prismaClient
const axios = require('axios')

const tboreissuance = async (req, res, next) => {
	try {
		const finalResponse = []
		const templateType = 'travel'
		const request_9bb98fd8_7f32_4747_8bed_9b68c394659f = req
		const { body, url, params, method, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Request', url, req, templateType)
		const If_d659a568_664f_48aa_83b1_7d49e8fd7028 = {
			input: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
			params: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
			secrets: process.env,
			headers,
		}
		let externalOutput_d659a568_664f_48aa_83b1_7d49e8fd7028
		if (
			If_d659a568_664f_48aa_83b1_7d49e8fd7028.input.body.paymentRequest.amount >
			0
		) {
			const checkResponse = async () => {
				const inputData_d659a568_664f_48aa_83b1_7d49e8fd7028 = {
					...If_d659a568_664f_48aa_83b1_7d49e8fd7028,
				}
				delete inputData_d659a568_664f_48aa_83b1_7d49e8fd7028.params
				delete inputData_d659a568_664f_48aa_83b1_7d49e8fd7028.secrets
				delete inputData_d659a568_664f_48aa_83b1_7d49e8fd7028.headers
				const internalOutput_d659a568_664f_48aa_83b1_7d49e8fd7028 =
					inputData_d659a568_664f_48aa_83b1_7d49e8fd7028
				const CallRESTAPIEndpoint_b492e7a0_7237_4a63_b17b_07e26442d214 = {
					input: internalOutput_d659a568_664f_48aa_83b1_7d49e8fd7028,
					params: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
					secrets: process.env,
					headers,
				}

				let output_b492e7a0_7237_4a63_b17b_07e26442d214
				try {
					const cacheKey_b492e7a0_7237_4a63_b17b_07e26442d214 = ''
					const cacheExpireTime_b492e7a0_7237_4a63_b17b_07e26442d214 = 0
					const isCacheRequired_b492e7a0_7237_4a63_b17b_07e26442d214 = false
					tavaLogger(
						corelationId,
						'Request',
						`${CallRESTAPIEndpoint_b492e7a0_7237_4a63_b17b_07e26442d214.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/payment?`,
						CallRESTAPIEndpoint_b492e7a0_7237_4a63_b17b_07e26442d214.params.body
							.paymentRequest,
						templateType
					)
					const fetchData = async () =>
						await axios
							.post(
								`${CallRESTAPIEndpoint_b492e7a0_7237_4a63_b17b_07e26442d214.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/payment?`,
								CallRESTAPIEndpoint_b492e7a0_7237_4a63_b17b_07e26442d214.params
									.body.paymentRequest,
								{ headers: {} }
							)
							.then(async (res) => {
								tavaLogger(
									corelationId,
									'Response',
									`${CallRESTAPIEndpoint_b492e7a0_7237_4a63_b17b_07e26442d214.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/payment?`,
									res,
									templateType
								)
								return res.data
							})
					output_b492e7a0_7237_4a63_b17b_07e26442d214 =
						isCacheRequired_b492e7a0_7237_4a63_b17b_07e26442d214
							? await fetchOrStoreDataInCache(
									fetchData,
									cacheKey_b492e7a0_7237_4a63_b17b_07e26442d214,
									cacheExpireTime_b492e7a0_7237_4a63_b17b_07e26442d214
							  )
							: await fetchData()
				} catch (error) {
					console.log(
						'Error occurred in :  `${CallRESTAPIEndpoint_b492e7a0_7237_4a63_b17b_07e26442d214.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/payment?`',
						error
					)
					if (error.response) {
						const { status, data } = error?.response
						tavaLogger(
							corelationId,
							'Error',
							`${CallRESTAPIEndpoint_b492e7a0_7237_4a63_b17b_07e26442d214.secrets.BACKEND_DEPLOYED_INSTANCE_URL}/payment?`,
							error,
							templateType
						)
						throw res.status(status).json(data)
					}
					throw error
				}
				const RunJavaScriptCode_f3339183_0376_4585_8cca_f235b166182d = {
					input: output_b492e7a0_7237_4a63_b17b_07e26442d214,
					params: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
					secrets: process.env,
					headers,
				}
				const rjc_f3339183_0376_4585_8cca_f235b166182d =
					RunJavaScriptCode_f3339183_0376_4585_8cca_f235b166182d

				const runJavascriptCode_f3339183_0376_4585_8cca_f235b166182d =
					async function () {
						function requestMapper(input, input1) {
							return {
								pnr: input.pnr,
								providerBookingId: '',
								userEmail: input.userEmail,
								tavaBookingId: input.tavaBookingId,
								status: 'PENDING',
								provider: 'TBO',
								paymentSessionId: input1.id,
								paymentStatus: input1.session_status,
								paymentId: input1.paymentId,
								orderType: '',
								bookingId: input.bookingId,
							}
						}

						return requestMapper(
							rjc_f3339183_0376_4585_8cca_f235b166182d.params.body,
							rjc_f3339183_0376_4585_8cca_f235b166182d.input.session
						)
					}
				const output_f3339183_0376_4585_8cca_f235b166182d =
					await runJavascriptCode_f3339183_0376_4585_8cca_f235b166182d()
				const CreateSingleRecord_0b4f3ca8_de3d_43f7_b003_69a583523d09 = {
					input: output_f3339183_0376_4585_8cca_f235b166182d,
					params: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
					secrets: process.env,
					headers,
				}
				const created_0b4f3ca8_de3d_43f7_b003_69a583523d09 =
					await prisma.Reissuance.create({
						data: CreateSingleRecord_0b4f3ca8_de3d_43f7_b003_69a583523d09.input,
					})
				const ReturnSuccessResponse_3cd62cec_9f57_46c0_82df_3cb170a0ac39 = {
					created: created_0b4f3ca8_de3d_43f7_b003_69a583523d09,
					params: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
					secrets: process.env,
					headers,
					output: output_b492e7a0_7237_4a63_b17b_07e26442d214,
				}
				const updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39 = {
					...ReturnSuccessResponse_3cd62cec_9f57_46c0_82df_3cb170a0ac39,
				}

				if (
					updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39?.output
						?.responseType === 'xml'
				) {
					delete updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39.headers
					return res
						.set('Content-Type', 'application/xml')
						.send(
							updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39
								.output.data
						)
				}

				delete updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39.params
				delete updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39.secrets
				delete updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39.headers

				if (
					Object.keys(
						updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39
					).length ||
					finalResponse.length
				) {
					tavaLogger(
						corelationId,
						'Response',
						url,
						{
							status: 200,
							data: updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39,
						},
						templateType
					)
					return finalResponse.length
						? { output: finalResponse }
						: updatedReturnSuccessRes_3cd62cec_9f57_46c0_82df_3cb170a0ac39
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			externalOutput_d659a568_664f_48aa_83b1_7d49e8fd7028 = resultCheck
			return res.send(resultCheck)
		}
		const If_a1c9a9d6_646b_4149_951a_48e652071b16 = {
			input: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
			params: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
			secrets: process.env,
			headers,
		}
		let externalOutput_a1c9a9d6_646b_4149_951a_48e652071b16
		if (
			If_a1c9a9d6_646b_4149_951a_48e652071b16.input.body.paymentRequest.amount <
			0
		) {
			const checkResponse = async () => {
				const inputData_a1c9a9d6_646b_4149_951a_48e652071b16 = {
					...If_a1c9a9d6_646b_4149_951a_48e652071b16,
				}
				delete inputData_a1c9a9d6_646b_4149_951a_48e652071b16.params
				delete inputData_a1c9a9d6_646b_4149_951a_48e652071b16.secrets
				delete inputData_a1c9a9d6_646b_4149_951a_48e652071b16.headers
				const internalOutput_a1c9a9d6_646b_4149_951a_48e652071b16 =
					inputData_a1c9a9d6_646b_4149_951a_48e652071b16
				const RunJavaScriptCode_72e016cb_f338_4baf_a14a_aa4212d47fa9 = {
					input: internalOutput_a1c9a9d6_646b_4149_951a_48e652071b16,
					params: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
					secrets: process.env,
					headers,
				}
				const rjc_72e016cb_f338_4baf_a14a_aa4212d47fa9 =
					RunJavaScriptCode_72e016cb_f338_4baf_a14a_aa4212d47fa9

				const runJavascriptCode_72e016cb_f338_4baf_a14a_aa4212d47fa9 =
					async function () {
						function requestMapper(input) {
							return {
								pnr: input.pnr,
								providerBookingId: '',
								userEmail: input.userEmail,
								tavaBookingId: input.tavaBookingId,
								status: 'PENDING',
								provider: 'TBO',
								paymentSessionId: '',
								paymentStatus: '',
								paymentId: '',
								orderType: '',
								bookingId: input.bookingId,
							}
						}

						return requestMapper(
							rjc_72e016cb_f338_4baf_a14a_aa4212d47fa9.params.body
						)
					}
				const output_72e016cb_f338_4baf_a14a_aa4212d47fa9 =
					await runJavascriptCode_72e016cb_f338_4baf_a14a_aa4212d47fa9()
				const CreateSingleRecord_472cafb3_1597_4cbb_a578_39367500c79f = {
					input: output_72e016cb_f338_4baf_a14a_aa4212d47fa9,
					params: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
					secrets: process.env,
					headers,
				}
				const created_472cafb3_1597_4cbb_a578_39367500c79f =
					await prisma.Reissuance.create({
						data: CreateSingleRecord_472cafb3_1597_4cbb_a578_39367500c79f.input,
					})
				const ReturnSuccessResponse_c7fc15e5_f03d_4e42_9689_a438fccfb49a = {
					created: created_472cafb3_1597_4cbb_a578_39367500c79f,
					params: request_9bb98fd8_7f32_4747_8bed_9b68c394659f,
					secrets: process.env,
					headers,
				}
				const updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a = {
					...ReturnSuccessResponse_c7fc15e5_f03d_4e42_9689_a438fccfb49a,
				}

				if (
					updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a?.output
						?.responseType === 'xml'
				) {
					delete updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a.headers
					return res
						.set('Content-Type', 'application/xml')
						.send(
							updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a
								.output.data
						)
				}

				delete updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a.params
				delete updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a.secrets
				delete updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a.headers

				if (
					Object.keys(
						updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a
					).length ||
					finalResponse.length
				) {
					tavaLogger(
						corelationId,
						'Response',
						url,
						{
							status: 200,
							data: updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a,
						},
						templateType
					)
					return finalResponse.length
						? { output: finalResponse }
						: updatedReturnSuccessRes_c7fc15e5_f03d_4e42_9689_a438fccfb49a
				} else return 'successfully run'
			}
			const resultCheck = await checkResponse()
			externalOutput_a1c9a9d6_646b_4149_951a_48e652071b16 = resultCheck
			return res.send(resultCheck)
		}
		return res.json(
			'Node has completed its execution without any response. No response node (e.g., success response, error response) connected to the service.'
		)
	} catch (error) {
		const templateType = 'travel'
		const { url, headers } = req
		let corelationId = headers['x-request-id']
		tavaLogger(corelationId, 'Error', url, error, templateType)
		if (error?.statusCode && error?.message)
			return res.status(error.statusCode).json(error)
		const errorMessage = error?.message
		if (errorMessage && errorMessage.includes(`Message:`)) {
			if (!res.headersSent)
				return res
					.status(400)
					.json(errorMessage.split(`Message:`)[1] || errorMessage)
		}
		if (!res.headersSent) return res.status(400).json(errorMessage)
	}
}

module.exports = {
	tboreissuance,
}
