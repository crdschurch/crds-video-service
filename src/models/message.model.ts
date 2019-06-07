import { Content } from "./content.model";
import * as contentfulService from "../services/contentful.service";

export class Message extends Content {
  title: string;
  videoUrl: string;
  videoId: string;
  transcriptionUrl: string;
  transcriptionId: string;
  bitmovinUrl: string;
  
  constructor(id: string, title: string, videoUrl: string, videoId: string, transcriptionUrl: string, transcriptionId: string, bitmovinUrl: string) {
    super(id);
    this.title = title;
    this.videoUrl = videoUrl;
    this.videoId = videoId;
    this.transcriptionUrl = transcriptionUrl;
    this.transcriptionId = transcriptionId;
    this.bitmovinUrl = bitmovinUrl;
  };

  public static createMessageArray(entries: any[]): Promise<Message>[] {
    return entries.map((entry) => {
      return this.createMessageFromJson(entry);
    });
  }

  public static async createMessageFromJson({ sys, fields }): Promise<Message> {
    const { id } = sys;
    const { title, video_file, transcription, bitmovin_url } = fields;
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

    return new Message(id, title, videoUrl, videoFileId, transcriptionUrl, transcriptionId, bitmovin_url);
  }
}
