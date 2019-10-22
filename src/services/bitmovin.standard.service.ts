import Bitmovin from "bitmovin-javascript";
import { ContentData } from "../models/contentful-data.model";
import * as codecList from "./bitmovin.codec";
import * as BitmovinUtils from "./bitmovin.utils";
import { addMp4ToEncoding } from "./bitmovin.mp4.service";
import { setMetaDataForMp4 } from "./s3.service";

const bitmovin = Bitmovin({
  'apiKey': process.env.BITMOVIN_API_KEY
});

export async function startStandardEncoding(contentData: ContentData, encodingConfig, encoding) {
  const videoStreamConfigs = await Promise.all(await createVideoStreamConfigs(encodingConfig, encoding));
  const audioStreamConfigs = await Promise.all(await createAudioStreamConfigs(encodingConfig, encoding));

  const videoMuxingConfigs = await Promise.all(await createVideoMuxingConfigs(encodingConfig, encoding, videoStreamConfigs));
  const audioMuxingConfigs = await Promise.all(await createAudioMuxingConfigs(encodingConfig, encoding, audioStreamConfigs));

  await addMp4ToEncoding(contentData, encoding);

  try {
    await bitmovin.encoding.encodings(encoding.id).start({});
  } catch (err) {
    throw new Error(err);
  }

  await BitmovinUtils.waitUntilEncodingFinished(encoding, bitmovin);

  const manifestConfig = {
    name: contentData.videoId + "_manifest",
    manifestName: 'manifest.m3u8',
    outputs: [{
      outputId: process.env.BITMOVIN_OUTPUT_ID,
      outputPath: encodingConfig.outputPath,
      acl: [{
        permission: 'PUBLIC_READ'
      }]
    }]
  };

  const manifest = await bitmovin.encoding.manifests.hls.create(manifestConfig);
  await Promise.all(await createAudioManifest(audioMuxingConfigs, encoding, manifest));
  await Promise.all(await createVideoManifest(videoMuxingConfigs, encoding, manifest));
  await bitmovin.encoding.manifests.hls(manifest.id).start();
  await BitmovinUtils.waitUntilHlsManifestFinished(manifest, bitmovin);

  await Promise.all(await setMetaDataForMp4(contentData));

  return encoding;
}

async function createVideoStreamConfigs(encodingConfig, encoding) {
  return await codecList.videoCodecConfigurations
    .map(async id => {
      var videoStreamConfig = {
        codecConfigId: id,
        inputStreams: [{
          inputId: process.env.BITMOVIN_INPUT_ID,
          inputPath: encodingConfig.inputPath,
          selectionMode: 'AUTO'
        }]
      };
      return await bitmovin.encoding.encodings(encoding.id).streams.add(videoStreamConfig);
    })
}

async function createAudioStreamConfigs(encodingConfig, encoding) {
  return await codecList.audioCodecConfiguration
    .map(async id => {
      var audioStreamConfig = {
        codecConfigId: id,
        inputStreams: [{
          inputId: process.env.BITMOVIN_INPUT_ID,
          inputPath: encodingConfig.inputPath,
          selectionMode: 'AUTO'
        }]
      };
      return await bitmovin.encoding.encodings(encoding.id).streams.add(audioStreamConfig);
    })
}

async function createVideoMuxingConfigs(encodingConfig, encoding, videoStreamConfigs) {
  return await videoStreamConfigs
    .map(videoStreamConfig => {
      var videoMuxingConfig = {
        segmentLength: encodingConfig.segmentLength,
        segmentNaming: encodingConfig.segmentNaming,
        streams: [{
          streamId: videoStreamConfig.id
        }],
        outputs: [{
          outputId: process.env.BITMOVIN_OUTPUT_ID,
          outputPath: encodingConfig.outputPath + "/video/" + videoStreamConfig.id,
          acl: [{
            permission: 'PUBLIC_READ'
          }]
        }]
      };
      return bitmovin.encoding.encodings(encoding.id).muxings.ts.add(videoMuxingConfig);
    })
}

async function createAudioMuxingConfigs(encodingConfig, encoding, audioStreamConfigs) {
  return await audioStreamConfigs
    .map(audioStreamConfig => {
      var audioMuxingConfig = {
        segmentLength: encodingConfig.segmentLength,
        segmentNaming: encodingConfig.segmentNaming,
        streams: [{
          streamId: audioStreamConfig.id
        }],
        outputs: [{
          outputId: process.env.BITMOVIN_OUTPUT_ID,
          outputPath: encodingConfig.outputPath + "/audio/" + audioStreamConfig.id,
          acl: [{
            permission: 'PUBLIC_READ'
          }]
        }]
      };
      return bitmovin.encoding.encodings(encoding.id).muxings.ts.add(audioMuxingConfig);
    })
}

async function createAudioManifest(audioMuxingConfigs, encoding, manifest) {
  return await audioMuxingConfigs
    .map(audioMuxingConfig => {
      var audioMedia = {
        name: 'audio',
        groupId: 'audio_group',
        segmentPath: 'audio/' + audioMuxingConfig.streams[0].streamId + '/',
        uri: `audiomedia${audioMuxingConfig.streams[0].streamId}.m3u8`,
        encodingId: encoding.id,
        streamId: audioMuxingConfig.streams[0].streamId,
        muxingId: audioMuxingConfig.id,
        language: 'en'
      }

      return bitmovin.encoding.manifests.hls(manifest.id).media.audio.add(audioMedia);
    })
}

async function createVideoManifest(videoMuxingConfigs, encoding, manifest) {
  return videoMuxingConfigs
    .map(videoMuxingConfig => {
      var variantStream = {
        audio: 'audio_group',
        closedCaptions: 'NONE',
        segmentPath: 'video/' + videoMuxingConfig.streams[0].streamId + '/',
        uri: `video${videoMuxingConfig.streams[0].streamId}.m3u8`,
        encodingId: encoding.id,
        streamId: videoMuxingConfig.streams[0].streamId,
        muxingId: videoMuxingConfig.id
      }
      return bitmovin.encoding.manifests.hls(manifest.id).streams.add(variantStream);
    })
}
