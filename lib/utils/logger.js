const winston = require('winston');

module.exports = settings => {

  const transports = [
    new winston.transports.Console({
      level: settings.logLevel || 'info',
      handleExceptions: true
    })
  ];

  return winston.createLogger({
    transports,
    format: winston.format.json()
  });

};
