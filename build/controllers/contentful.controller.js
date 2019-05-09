"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const contentfulService = __importStar(require("../services/contentful.service"));
const express_1 = require("express");
const message_model_1 = require("../models/message.model");
const router = express_1.Router();
router.get('/listMessages', (req, res) => {
    contentfulService.getEntries({ content_type: 'message' }, [], 0)
        .then(function (entries) {
        Promise.all(message_model_1.Message.createMessageArray(entries)).then(messages => res.status(200).send(messages)).catch(err => res.status(400).send(err));
    })
        .catch((err) => console.log(err));
});
exports.ContentfulController = router;
//# sourceMappingURL=contentful.controller.js.map