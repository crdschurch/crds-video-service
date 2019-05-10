import * as contentful from "contentful";
import * as contentfulManagement from "contentful-management";


const client = contentful.createClient({
  accessToken: process.env['CONTENTFUL_ACCESS_TOKEN'] as string,
  space: process.env['CONTENTFUL_SPACE_ID'] as string,
  environment: process.env['CONTENTFUL_ENV'] as string
});

const managementClient = contentfulManagement.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
})

export function getEntries(filters: any, entries: any, skip: any) :any {
  var params = {
      skip: skip,
      limit: 1000,
      include: 2,
  };
 
  Object.assign(params, filters);

  return client.getEntries(params)
    .then((response) => {
        entries = [...entries, ...response.items];
        if (response.items.length !== 1000) return entries;
        return getEntries(filters, entries, skip + 1000);
    })
    .catch((ex) => { throw ex; })
}

export function getAssetUrl(videoId: string) : Promise<string> {
  return client.getAsset(videoId)
    .then(asset => {
      return asset.fields.file.url;
    } )
    .catch((ex) => { throw ex; });
}

export function updateContentfulRecord(entryId, assetId){
  const bitmovinUrl = `${process.env.CLOUDFRONT_DOMAIN}${assetId}/manifest.m3u8`;

  return managementClient.getSpace(process.env.CONTENTFUL_SPACE_ID)
    .then((space) => space.getEnvironment(process.env.CONTENTFUL_ENV))
    .then((environment) => environment.getEntry(entryId))
    .then((entry) => {
      entry.fields.bitmovin_url = { 'en-US': bitmovinUrl };
      return entry.update();
    })
    .then((entry) => { 
      console.log(`Entry ${entry.sys.id} bitmovin url updated to ${bitmovinUrl}`);
      return entry;
    })
    .catch(console.error);
}
