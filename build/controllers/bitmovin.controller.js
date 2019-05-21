"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const bitmovinService = __importStar(require("../services/bitmovin.service"));
const express_1 = require("express");
const router = express_1.Router();
router.get('/listEncodings', (req, res) => {
    bitmovinService.getAllEncodings()
        .then(encodings => {
        res.send(encodings);
    });
});
router.get('/getAllEncodingDurations', (req, res) => {
    bitmovinService.getAllEncodings()
        .then((encodings) => {
        Promise.all(encodings.map(encoding => {
            return bitmovinService.getEncodingStreamDuration(encoding)
                .then(duration => {
                return {
                    "id": encoding.name,
                    "duration": duration
                };
            });
        })).then(encodingDurations => res.send(encodingDurations));
    })
        .catch(err => console.log(err));
});
exports.BitmovinController = router;
//# sourceMappingURL=bitmovin.controller.js.map