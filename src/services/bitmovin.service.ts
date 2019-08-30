import Bitmovin from "bitmovin-javascript";
import { ContentData } from "../models/contentful-data.model";
import { updateContentData } from "./contentful.service";
import { startPerTitleEncoding } from "./bitmovin.perTitle.service";
import { startStandardEncoding } from "./bitmovin.standard.service";

// TODO: abstract bitmovin client for the multiple services
const bitmovin = Bitmovin({
  'apiKey': process.env.BITMOVIN_API_KEY
});

async function startEncoding(contentData: ContentData) {

  const encodingConfig = {
    inputPath: contentData.videoUrl.replace(process.env.INPUT_FILE_HOST, ''),
    segmentLength: 4,
    segmentNaming: 'seg_%number%.ts',
    outputPath: 'bitmovin/' + contentData.videoId + '/'
  }

  const encoding = await bitmovin.encoding.encodings.create({
    name: contentData.videoId,

    cloudRegion: process.env.CLOUD_REGION
  });

  if (process.env.PER_TITLE === 'enabled') {
    await startPerTitleEncoding(contentData, encodingConfig, encoding);
  } else {
    await startStandardEncoding(contentData, encodingConfig, encoding);
  }
}

/*
  flow:
    1. If there is already an encoding with downloads, simply write back to Contentful
    2. If there is no encoding (and inherently no mp4) create a full encoding
    3. If the encoding doesn't have an mp4 download due to implementation timing add them
*/
export async function createEncoding(contentData: ContentData) {
  const encodings = await getAllEncodings();
  const encoding = encodings.find(encoding => encoding.name === contentData.videoId);

  if (encoding) {
    if(encoding.status === "FINISHED"){
      await updateContentData(contentData.id, contentData.videoId);
      return `Encoding for ${contentData.videoId} already exists!`
    } else if (encoding.status === "ERROR") {
      return `Encoding for ${contentData.videoId} has encountered an error. Please contact production support!`;
    } else {
      return `Encoding for ${contentData.videoId} is still processing`;
    }
  } else {
    if (contentData.videoId) {
      await startEncoding(contentData)
      await updateContentData(contentData.id, contentData.videoId);
      return `New Encoding created for ${contentData.videoId}`;
    } else {
      return `Contentful record ${contentData.id} does not contain video_file`;
    }
  }
}

export function getAllEncodings(encodings: any[] = [], offset: number = 0): Promise<any[]> {
  return bitmovin.encoding.encodings.list(100, offset)
    .then(result => {
      const { items } = result;
      encodings = [...encodings, ...items];
      if (items.length !== 2) return encodings;
      return getAllEncodings(encodings, offset + 100);
    });
}

export async function getEncoding(encodingName: string) {
  const encodings = await getAllEncodings();
  return encodings.find(encoding => encoding.name === encodingName);
}

export async function getManifestForEncoding(encodingId: string) {
  const manifests = await bitmovin.encoding.manifests.hls.list(100, 0, encodingId);
  return manifests.items[0];
}

export async function getEncodingStreamDuration(encoding) {
  let streams = await bitmovin.encoding.encodings(encoding.id).streams.list();
  return await bitmovin.encoding.encodings(encoding.id)
    .streams(streams.items[0].id) // All streams (video or audio) will be the same length
    .inputDetails()
    .then((details: any) => {
      return details.duration;
    });
}
