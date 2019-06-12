import * as contentfulService from "../services/contentful.service";

export class ContentData {
  id: string;
  title: string;
  videoUrl: string;
  videoId: string;
  transcriptionUrl: string;
  transcriptionId: string;
  bitmovinUrl: string;
  
  constructor(id: string, title: string, videoUrl: string, videoId: string, transcriptionUrl: string, transcriptionId: string, bitmovinUrl: string) {
    this.id = id;
    this.title = title;
    this.videoUrl = videoUrl;
    this.videoId = videoId;
    this.transcriptionUrl = transcriptionUrl;
    this.transcriptionId = transcriptionId;
    this.bitmovinUrl = bitmovinUrl;
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

    return new ContentData(id, title["en-US"], videoUrl, videoFileId, transcriptionUrl, transcriptionId, bitmovin_url);
  }
}
