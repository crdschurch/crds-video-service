import express from 'express';
import newrelic from 'newrelic';

let logger = require('logzio-nodejs').createLogger({
  token: process.env.LOGZIO_API_KEY,
  timeout: 1000
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
    log.message += `\nResponse: Request pipeline error: ${err}`;
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
    message: err.error ? err.error.stack : err
  };

  log.message += `\nRequest: ${req.method} ${req.originalUrl}`;

  if (req.originalUrl.includes("encode")) {
    let encodingMessage = err.encoding ? err.encoding.id : err.encoding;
    let manifestMessage = err.manifest ? err.manifest.id : err.manifest;
    log.message += `\nThere was an issue with ${req.originalUrl}
                    Contentful Entry Title: ${err.message.title}
                    Contentful Entry ID : ${err.message.id}
                    Contentful Entry Video ID: ${err.message.videoId}
                    Contentful Entry Transription ID: ${err.message.transcriptionId}
                    Contentful Entry Bitmovin URL: ${err.message.bitmovinUrl}
                    Bitmovin Encoding: ${encodingMessage}
                    Bitmovin Manifest: ${manifestMessage}`
  }

  logger.log(log);

  newrelic.noticeError("errorMessage", log);

  next();
}

function logResponseBody(req, res, next) {

  var log = {
    application: 'crds-video-service',
    environment: process.env.CRDS_ENV,
    level: 'info',
    message: ''
  };

  var oldWrite = res.write,
    oldEnd = res.end;

  var chunks = [];

  res.write = function (chunk) {
    chunks.push(chunk);

    oldWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk)
      chunks.push(chunk);

    var body = Buffer.concat(chunks).toString('utf8');
    log.message += `Request: ${req.method} ${req.originalUrl}`;
    log.message += `\nResponse: ${body}`

    oldEnd.apply(res, arguments);
    logger.log(log);
  };

  next();
}

module.exports = {
  log,
  logResponseBody,
  logError
}
