"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const controllers_1 = require("./controllers");
const logging = require('./config/logging.config');
const port = process.env.PORT || 3000;
const app = express_1.default();
app.use(logging.log);
app.use(body_parser_1.default.json({ type: 'application/vnd.contentful.management.v1+json' }));
app.use('/encode', controllers_1.EncodeController);
app.use('/bitmovin', controllers_1.BitmovinController);
app.use('/health', controllers_1.HealthController);
app.listen(port, function () {
    console.log(`Video Service listening on port ${port}`);
});
exports.default = app;
//# sourceMappingURL=app.js.map