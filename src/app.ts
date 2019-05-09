import express from "express";
const logging = require('./config/logging.config');
const port = process.env.PORT || 3000;
import bodyParser from "body-parser";

import { StatusController, BitmovinController, ContentfulController, EncodeController } from './controllers';

const app = express();

app.use(logging.log);
app.use(bodyParser.json({type: 'application/vnd.contentful.management.v1+json'}))

app.use('/status', StatusController);
app.use('/contentful', ContentfulController);
app.use('/encode', EncodeController);
app.use('/bitmovin', BitmovinController);

app.listen(port, function(){
  console.log(`Video Service listening on port ${port}`);
});

export default app;
