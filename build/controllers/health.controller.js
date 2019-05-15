"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = express_1.Router();
router.get('/status', (req, res) => {
    res.sendStatus(200).send("Everything seems ok");
});
exports.HealthController = router;
//# sourceMappingURL=health.controller.js.map