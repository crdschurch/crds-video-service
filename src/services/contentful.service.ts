import * as contentful from "contentful";

const client = contentful.createClient({
  accessToken: process.env['CONTENTFUL_ACCESS_TOKEN'] as string,
  space: process.env['CONTENTFUL_SPACE_ID'] as string,
  environment: process.env['CONTENTFUL_ENV'] as string
});

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
