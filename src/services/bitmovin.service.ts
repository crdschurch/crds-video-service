import Bitmovin from "bitmovin-javascript";
import { Message } from "../models/message.model";
import * as codecList from "./bitmovin.codec";

const bitmovin = Bitmovin({
  'apiKey': process.env['BITMOVIN_API_KEY'] as string
});

const INPUT_FILE_HOST = process.env.INPUT_FILE_HOST;
const INPUT = process.env.BITMOVIN_INPUT_ID;
const OUTPUT = process.env.BITMOVIN_OUTPUT_ID;

async function start(message: Message)  {

  const inputPath = message.videoUrl.replace(INPUT_FILE_HOST, '');

  const segmentLength = 4;
  const outputPath = 'bitmovin/' + message.videoId + '/';
  const segmentNaming = 'seg_%number%.ts';

  const encoding = await bitmovin.encoding.encodings.create({
    name: message.videoId,
    cloudRegion: 'AWS_US_EAST_1'
  });

  const videoStreamConfigsPromises = codecList.videoCodecConfigurations
    .map(async id => {
      var videoStreamConfig = {
        codecConfigId: id,
        inputStreams: [{
          inputId: INPUT,
          inputPath: inputPath,
          selectionMode: 'AUTO'
        }]
      };
      return bitmovin.encoding.encodings(encoding.id).streams.add(videoStreamConfig);
    })

  const audioStreamConfigsPromises = codecList.audioCodecConfiguration
    .map(async id => {
      var audioStreamConfig = {
        codecConfigId: id,
        inputStreams: [{
          inputId: INPUT,
          inputPath: inputPath,
          selectionMode: 'AUTO'
        }]
      };
      return bitmovin.encoding.encodings(encoding.id).streams.add(audioStreamConfig);
    })

  const videoStreamConfigs = await Promise.all(videoStreamConfigsPromises);
  const audioStreamConfigs = await Promise.all(audioStreamConfigsPromises);
  
  const videoMuxingConfigsPromises = videoStreamConfigs
    .map(videoStreamConfig => {
      var videoMuxingConfig = {
        segmentLength,
        segmentNaming,
        streams: [{
          streamId: videoStreamConfig.id
        }],
        outputs: [{
          outputId: OUTPUT,
          outputPath: outputPath + "/video/" + videoStreamConfig.id,
          acl: [{
            permission: 'PUBLIC_READ'
          }]
        }]
      };
      return bitmovin.encoding.encodings(encoding.id).muxings.ts.add(videoMuxingConfig);
    })
  
  const audioMuxingConfigsPromises = audioStreamConfigs
    .map(audioStreamConfig => {
      var audioMuxingConfig = {
        segmentLength,
        segmentNaming,
        streams: [{
          streamId: audioStreamConfig.id
        }],
        outputs: [{
          outputId: OUTPUT,
          outputPath: outputPath + "/audio/" + audioStreamConfig.id,
          acl: [{
            permission: 'PUBLIC_READ'
          }]
        }]
      };
      return bitmovin.encoding.encodings(encoding.id).muxings.ts.add(audioMuxingConfig);
    })
  
    const videoMuxingConfig = await Promise.all(videoMuxingConfigsPromises);
    const audioMuxingConfig = await Promise.all(audioMuxingConfigsPromises);

    await bitmovin.encoding.encodings(encoding.id).start({});
    
    await waitUntilEncodingFinished(encoding);

    const manifestConfig = {
      name: message.videoId + "_manifest",
      manifestName: 'manifest.m3u8',
      outputs: [{
        outputId: OUTPUT,
        outputPath: outputPath,
        acl: [{
          permission: 'PUBLIC_READ'
        }]
      }]
    }

    const manifest = await bitmovin.encoding.manifests.hls.create(manifestConfig);

    const audioManifest = audioMuxingConfig
      .map(audioMuxingConfig => {
        var audioMedia = {
          name: 'audio',
          groupId: 'audio_group',
          segmentPath: 'audio/' + audioMuxingConfig.streams[0].streamId,
          uri: audioMuxingConfig.streams[0].streamId + 'audiomedia.m3u8',
          encodingId: encoding.id,
          streamId: audioMuxingConfig.streams[0].streamId,
          muxingId: audioMuxingConfig.id,
          language: 'en'
        }

        return bitmovin.encoding.manifests.hls(manifest.id).media.audio.add(audioMedia);
      })

    const videoManifest = videoMuxingConfig
      .map(videoMuxingConfig => {
        var variantStream = {
          audio: 'audio_group',
          closedCaptions: 'NONE',
          segmentPath: 'video/' + videoMuxingConfig.streams[0].streamId,
          uri: videoMuxingConfig.streams[0].streamId + 'video.m3u8',
          encodingId: encoding.id,
          streamId: videoMuxingConfig.streams[0].streamId,
          muxingId: videoMuxingConfig.id
        }
        return bitmovin.encoding.manifests.hls(manifest.id).streams.add(variantStream);
      })

    await Promise.all(audioManifest);
    await Promise.all(videoManifest);

    await bitmovin.encoding.manifests.hls(manifest.id).start();
    
    await waitUntilHlsManifestFinished(manifest);
    
    console.log(`Encoding for ${message.id} complete!`);
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
  

export function createEncoding(message: Message){
  start(message).catch(e => {
    console.log(e.message)
  });
}

export function getAllEncodings(): Promise<any[]> {
  return bitmovin.encoding.encodings.list(100, 0)
    .then(result => {
      const { items } = result;
      return items;
    });
}


