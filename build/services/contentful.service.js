"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const contentful = __importStar(require("contentful"));
const contentfulManagement = __importStar(require("contentful-management"));
const client = contentful.createClient({
    accessToken: process.env['CONTENTFUL_ACCESS_TOKEN'],
    space: process.env['CONTENTFUL_SPACE_ID'],
    environment: process.env['CONTENTFUL_ENV']
});
const managementClient = contentfulManagement.createClient({
    accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
});
function getEntries(filters, entries, skip) {
    var params = {
        skip: skip,
        limit: 1000,
        include: 2,
    };
    Object.assign(params, filters);
    return client.getEntries(params)
        .then((response) => {
        entries = [...entries, ...response.items];
        if (response.items.length !== 1000)
            return entries;
        return getEntries(filters, entries, skip + 1000);
    })
        .catch((ex) => { throw ex; });
}
exports.getEntries = getEntries;
function getAssetUrl(videoId) {
    return client.getAsset(videoId)
        .then(asset => {
        return asset.fields.file.url;
    })
        .catch((ex) => { throw ex; });
}
exports.getAssetUrl = getAssetUrl;
function updateContentfulRecord(entryId, assetId) {
    const bitmovinUrl = `${process.env.CLOUDFRONT_DOMAIN}bitmovin/${assetId}/manifest.m3u8`;
    return managementClient.getSpace(process.env.CONTENTFUL_SPACE_ID)
        .then((space) => space.getEnvironment(process.env.CONTENTFUL_ENV))
        .then((environment) => environment.getEntry(entryId))
        .then((entry) => {
        entry.fields.bitmovin_url = { 'en-US': bitmovinUrl };
        return entry.update().then((entry) => entry.publish());
    })
        .then((entry) => {
        console.log(`Entry ${entry.sys.id} bitmovin url updated to ${bitmovinUrl}`);
        return entry;
    })
        .catch(console.error);
}
exports.updateContentfulRecord = updateContentfulRecord;
//# sourceMappingURL=contentful.service.js.map