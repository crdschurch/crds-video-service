import Bitmovin from "bitmovin-javascript";
import { ContentData } from "../models/contentful-data.model";
import * as codecList from "./bitmovin.codec";
import { setMetaDataForMp4 } from "./s3.service";
import * as BitmovinUtils from "./bitmovin.utils";

const bitmovin = Bitmovin({
  'apiKey': process.env.BITMOVIN_API_KEY
});

export async function addMp4ToEncoding(contentData: ContentData, encoding) {
  const encodingConfig = {
    inputPath: contentData.videoUrl.replace(process.env.INPUT_FILE_HOST, ''),
    outputPath: 'bitmovin/' + contentData.videoId + '/'
  }

  const mp4VideoStreamConfigs = await Promise.all(await createMp4StreamConfig(encodingConfig, encoding, codecList.mp4VideoCodecs));
  const mp4AudioStreamConfig = await Promise.all(await createMp4StreamConfig(encodingConfig, encoding, codecList.mp4AudioCodecs));

  await Promise.all(await mp4VideoStreamConfigs
    .map(async videoConfig => {
      await addMp4Muxing(encoding, encodingConfig, videoConfig, mp4AudioStreamConfig[0], contentData);
    }))
}

export async function addMp4ToExistingEncoding(contentData: ContentData) {
  /*
    Encodings in FINISHED state cannot be amended
    New encoding is created to generate the mp4 into the same s3 folder
      as the original encoding
  */
  const encoding = await bitmovin.encoding.encodings.create({
    name: `${contentData.videoId}_mp4_add_on`,
    cloudRegion: process.env.CLOUD_REGION
  });

  await addMp4ToEncoding(contentData, encoding);
  await bitmovin.encoding.encodings(encoding.id).start({});
  await BitmovinUtils.waitUntilEncodingFinished(encoding, bitmovin);

  await Promise.all(await setMetaDataForMp4(contentData));

  return `Added mp4 downloads to encoding ${encoding.id}`;
}

async function addMp4Muxing(encoding, encodingConfig, mp4VideoStreamConfig, mp4AudioStreamConfig, contentData: ContentData) {
  const mp4muxing = {
    name: `${mp4VideoStreamConfig.name} Download Ready File`,
    streams: [
      {
        streamId: mp4VideoStreamConfig.id
      },
      {
        streamId: mp4AudioStreamConfig.id
      }
    ],
    outputs: [
      {
        outputId: process.env.BITMOVIN_OUTPUT_ID,
        outputPath: encodingConfig.outputPath,
        acl: [
          {
            scope: "public",
            permission: "PUBLIC_READ"
          }
        ]
      }
    ],
    streamConditionsMode: "DROP_STREAM",
    filename: `${contentData.videoId}_${mp4VideoStreamConfig.name}.mp4`
  }

  return await bitmovin.encoding.encodings(encoding.id).muxings.mp4.add(mp4muxing);
}

async function createMp4StreamConfig(encodingConfig, encoding, codecSet) {
  return await codecSet
    .map(async codec => {
      const mp4StreamConfig = {
        name: codec.type,
        codecConfigId: codec.codecId,
        inputStreams: [{
          inputId: process.env.BITMOVIN_INPUT_ID,
          inputPath: encodingConfig.inputPath,
          selectionMode: 'AUTO'
        }]
      };
      return await bitmovin.encoding.encodings(encoding.id).streams.add(mp4StreamConfig);
    })
}
