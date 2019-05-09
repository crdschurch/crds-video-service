"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_model_1 = require("../models/message.model");
const BitmovinService = __importStar(require("../services/bitmovin.service"));
const router = express_1.Router();
router.post('/message', (req, res) => {
    message_model_1.Message.createMessageFromJson(req.body)
        .then(message => {
        BitmovinService.createEncoding(message);
        res.status(200).send(message);
    })
        .catch(err => res.status(400).send(err));
});
exports.EncodeController = router;
//# sourceMappingURL=encode.controller.js.map