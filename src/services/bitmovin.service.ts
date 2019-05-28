import Bitmovin from "bitmovin-javascript";
import { Message } from "../models/message.model";
import * as codecList from "./bitmovin.codec";
import { updateContentfulRecord } from "./contentful.service";

const bitmovin = Bitmovin({
  'apiKey': process.env.BITMOVIN_API_KEY
});

const INPUT_FILE_HOST = process.env.INPUT_FILE_HOST;
const INPUT = process.env.BITMOVIN_INPUT_ID;
const OUTPUT = process.env.BITMOVIN_OUTPUT_ID;

async function startEncoding(message: Message) {

  const encodingConfig = {
    inputPath: message.videoUrl.replace(INPUT_FILE_HOST, ''),
    segmentLength: 4,
    segmentNaming: 'seg_%number%.ts',
    outputPath: 'bitmovin/' + message.videoId + '/',
  }

  const encoding = await bitmovin.encoding.encodings.create({
    name: message.videoId,
    cloudRegion: process.env.CLOUD_REGION
  });

  const videoStreamConfigs = await Promise.all(await createVideoStreamConfigs(encodingConfig, encoding));
  const audioStreamConfigs = await Promise.all(await createAudioStreamConfigs(encodingConfig, encoding));

  const videoMuxingConfigs = await Promise.all(await createVideoMuxingConfigs(encodingConfig, encoding, videoStreamConfigs));
  const audioMuxingConfigs = await Promise.all(await createAudioMuxingConfigs(encodingConfig, encoding, audioStreamConfigs));

  await bitmovin.encoding.encodings(encoding.id).start({});

  await waitUntilEncodingFinished(encoding);

  const manifestConfig = {
    name: message.videoId + "_manifest",
    manifestName: 'manifest.m3u8',
    outputs: [{
      outputId: OUTPUT,
      outputPath: encodingConfig.outputPath,
      acl: [{
        permission: 'PUBLIC_READ'
      }]
    }]
  };
  
  const manifest = await bitmovin.encoding.manifests.hls.create(manifestConfig);
  await addSubtitles(manifest, message);
  await Promise.all(await createAudioManifest(audioMuxingConfigs, encoding, manifest));
  await Promise.all(await createVideoManifest(videoMuxingConfigs, encoding, manifest));
  await bitmovin.encoding.manifests.hls(manifest.id).start();
  await waitUntilHlsManifestFinished(manifest);
}


export async function createEncoding(message: Message) {
  const encodings = await getAllEncodings();
  const encoding = encodings.find(encoding => encoding.name === message.videoId);
  if (!encoding) {
    try {
      await startEncoding(message)
    } catch (err) {
      console.log(err);
    }
  } else {
    const hlsManifests = await bitmovin.encoding.manifests.hls.list();
    const hlsManifest = hlsManifests.items.find(manifest => { return manifest.media.find(media => media.encodingId).encodingId === encoding.id })
    if (!hlsManifest.media.find(media => media.type == "VTT"))
      await addSubtitles(hlsManifest, message);
    console.log(`Encoding for ${message.videoId} already exists!`);
  }

  return updateContentfulRecord(message.id, message.videoId);
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

export async function getEncodingStreamDuration(encoding) {
  let streams = await bitmovin.encoding.encodings(encoding.id).streams.list();
  return await bitmovin.encoding.encodings(encoding.id)
    .streams(streams.items[0].id) // All streams (video or audio) will be the same length
    .inputDetails()
    .then((details: any) => {
      return details.duration;
    });
}

async function createVideoStreamConfigs(encodingConfig, encoding) {
  return await codecList.videoCodecConfigurations
    .map(async id => {
      var videoStreamConfig = {
        codecConfigId: id,
        inputStreams: [{
          inputId: INPUT,
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
          inputId: INPUT,
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
          outputId: OUTPUT,
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
          outputId: OUTPUT,
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
        subtitles: 'subtitles_group',
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

const waitUntilEncodingFinished = encoding => {
  return new Promise((resolve, reject) => {
    const waitForEncodingToBeFinishedOrError = () => {
      console.log('GET STATUS FOR ENCODING WITH ID ', encoding.id);
      bitmovin.encoding
        .encodings(encoding.id)
        .status()
        .then(response => {
          console.log('Encoding status is ' + response.status);

          if (response.status === 'FINISHED') {
            return resolve(response.status);
          }

          if (response.status === 'ERROR') {
            return reject(response.status);
          }

          setTimeout(waitForEncodingToBeFinishedOrError, 10000);
        });
    };
    waitForEncodingToBeFinishedOrError();
  });
}

const waitUntilHlsManifestFinished = manifest => {
  return new Promise((resolve, reject) => {
    const waitForManifestToBeFinished = () => {
      console.log('GET STATUS FOR HLS MANIFEST WITH ID ', manifest.id);
      bitmovin.encoding.manifests
        .hls(manifest.id)
        .status()
        .then(response => {
          console.log('HLS Manifest status is ' + response.status);

          if (response.status === 'FINISHED') {
            return resolve(response.status);
          }

          if (response.status === 'ERROR') {
            return reject(response.status);
          }

          setTimeout(waitForManifestToBeFinished, 10000);
        });
    };
    waitForManifestToBeFinished();
  });
};

const createHlsVttMedia = (hlsManifest, vttUrl) => {
  return new Promise((resolve, reject) => {
    const vttMedia = {
      name: 'en',
      groupId: 'subtitles_group',
      language: 'en',
      vttUrl,
      uri: 'vtt_media.m3u8'
    };

    bitmovin.encoding.manifests
      .hls(hlsManifest.id)
      .media.vtt.add(vttMedia)
      .then(createdVttMedia => {
        console.log('Successfully created HLS VTT Media', createdVttMedia);
        resolve(createdVttMedia);
      })
  });
};

async function addSubtitles(manifest, message) {
  if (!message.transcriptionUrl) return;
  return createHlsVttMedia(manifest, `https:${message.transcriptionUrl}`);
}
