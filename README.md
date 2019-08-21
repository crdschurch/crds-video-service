# Crossroads Video Encoding Service

> This service is designed to use a video file (.mp4) out of Contentful and then create an encoding to Bitmovin. It uploads the resulting encoding to AWS S3 where there is a Cloudfront distribution set up.

The service is designed to automate the encoding and distribution of Crossroads Video assets. The goal is to provide a better experience for our members while also minimizing the data the required to view a video. It is also designed with the intention of not interrupting existing Content team processes or using a new process that is very familiar.

## System Requirements
### Contentful
- `bitmovin_url` field on record where video asset lives
- `video_file` asset containing a Contentful Asset

## System Workflow
1. Encoding request is sent to service from a Contentful webhook containing a payload.
2. Payload contains a video asset with a unique asset ID.
    - If the video already exists an encoding is not run
    - Regardless of whether or not the encoding exists, the `bitmovin_url` field is updated in case the asset is referenced in multiple places
3. Encoding is configured; runs on Bitmovin's encoding servers
    - Output files go to `S3_BUCKET/ASSET_ID/*`
4. After encoding is completed the HLS manifest is then processed
    - Output files go to `S3_BUCKET/ASSET_ID/*`
5. Once complete the new cloudfront endpoint to the root manifest is written back to Contentful's `bitmovin_url` field

## Installation
### Requirements
- Node `8.12.0`
### Command
```sh
npm install
```
## Environment Example
```
export APPLICATION_NAME=
export BITMOVIN_API_KEY=
export BITMOVIN_INPUT_ID=
export BITMOVIN_OUTPUT_ID=
export CLOUDFRONT_DOMAIN=
export CLOUD_REGION=
export CONTENTFUL_ACCESS_TOKEN=
export CONTENTFUL_MANAGEMENT_TOKEN=
export CONTENTFUL_SPACE_ID=
export CONTENTFUL_ENV=
export CRDS_ENV=local
export INPUT_FILE_HOST=
export LOGZIO_API_KEY=
export PORT=
export AWS_ACCESS_KEY=
export AWS_SECRET_KEY=
export BITMOVIN_BUCKET=
export BITMOVIN_DIRECTORY=
export PER_TITLE=true
export PER_TITLE_MODE=
```

PER_TITLE will run a per-title encoding analysis when enabled. **This increases the billable encoding minute multiplier**

PER_TITLE_MODE will determine how many passes the per-title analysis will run. **This increases the billable encoding minute multiplier**
Valid values:
  * SINGLE_PASS
    * Cost multiplier is 1x
  * TWO_PASS
    * Cost multiplier is 1.25x
  * THREE_PASS
    * Cost multiplier is 1.5x

## Launch Application
Using VSCode simply run using `F5` or select to launch the application

## Build Application only
```sh
npm run tsc
```

## Logging
Logz.io node application is used to log all application functions. To edit how logs are captured edit `logging.config.ts`
