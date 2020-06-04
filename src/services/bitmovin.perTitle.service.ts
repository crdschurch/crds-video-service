import Bitmovin from "bitmovin-javascript";
import { ContentData } from "../models/contentful-data.model";
import * as codecList from "./bitmovin.codec";
import * as BitmovinUtils from "./bitmovin.utils";
import { setMetaDataForMp4 } from "./s3.service";
import { addMp4ToEncoding } from "./bitmovin.mp4.service";

const bitmovin = Bitmovin({
  'apiKey': process.env.BITMOVIN_API_KEY
});

export async function startPerTitleEncoding(contentData: ContentData, encodingConfig, encoding) {
  const autoRepresentation = {
    adoptConfigurationThreshold: 0.5
  };

  const h264PerTitleStartConfiguration = {
    autoRepresentations: autoRepresentation
  };

  const perTitle = {
    h264Configuration: h264PerTitleStartConfiguration
  };

  const startRequest = {
    encodingMode: process.env.PER_TITLE_MODE,
    perTitle: perTitle,
    handleVariableInputFps: false
  };

  const videoCodecConfig = {
    name: `${encoding.name} Per-Title Config`,
    profile: 'HIGH'
  }

  const h264CodecConfig = await bitmovin.encoding.codecConfigurations.h264.create(videoCodecConfig);

  const audioStream = await addAudioStreamToPerTitleEncoding(encoding, encodingConfig);
  const videoStream = await addVideoStreamToPerTitleEncoding(encoding, encodingConfig, h264CodecConfig);
  await addVideoHlsMuxingForStreams(videoStream, encoding, encodingConfig);
  await addAudioHlsMuxingForStreams(audioStream, encoding, encodingConfig);
  await addMp4ToEncoding(contentData, encoding);

  await bitmovin.encoding.encodings(encoding.id).start(startRequest);

  await BitmovinUtils.waitUntilEncodingFinished(encoding, bitmovin);

  /*
    Per-title encodings dynamically create streams therefore
    we must wait until the encoding is done and then create the
    manifest from the created streams. This is a departure from
    the hard coded codec method in bitmovin.hardCode.service.ts
  */
  const muxings = await bitmovin.encoding.encodings(encoding.id).muxings.list(); // fetch dynamically created muxings 

  const validMuxings: any = muxings.items.filter(item => item.name !== "HLS{width}_{bitrate}_{uuid}/"); //strip out per-title template

  const audioMuxings = validMuxings.filter(item => item.name === "HLS_audio"); //isolate audio muxings

  const videoMuxings = validMuxings.filter(item => item.name !== "HLS_audio" && item.type === "TS"); //isolate hls video muxings

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

  /*
    creation of the manifest requires the segment path
    to derive this from from the Muxings we must remove the
    root path from the output path we create a variable named rootDir
    to pass into the manifest functions here
  */
  const rootDir = `${process.env.BITMOVIN_DIRECTORY}/${encoding.name}/`;

  const manifest = await bitmovin.encoding.manifests.hls.create(manifestConfig);
  await Promise.all(await createPerTitleAudioManifest(audioMuxings, encoding, manifest, rootDir));
  await Promise.all(await createPerTitleVideoManifest(videoMuxings, encoding, manifest, rootDir));
  try {
    await bitmovin.encoding.manifests.hls(manifest.id).start();
  } catch (err) {
    console.log(err);
  }

  await BitmovinUtils.waitUntilHlsManifestFinished(manifest, bitmovin);

  await Promise.all(await setMetaDataForMp4(contentData));

  return encoding;

}

async function addAudioStreamToPerTitleEncoding(encoding, encodingConfig) {
  const inputStream = {
    inputId: process.env.BITMOVIN_INPUT_ID,
    inputPath: encodingConfig.inputPath,
    selectionMode: 'AUTO'
  };

  let stream = {
    inputStreams: [inputStream],
    codecConfigId: codecList.perTitleAudioCodecID
  }

  return await bitmovin.encoding.encodings(encoding.id).streams.add(stream);
}

async function addVideoStreamToPerTitleEncoding(encoding, encodingConfig, h264CodecConfig) {
  const inputStream = {
    inputId: process.env.BITMOVIN_INPUT_ID,
    inputPath: encodingConfig.inputPath,
    selectionMode: 'AUTO'
  };

  let videoStream = {
    inputStreams: [inputStream],
    codecConfigId: h264CodecConfig.id,
    mode: 'PER_TITLE_TEMPLATE'
  };

  return await bitmovin.encoding.encodings(encoding.id).streams.add(videoStream);
}

async function addVideoHlsMuxingForStreams(videoStream, encoding, encodingConfig) {
  const prefix = '{width}_{bitrate}_{uuid}/';

  const streams = [{
    streamId: videoStream.id
  }]

  let hlsMuxing = {
    name: 'HLS' + prefix,
    segmentLength: encodingConfig.segmentLength,
    segmentNaming: encodingConfig.segmentNaming,
    streams,
    outputs: [{
      outputId: process.env.BITMOVIN_OUTPUT_ID,
      outputPath: `${encodingConfig.outputPath}/video/${prefix}`,
      acl: [{
        permission: 'PUBLIC_READ'
      }]
    }]
  };
  await bitmovin.encoding.encodings(encoding.id).muxings.ts.add(hlsMuxing);
}

async function addAudioHlsMuxingForStreams(audioStream, encoding, encodingConfig) {
  const streams = [{
    streamId: audioStream.id
  }]

  let hlsMuxing = {
    name: 'HLS_audio',
    segmentLength: encodingConfig.segmentLength,
    segmentNaming: encodingConfig.segmentNaming,
    streams,
    outputs: [{
      outputId: process.env.BITMOVIN_OUTPUT_ID,
      outputPath: `${encodingConfig.outputPath}/audio/${audioStream.id}`,
      acl: [{
        permission: 'PUBLIC_READ'
      }]
    }]
  };
  await bitmovin.encoding.encodings(encoding.id).muxings.ts.add(hlsMuxing);
}

async function createPerTitleAudioManifest(audioMuxings, encoding, manifest, rootDir) {
  return await audioMuxings
    .map(audioMuxing => {
      var audioMedia = {
        name: 'audio',
        groupId: 'audio_group',
        segmentPath: audioMuxing.outputs[0].outputPath.replace(rootDir, ''),
        uri: `audiomedia${audioMuxing.streams[0].streamId}.m3u8`,
        encodingId: encoding.id,
        streamId: audioMuxing.streams[0].streamId,
        muxingId: audioMuxing.id,
        language: 'en'
      }

      return bitmovin.encoding.manifests.hls(manifest.id).media.audio.add(audioMedia);
    })
}

async function createPerTitleVideoManifest(videoMuxings, encoding, manifest, rootDir) {
  return videoMuxings
    .map(videoMuxing => {
      var variantStream = {
        audio: 'audio_group',
        closedCaptions: 'NONE',
        segmentPath: videoMuxing.outputs[0].outputPath.replace(rootDir, ''),
        uri: `video${videoMuxing.streams[0].streamId}.m3u8`,
        encodingId: encoding.id,
        streamId: videoMuxing.streams[0].streamId,
        muxingId: videoMuxing.id
      }
      return bitmovin.encoding.manifests.hls(manifest.id).streams.add(variantStream);
    })
}
