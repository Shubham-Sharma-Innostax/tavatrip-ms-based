const SplunkLogger = require("splunk-logging").Logger;
const REQUEST = 'Request';
const RESPONSE = 'Response';
const INFO = 'Info';
const ERROR = 'Error';

const config = {
  token: process.env.SPLUNK_TOKEN,
  url: process.env.SPLUNK_URL
};

const Logger = new SplunkLogger(config);

const splunkLogger = async (logData) => {  
  const payload = {
    message: {
      data: logData
    },
    severity: (logData.logType === REQUEST || logData.logType ===  RESPONSE) ? INFO : ERROR
  };
  
  Logger.send(payload, (err) => {
    if (err) {
      console.log("Error:", err);
    }
  });
  
}

module.exports = { splunkLogger }
