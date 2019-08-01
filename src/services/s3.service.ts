import { S3 } from 'aws-sdk';
import { ContentData } from '../models/contentful-data.model';

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

  return s3.getObject(params)
    .promise()
    .then(data => {
      return true;
    })
    .catch(err => {
      if(err.code === 'NoSuchKey'){
        return false;
      } else {
        throw new Error(err);
      }
    })
}
