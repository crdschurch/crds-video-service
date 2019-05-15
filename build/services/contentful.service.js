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
        var entry_bitmovin_url = entry.fields.bitmovin_url['en-US'];
        if (!entry_bitmovin_url.match(bitmovinUrl)) {
            entry.fields.bitmovin_url = { 'en-US': bitmovinUrl };
            return entry.update()
                .then((entry) => {
                entry.publish();
            })
                .then((entry) => {
                console.log(`Entry ${entry.sys.id} bitmovin url updated to ${bitmovinUrl}`);
            });
        }
        else {
            console.log(`Bitmovin URL in entry already up to date`);
        }
    })
        .catch(console.error);
}
exports.updateContentfulRecord = updateContentfulRecord;
//# sourceMappingURL=contentful.service.js.map