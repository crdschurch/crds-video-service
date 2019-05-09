"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const content_model_1 = require("./content.model");
class VideoFile extends content_model_1.Content {
    constructor(id, title, videoUrl, videoId) {
        super(id);
        this.title = title;
        this.videoUrl = videoUrl;
        this.videoId = videoId;
    }
    ;
}
exports.VideoFile = VideoFile;
//# sourceMappingURL=asset.model.js.map