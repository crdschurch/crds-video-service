export const waitUntilEncodingFinished = (encoding, bitmovin) => {
  return new Promise((resolve, reject) => {
    const waitForEncodingToBeFinishedOrError = () => {
      console.log('GET STATUS FOR ENCODING WITH ID ', encoding.id);
      bitmovin.encoding
        .encodings(encoding.id)
        .status()
        .then(response => {
          console.log('Encoding status is ' + response.status);

          if (response.status === 'FINISHED') {
            return resolve(response.status);
          }

          if (response.status === 'ERROR') {
            return reject(`ENCODING ${response.status}`);
          }

          setTimeout(waitForEncodingToBeFinishedOrError, 10000);
        });
    };
    waitForEncodingToBeFinishedOrError();
  });
}

export const waitUntilHlsManifestFinished = (manifest, bitmovin) => {
  return new Promise((resolve, reject) => {
    const waitForManifestToBeFinished = () => {
      console.log('GET STATUS FOR HLS MANIFEST WITH ID ', manifest.id);
      bitmovin.encoding.manifests
        .hls(manifest.id)
        .status()
        .then(response => {
          console.log('HLS Manifest status is ' + response.status);

          if (response.status === 'FINISHED') {
            return resolve(response.status);
          }

          if (response.status === 'ERROR') {
            return reject(`MANIFEST ${response.status}`);
          }

          setTimeout(waitForManifestToBeFinished, 10000);
        });
    };
    waitForManifestToBeFinished();
  });
};
