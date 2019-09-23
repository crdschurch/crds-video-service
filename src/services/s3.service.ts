import { S3 } from "aws-sdk";
import { ContentData } from "../models/contentful-data.model";
import { mp4VideoCodecs } from "./bitmovin.codec";

var s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: "us-east-1"
});

export function hasDownloads(contentfulData: ContentData) {
  let params = {
    Bucket: `${process.env.BITMOVIN_BUCKET}/${process.env.BITMOVIN_DIRECTORY}`,
    Key: `${contentfulData.videoId}/${contentfulData.videoId}_1080p.mp4`
  };

  return readObjectMeta(params)
    .then(exists => {
      if(!exists){
        params.Key = `${contentfulData.videoId}/${contentfulData.title}_1080p.mp4` //for older encodings that used title for filename
        return readObjectMeta(params)
      }
    })
}

export function setMetaDataForMp4(contentfulData: ContentData): Promise<any>[] {
  const downloadName = contentfulData.title.replace(/\s+/g, ""); //strips out spaces
  return mp4VideoCodecs.map(codec => {
    const params = {
      Bucket: `${process.env.BITMOVIN_BUCKET}/${process.env.BITMOVIN_DIRECTORY}`,
      CopySource: `${process.env.BITMOVIN_BUCKET}/${process.env.BITMOVIN_DIRECTORY}/${contentfulData.videoId}/${contentfulData.videoId}_${codec.type}.mp4`,
      Key: `${contentfulData.videoId}/${contentfulData.videoId}_${codec.type}.mp4`,
      ContentDisposition: `attachment; filename="${downloadName}.mp4"`,
      ContentType: "application/mp4",
      MetadataDirective: "REPLACE",
      ACL: "public-read"
    };

    return s3
      .copyObject(params)
      .promise()
      .then(() => {
        console.log(
          `Metadata properly set for ${contentfulData.videoId}_${codec.type}.mp4`
        );
      })
      .catch(error => {
        console.log(error);
      });
  });
}

function readObjectMeta(params): Promise<Boolean> {
  return s3
    .headObject(params)
    .promise()
    .then(() => {
      return true;
    })
    .catch(err => {
      if (err.code === "NoSuchKey") {
        return false;
      } else {
        throw new Error(err);
      }
    });
}
