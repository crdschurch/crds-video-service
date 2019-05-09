"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = express_1.Router();
router.get('/', (req, res) => {
    res.status(200).send('Video Service is live');
});
exports.StatusController = router;
//# sourceMappingURL=status.controller.js.map