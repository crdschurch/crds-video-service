import Bitmovin from "bitmovin-javascript";
import { ContentData } from "../models/contentful-data.model";
import { updateContentData } from "./contentful.service";
import { hasDownloads } from "./s3.service";
import { startPerTitleEncoding } from "./bitmovin.perTitle.service";
import { startStandardEncoding } from "./bitmovin.standard.service";
import { addMp4ToExistingEncoding } from "./bitmovin.mp4.service";

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
  const downloadsExist = await hasDownloads(contentData);
  const encoding = encodings.find(encoding => encoding.name === contentData.videoId);
  const mp4Encoding = encodings.find(encoding => encoding.name === `${contentData.videoId}_mp4_add_on`)

  if (encoding && downloadsExist) {
    await updateContentData(contentData.id, contentData.videoId);
    return `Encoding/downloads for ${contentData.videoId} already exists!`
  } else if (!encoding) {
    if (contentData.videoId) {
      await startEncoding(contentData)
      await updateContentData(contentData.id, contentData.videoId);
      return `New Encoding created for ${contentData.videoId}`;
    } else {
      return `Contentful record ${contentData.id} does not contain video_file`;
    }
  } else {
    // if there is an encoding but there isn't an mp4 download, 
    // add the download only if the encoding is finished
    // and there isn't already an MP4 encoding running
    if (!mp4Encoding) {
      return await bitmovin.encoding.encodings(encoding.id)
        .status()
        .then(async response => {
          if (response.status === 'FINISHED') {
            return await addMp4ToExistingEncoding(contentData);
          } else {
            ;
            return `New encoding still running, no need to add MP4s`;
          }
        })
    } else {
      return `${mp4Encoding.name} already created and running`;
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
