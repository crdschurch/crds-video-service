import * as contentfulService from "../services/contentful.service";
import { Content } from "aws-sdk/clients/codecommit";

var stripchar = require('stripchar').StripChar;
const uuidv1 = require('uuid/v1');

export class ContentData {
  id: string;
  title: string;
  videoUrl: string;
  videoId: string;
  transcriptionUrl: string;
  transcriptionId: string;
  bitmovinUrl: string;
  requestId: string;
  invalidVideo: boolean;

  constructor(id: string, title: string, videoUrl: string, videoId: string, bitmovinUrl: string, invalidVideo: boolean) {
    this.id = id;
    this.title = title;
    this.videoUrl = videoUrl;
    this.videoId = videoId;
    this.bitmovinUrl = bitmovinUrl;
    this.requestId = uuidv1();
    this.invalidVideo = invalidVideo;
  };

  public static createContentfulDataArray(entries: any[]): Promise<ContentData>[] {
    return entries.map((entry) => {
      return this.createContentfulDataFromJson(entry);
    });
  }

  public static async createContentfulDataFromJson({ sys, fields }): Promise<ContentData> {
    const { id } = sys;
    const { title, video_file, transcription, bitmovin_url } = fields;
    let videoUrl = '';
    let videoFileId = '';
    let invalidVideo = true;
    let recordTitle = stripchar.RSspecChar(title["en-US"] ? title["en-US"] : title);

    if (video_file) {
      videoFileId = video_file.sys ? video_file.sys.id : video_file["en-US"].sys.id;
      videoUrl = video_file.fields ? video_file.fields.file.url : await contentfulService.getAssetUrl(videoFileId);
      if (videoUrl) invalidVideo = false;
    }

    return new ContentData(id, recordTitle, videoUrl, videoFileId, bitmovin_url, invalidVideo);
  }

  // Doing this for speed, but this object should throw an error on invalid video and we should catch it where necessary
  public static getInvalidVideoReason(data: ContentData): String {
    return data.videoId
      ? `Warning: something went wrong accessing the video file. Make sure it is in a published state for Message ${data.id}`
      : `Warning: No video on ${data.id}. Please upload a video you want to encode`;
  }
}
