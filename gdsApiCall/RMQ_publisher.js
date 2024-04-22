const amqp = require("amqplib");
const { v4: uuidv4 } = require("uuid");

let connection = null;

async function getConnection() {
  if (!connection) {
    connection = await amqp.connect(
      process.env.TBO_MQ_SERVER
    );
  }
  return connection;
}

const reqForLambda = async (reqApi, serviceType, typeOfApi) => {
  if (reqApi.headers) delete reqApi.headers
	if (reqApi.params) delete reqApi.params
	if (reqApi.secrets) delete reqApi.secrets
	if (reqApi.input) reqApi = reqApi.input
  let reqObjGds = {
    apiReq: reqApi,
    lambdaConfig: {
      queueName: process.env.RES_QUEUE_TBO,
      apiType: typeOfApi,
      serviceType: serviceType,
    },
  };

  return reqObjGds;
};

async function publishMessage(reqApi, serviceType, typeOfApi) {
  try {
    const conn = await getConnection();
    const channel = await conn.createChannel();
    const requestQueue = process.env.REQ_QUEUE_TBO;

    const reqObjGds = await reqForLambda(reqApi, serviceType, typeOfApi);

    const jsonData = JSON.stringify(reqObjGds);

    await channel.assertQueue(requestQueue, { durable: true });
    await channel.sendToQueue(requestQueue, Buffer.from(jsonData), {
      persistent: true,
      correlationId: uuidv4(),
    });

    console.log(`Message '${jsonData}' sent to queue '${requestQueue}'`);

    setTimeout(() => {
      // For closing of channel
      channel.close();
    }, 500);

    return jsonData;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  publishMessage,
};
