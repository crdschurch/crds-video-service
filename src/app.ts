if (!process.env.CRDS_ENV.match('local')) {
  require('newrelic');
}

import express from "express";
import bodyParser from "body-parser";
import { BitmovinController, EncodeController, HealthController } from './controllers';

const logging = require('./config/logging.config');
const port = process.env.PORT || 3000;

const app = express();

app.use(logging.log);
app.use(logging.logResponseBody);

app.use(bodyParser.json({ type: 'application/vnd.contentful.management.v1+json' }))

app.use('/encode', EncodeController);
app.use('/bitmovin', BitmovinController);
app.use('/health', HealthController);

app.use(logging.logError);

app.listen(port, function () {
  console.log(`Video Service listening on port ${port}`);
});

export default app;
