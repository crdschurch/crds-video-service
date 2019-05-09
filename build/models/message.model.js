"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const content_model_1 = require("./content.model");
const contentfulService = __importStar(require("../services/contentful.service"));
class Message extends content_model_1.Content {
    constructor(id, title, videoUrl, videoId, transcriptionUrl, transcriptionId) {
        super(id);
        this.title = title;
        this.videoUrl = videoUrl;
        this.videoId = videoId;
        this.transcriptionUrl = transcriptionUrl;
        this.transcriptionId = transcriptionId;
    }
    ;
    static createMessageArray(entries) {
        return entries.map((entry) => {
            return this.createMessageFromJson(entry);
        });
    }
    static async createMessageFromJson({ sys, fields }) {
        const { id } = sys;
        const { title, video_file, transcription } = fields;
        let videoUrl = '';
        let videoFileId = '';
        let transcriptionUrl = '';
        let transcriptionId = '';
        if (video_file) {
            videoFileId = video_file.sys ? video_file.sys.id : video_file["en-US"].sys.id;
            videoUrl = video_file.fields ? video_file.fields.file.url : await contentfulService.getAssetUrl(videoFileId);
        }
        if (transcription) {
            transcriptionId = transcription.sys ? transcription.sys.id : transcription["en-US"].sys.id;
            transcriptionUrl = transcription.sys ? transcription.fields.file.url : await contentfulService.getAssetUrl(transcriptionId);
        }
        return new Message(id, title, videoUrl, videoFileId, transcriptionUrl, transcriptionId);
    }
}
exports.Message = Message;
//# sourceMappingURL=message.model.js.map