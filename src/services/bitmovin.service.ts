import Bitmovin from "bitmovin-javascript";
import { ContentData } from "../models/contentful-data.model";
import * as codecList from "./bitmovin.codec";
import { updateContentData } from "./contentful.service";
import { hasDownloads, setMetaDataForMp4 } from "./s3.service";

const bitmovin = Bitmovin({
  'apiKey': process.env.BITMOVIN_API_KEY
});

const INPUT_FILE_HOST = process.env.INPUT_FILE_HOST;
const INPUT = process.env.BITMOVIN_INPUT_ID;
const OUTPUT = process.env.BITMOVIN_OUTPUT_ID;
const PER_TITLE_ENABLED = process.env.PER_TITLE;

async function startEncoding(contentData: ContentData) {

  const encodingConfig = {
    inputPath: contentData.videoUrl.replace(INPUT_FILE_HOST, ''),
    segmentLength: 4,
    segmentNaming: 'seg_%number%.ts',
    outputPath: 'bitmovin/' + contentData.videoId + '/'
  }

  const encoding = await bitmovin.encoding.encodings.create({
    name: contentData.videoId,
    cloudRegion: process.env.CLOUD_REGION
  });

  if(PER_TITLE_ENABLED){
    await startPerTitleEncoding(contentData, encodingConfig, encoding);
  } else {
    await startHardCodedEncoding(contentData, encodingConfig, encoding);
  }
  
}

async function startPerTitleEncoding(contentData: ContentData, encodingConfig, encoding){
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
    encodingMode: 'THREE_PASS',
    perTitle: perTitle
  };

  const audioStream = await addAudioStreamToPerTitleEncoding(encoding, encodingConfig);
  const videoStream = await addVideoStreamToPerTitleEncoding(audioStream, encoding, encodingConfig);
  await addHlsMuxingForStreams(videoStream, audioStream, encoding, encodingConfig);

  await bitmovin.encoding.encodings(encoding.id).start(startRequest);
  
  await waitUntilEncodingFinished(encoding);
}

async function addAudioStreamToPerTitleEncoding(encoding, encodingConfig){
  const inputStream = {
    inputId: INPUT,
    inputPath: encodingConfig.inputPath,
    selectionMode: 'AUTO'
  };

  let stream = {
    inputStreams: [inputStream],
    codecConfigId: codecList.perTitleAudioCodecID
  }

  return await bitmovin.encoding.encodings(encoding.id).streams.add(stream);
}

async function addVideoStreamToPerTitleEncoding(audioStream, encoding, encodingConfig){
  const inputStream = {
    inputId: INPUT,
    inputPath: encodingConfig.inputPath,
    selectionMode: 'AUTO'
  };

  let videoStream = {
    inputStreams: [inputStream],
    codecConfigId: codecList.perTitleVideoCodecID,
    mode: 'PER_TITLE_TEMPLATE'
  };

  return await bitmovin.encoding.encodings(encoding.id).streams.add(videoStream);
}

async function startHardCodedEncoding(contentData: ContentData, encodingConfig, encoding){
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

  await waitUntilEncodingFinished(encoding);

  const manifestConfig = {
    name: contentData.videoId + "_manifest",
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
  await Promise.all(await createAudioManifest(audioMuxingConfigs, encoding, manifest));
  await Promise.all(await createVideoManifest(videoMuxingConfigs, encoding, manifest));
  await bitmovin.encoding.manifests.hls(manifest.id).start();
  await waitUntilHlsManifestFinished(manifest);

  await Promise.all(await setMetaDataForMp4(contentData));
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
      try {
        await startEncoding(contentData)
      } catch (err) {
        throw new Error(err);
      }
      await updateContentData(contentData.id, contentData.videoId);
      return `New Encoding created for ${contentData.videoId}`;
    } else {
      return `Contentful record ${contentData.id} does not contain video_file`;
    }
  } else {
    // if there is an encoding but there isn't an mp4 download, 
    // add the download only if the encoding is finished
    // and there isn't already an MP4 encoding running
    if(!mp4Encoding){
      return await bitmovin.encoding.encodings(encoding.id)
      .status() 
      .then(async response => {
        if (response.status === 'FINISHED') {
          console.log('Adding mp4s to previously finished encoding');
          try {
            await addMp4ToExistingEncoding(contentData);
          } catch (err) {
            console.log(err);
            throw new Error(err);
          }
          return `Added mp4 downloads to encoding ${encoding.id}`;
        } else {
          console.log('New Encoding still running, no need to add MP4s');
          return `New encoding still running, no need to add MP4s`;
        }
      })
    } else {
      return `${mp4Encoding.name} already created and running`;
    }
  }
}

async function addMp4ToEncoding(contentData: ContentData, encoding) {
  const encodingConfig = {
    inputPath: contentData.videoUrl.replace(INPUT_FILE_HOST, ''),
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
  await waitUntilEncodingFinished(encoding);

  await Promise.all(await setMetaDataForMp4(contentData));
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

async function addHlsMuxingForStreams(videoStream, audioStream, encoding, encodingConfig){
  const prefix = '{width}_{bitrate}_{uuid}/';

  const streams = [
    {
      streamId: videoStream.id
    },
    {
      streamId: audioStream.id
    }
  ]

  let hlsMuxing = {
    name: 'HLS' + prefix, 
    streams,
    outputs: [
      {
        outputId: OUTPUT,
        outputPath: encodingConfig.outputPath + prefix,
        acl: [
          {
            permission: 'PUBLIC_READ'
          }
        ]
      }
    ],
    filename: 'per_title_mp4.mp4'
  };
  await bitmovin.encoding.encodings(encoding.id).muxings.ts.add(hlsMuxing);
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
        outputId: OUTPUT,
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
    filename: `${contentData.title}_${mp4VideoStreamConfig.name}.mp4`
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
          inputId: INPUT,
          inputPath: encodingConfig.inputPath,
          selectionMode: 'AUTO'
        }]
      };
      return await bitmovin.encoding.encodings(encoding.id).streams.add(mp4StreamConfig);
    })
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
            return reject(`ENCODING ${response.status}`);
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
            return reject(`MANIFEST ${response.status}`);
          }

          setTimeout(waitForManifestToBeFinished, 10000);
        });
    };
    waitForManifestToBeFinished();
  });
};
