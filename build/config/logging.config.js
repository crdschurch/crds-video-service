"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let logger = require('logzio-nodejs').createLogger({
    token: process.env.LOGZIO_API_TOKEN,
});
function log(req, res, next) {
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
    log.message = `Request: ${req.method} ${req.originalUrl}`;
    log.message += `\nResponse: ${res.statusCode} ${res.statusMessage}`;
    if (req.originalUrl == '/') {
        log.message = "Status Page loaded";
    }
    logger.log(log);
    next();
}
module.exports = {
    log
};
//# sourceMappingURL=logging.config.js.map