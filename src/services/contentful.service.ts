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

export function getAssetUrl(videoId: string) : Promise<string> {
  return client.getAsset(videoId)
    .then(asset => {
      return asset.fields.file.url;
    } )
    .catch((ex) => { throw ex; });
}

export function updateContentfulRecord(entryId, assetId){
  const bitmovinUrl = `${process.env.CLOUDFRONT_DOMAIN}bitmovin/${assetId}/manifest.m3u8`;

  return managementClient.getSpace(process.env.CONTENTFUL_SPACE_ID)
    .then((space) => space.getEnvironment(process.env.CONTENTFUL_ENV))
    .then((environment) => environment.getEntry(entryId))
    .then((entry) => {
      let entry_bitmovin_url: string = entry.fields.bitmovin_url ? entry.fields.bitmovin_url['en-US'] : '';

      // If the entry already has a matching URL do not publish it or we get stuck in an infinite loop with Contentful
      if(!entry_bitmovin_url.match(bitmovinUrl)){
        entry.fields.bitmovin_url = { 'en-US': bitmovinUrl };
        return entry.update()
          .then((entry) => {
            entry.publish()
          })
          .then((entry) => { 
            console.log(`Entry ${entry.sys.id} bitmovin url updated to ${bitmovinUrl}`);
          });
      } else {
        console.log(`Bitmovin URL in entry already up to date`);
      }
    })
    
    .catch(console.error);
}
