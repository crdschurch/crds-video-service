import { S3 } from 'aws-sdk';
import { ContentData } from '../models/contentful-data.model';
import { mp4VideoCodecs } from './bitmovin.codec';

var s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: "us-east-1"
})

export function hasDownloads(contentfulData: ContentData) {
  const params = {
    Bucket: `${process.env.BITMOVIN_BUCKET}/${process.env.BITMOVIN_DIRECTORY}`,
    Key: `${contentfulData.videoId}/${contentfulData.title}_1080p.mp4`
  };

  return s3.headObject(params)
    .promise()
    .then(() => {
      return true;
    })
    .catch(err => {
      if (err.code === 'NoSuchKey') {
        return false;
      } else {
        throw new Error(err);
      }
    })
}

export function setMetaDataForMp4(contentfulData: ContentData): Promise<any>[] {
  return mp4VideoCodecs
    .map(codec => {
      const params = {
        Bucket: `${process.env.BITMOVIN_BUCKET}/${process.env.BITMOVIN_DIRECTORY}`,
        CopySource: `${process.env.BITMOVIN_BUCKET}/${process.env.BITMOVIN_DIRECTORY}/${contentfulData.videoId}/${contentfulData.title}_${codec.type}.mp4`,
        Key: `${contentfulData.videoId}/${contentfulData.title}_${codec.type}.mp4`,
        ContentDisposition: 'attachment',
        ContentType: 'application/mp4',
        MetadataDirective: 'REPLACE',
        ACL: 'public-read'
      };

      return s3.copyObject(params)
        .promise()
        .then(data => {
          console.log(`Metadata properly set for ${contentfulData.title}_${codec.type}.mp4`);
        })
    })
}
