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
    .catch((err) => { 
      return null;
    });
}

export async function updateContentData(contentData: ContentData, duration) {
  const bitmovinUrl = `${process.env.CLOUDFRONT_DOMAIN}bitmovin/${contentData.videoId}/manifest.m3u8`;

  console.log(`Attempting contentful update for Entry: ${contentData.id}\nRequestId: ${contentData.requestId}`);
  return managementClient.getSpace(process.env.CONTENTFUL_SPACE_ID)
    .then((space) => space.getEnvironment(process.env.CONTENTFUL_ENV))
    .then((environment) => environment.getEntry(contentData.id))
    .then((entry) => {
      let entry_bitmovin_url: string = entry.fields.bitmovin_url ? entry.fields.bitmovin_url['en-US'] : '';
      let entry_duration: string = entry.fields.duration ? entry.fields.duration['en-US'] : '';

      // If the entry already has a matching URL do not publish it or we get stuck in an infinite loop with Contentful
      // TODO: now that we've changed to .update() some of this logic can go including the above comment ^^^
      if (!entry_bitmovin_url.match(bitmovinUrl) || !entry_duration.match(duration)) {
        entry.fields.bitmovin_url = { 'en-US': bitmovinUrl };
        entry.fields.duration = { 'en-US': Math.round(duration) };
        return entry.update()
          .then((entry) => {
            entry.update();
            console.log(`Entry ${entry.sys.id} bitmovin url updated to ${bitmovinUrl} => RequestID: ${contentData.requestId}`);
          }).catch(console.error);
      } else {
        console.log(`Bitmovin URL in entry already up to date => RequestID: ${contentData.requestId}`);
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

export function getAllMessages(messages: any[] = [], offset: number = 0) {
  return client.getEntries({
    content_type: "message",
    limit: 1000,
    skip: offset,
    'fields.bitmovin_url[exists]': true
  }).then(response => {
    const { items } = response;
    messages = [...messages, ...items]
    if(response.items.length !== 1000) return messages;
    return getAllMessages(messages, offset + 1000);
  }).catch(err => {
    console.log(err);
  })
}

export function buildResponse(data) {
  if (data.length == 0)
    return "video not associated to message";

  let messages;
  if (data.length > 1) {
    messages = data.map(item => {
      return {
        "duplicateMessageId": item.sys.id,
        "title": item.fields.title,
        "contentType": item.sys.contentType.sys.id,
        "publishedAt": item.fields.published_at
      }
    })
  }
  return {
    "messageId": data[0].sys.id,
    "contentType": data[0].sys.contentType.sys.id,
    "title": data[0].fields.title,
    "publishedAt": data[0].fields.published_at,
    "multipleMessages": messages ? messages : "no"
  }
}
