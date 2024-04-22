const { splunkLogger } = require('../utils/splunkLogger');
const { getUrlAndParams } = require('./getUrlAndParams');

const serviceTypeMap = {
  'amadeus': 'AMADEUS API',
  'stripe': 'STRIPE API',
  'razorpay': 'RAZORPAY API',
  'tektravels': 'TBO API'
};
const WEBAPI = 'WEBAPI';
const REQUEST = 'Request';
const ERROR = 'Error';
const PAYMENT_URL = '/payment';
const DEFAUT_VALUE_ZERO = '0';
const ZERO = 0

const tavaLogger = async (corelationId, logType, url, res) => {
  
  const temp = url?.split('/');
  let endpoint = temp[temp.length - 1].split('?')[ZERO];
  let serviceType = WEBAPI;
  
  for (const key of Object.keys(serviceTypeMap)) {
    if (url.includes(key)) {
      serviceType = serviceTypeMap[key];
      break;
    }
  }

  let bookingId = DEFAUT_VALUE_ZERO;
  if (url === PAYMENT_URL && logType === REQUEST) {
    bookingId = res?.body?.bookingId || DEFAUT_VALUE_ZERO;
  }

  const request = res?.config ? {
    url: res.config.url,
    method: res.config.method,
    requestData: res.config.data || getUrlAndParams(res.config.url).params
  } : {
    url: res?.url || url,
    method: res?.method,
    requestData: res?.body || res,
    params: res?.params
  };

  let response = {};
  if ( logType.includes(ERROR) ) {
    response.status = res?.response?.status || res?.status
    response.response = res?.response?.data || res?.data || res
  }

  const data = {
    corelationId: corelationId,
    date: new Date(),
    serviceType,
    logType,
    log: {
      data: logType.includes(REQUEST) ? request : response
    },
    url: `/${endpoint}`,
    bookingId,
    tenantId: ZERO
  };

  splunkLogger({...data});
};

module.exports = { tavaLogger };
