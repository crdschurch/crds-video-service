import * as contentful from "contentful";
import * as contentfulManagement from "contentful-management";
import { ContentData } from "../models/contentful-data.model";


const client = contentful.createClient({
  accessToken: process.env['CONTENTFUL_ACCESS_TOKEN'] as string,
  space: process.env['CONTENTFUL_SPACE_ID'] as string,
  environment: process.env['CONTENTFUL_ENV'] as string
});

const managementClient = contentfulManagement.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
})

export function getAssetUrl(videoId: string): Promise<string> {
  return client.getAsset(videoId)
    .then(asset => {
      return asset.fields.file.url;
    })
    .catch((ex) => { throw ex; });
}

export async function updateContentData(entryId, assetId) {
  const bitmovinUrl = `${process.env.CLOUDFRONT_DOMAIN}bitmovin/${assetId}/manifest.m3u8`;

  return managementClient.getSpace(process.env.CONTENTFUL_SPACE_ID)
    .then((space) => space.getEnvironment(process.env.CONTENTFUL_ENV))
    .then((environment) => environment.getEntry(entryId))
    .then((entry) => {
      let entry_bitmovin_url: string = entry.fields.bitmovin_url ? entry.fields.bitmovin_url['en-US'] : '';

      // If the entry already has a matching URL do not publish it or we get stuck in an infinite loop with Contentful
      if (!entry_bitmovin_url.match(bitmovinUrl)) {
        entry.fields.bitmovin_url = { 'en-US': bitmovinUrl };
        return entry.update()
          .then((entry) => {
            entry.publish();
            console.log(`Entry ${entry.sys.id} bitmovin url updated to ${bitmovinUrl}`);
          }).catch(console.error);
      } else {
        console.log(`Bitmovin URL in entry already up to date`);
      }
    }).catch(console.error);
}

export function getLatestMessage(): Promise<ContentData> {
  return client.getEntries({
    content_type: 'message',
    order: '-fields.published_at',
    limit: 1
  })
  .then(entry => {
    return ContentData.createContentfulDataFromJson(entry.items[0]);
  })
}
