const AWS = require('aws-sdk');

const cloudWatchLogger = async (logData) => {
    const config = {
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
    const cloudwatchlogs = new AWS.CloudWatchLogs(config);

    const uploadLogsToCloudWatch = async (logChunks) => {
      for (const [index, logChunk] of logChunks.entries()) {
          let logEvents;
          if (Array.isArray(logChunk)) {
              logEvents = logChunk.map((log, i) => ({
                  message: log,
                  timestamp: new Date().getTime() + i * 1000, // Adjust timestamp for each log event
              }));
          } else {
              // If logChunk is not an array, wrap it into an array
              logEvents = [{
                  message: logChunk,
                  timestamp: new Date().getTime(), // Use current time for timestamp
              }];
          }
  
          const request = {
              logGroupName: process.env.AWS_LOG_GROUP_NAME,
              logStreamName: process.env.AWS_LOG_STREAM_NAME,
              logEvents: logEvents,
          };
  
          try {
              const response = await new Promise((resolve, reject) => {
                  cloudwatchlogs.putLogEvents(request, (error, data) => {
                      return error ? reject(error) : resolve(data);
                  });
              });
          } catch (error) {
              console.error(
                  `Error uploading chunk ${index + 1} to CloudWatch Logs:`,
                  error
              );
          }
      }
  };
  
    const splitLogs = (logData) => {
        const maxLogSize = 200000; // 256 KB
        const logString = JSON.stringify(logData);
        const totalSize = Buffer.byteLength(logString, 'utf8');
        const numberOfChunks = Math.ceil(totalSize / maxLogSize);

        const logChunks = [];
        let startIndex = 0;

        for (let i = 0; i < numberOfChunks; i++) {
            const chunkSize = Math.min(maxLogSize, totalSize - startIndex);
            const chunk = logString.substr(startIndex, chunkSize);
            let chunkTraceId = `${i + 1}` + '/' + `${numberOfChunks}` ;
            let formattedData = {
              chunkId : chunkTraceId,
              chunkData : chunk
            }
            formattedData = JSON.stringify(formattedData)
            logChunks.push(formattedData);
            startIndex += chunkSize;
        }

        uploadLogsToCloudWatch(logChunks);
    };

    splitLogs(logData);
};

module.exports = { cloudWatchLogger };
