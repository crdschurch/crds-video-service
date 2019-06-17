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

  next();
}

function logError(err, req: express.Request, res: express.Response, next: express.NextFunction) {
  var log = {
    application: 'crds-video-service',
    environment: process.env.CRDS_ENV,
    level: 'error',
    message: err
  };

  log.message += `\nRequest: ${req.method} ${req.originalUrl}`;

  if (req.originalUrl == "/encode/contentfulData" || req.originalUrl == "/encode/latestMessageStatus") {
    let encodingMessage = err.encoding ? err.encoding.id : err.encoding;
    let manifestMessage = err.manifest ? err.manifest.id : err.manifest;
    log.message += `\nThere was an issue trying to retrieve the latest message
                    Contentful Entry Title: ${err.message.title}
                    Contentful Entry ID : ${err.message.id}
                    Contentful Entry Video ID: ${err.message.videoId}
                    Contentful Entry Transription ID: ${err.message.trancriptionId}
                    Contentful Entry Bitmovin URL: ${err.message.bitmovinUrl}
                    Bitmovin Encoding: ${encodingMessage}
                    Bitmovin Manifest: ${manifestMessage}`
  }

  logger.log(log);

  next();
}

module.exports = {
  log,
  logError
}
