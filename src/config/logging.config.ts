import express from 'express';

let logger = require('logzio-nodejs').createLogger({
  token: process.env.LOGZIO_API_KEY,
});

function log(req: express.Request, res: express.Response, next: express.NextFunction) {
  var log = {
    application: 'crds-video-service',
    environment: process.env.CRDS_ENV,
    level: '',
    message: ''
  };
  if (res.statusCode >= 400)
    log.level = 'error';
  else
    log.level = 'info';

  log.message += `Request: ${req.method} ${req.originalUrl}`;

  const cleanup = () => {
    res.removeListener('error', errorFn);
  }
  const errorFn = err => {
    cleanup();
    log.level = 'error';
    log.message += `\n Response: Request pipeline error: ${err}`;
    logger.log(log);
  }

  res.on('error', errorFn); // pipeline internal error

  logger.log(log);
  console.log(log);

  next();
}

function logError(err, req: express.Request, res: express.Response, next: express.NextFunction) {
  var log = {
    application: 'crds-video-service',
    environment: process.env.CRDS_ENV,
    level: 'error',
    message: err
  };

  log.message += `\n Request: ${req.method} ${req.originalUrl}`;

  if (req.originalUrl == "/encode/message") {
    log.message += `\n Contentful Entry ID: ${req.body.sys.id}`
  }

  logger.log(log);
  console.log(log);

  next();
}

module.exports = {
  log,
  logError
}
