import { Response, Request, Router, NextFunction } from "express";
import { ContentData } from "../models/contentful-data.model";
import * as BitmovinService from "../services/bitmovin.service";
import * as ContentfulService from "../services/contentful.service";

const router: Router = Router();

router.post('/contentfulData', (req: Request, res: Response, next: NextFunction) => {
  ContentData.createContentfulDataFromJson(req.body)
    .then(contentfulData => {
      if(contentfulData.invalidVideo){
        let invalidReason = ContentData.getInvalidVideoReason(contentfulData);
        res.status(299).send(invalidReason);
        console.log(invalidReason);
      }
      BitmovinService.needsEncoded(contentfulData)
        .then(async (needsEncoded) => {
          if (needsEncoded) {
            res.status(200).send({ data: contentfulData, message: `Creating Encoding`});
            return await BitmovinService.createEncoding(contentfulData);
          } else {
            res.status(200).send({ data: contentfulData, message: `Encoding already exists`});
            return await BitmovinService.getEncoding(contentfulData.videoId);
          }
        })
        .then(encoding => {
          BitmovinService.getEncodingStreamDuration(encoding)
            .then(duration => {
              ContentfulService.updateContentData(contentfulData, duration)
            })
            .catch(err => {
              console.error(err)
            })
        })
        .catch((error) => {
          res.status(500).send(error.message);
          next(error);
        })
    })
    .catch(err => res.status(500).send(err))
});

router.get('/latestMessageStatus', (req: Request, res: Response, next: NextFunction) => {
  let message, encoding, manifest;
  ContentfulService.getLatestMessage()
    .then(mes => {
      message = mes;
      return BitmovinService.getEncoding(message.videoId);
    })
    .then(enc => {
      encoding = enc;
      if (encoding) {
        return BitmovinService.getManifestForEncoding(encoding.id);
      } else {
        return null;
      }
    })
    .then(man => {
      manifest = man;
      res.send({
        messageTitle: message.title,
        messageId: message.id,
        messageBitmovinUrl: message.bitmovinUrl ? message.bitmovinUrl : "NO BITMOVIN URL",
        videoId: message.videoId ? message.videoId : "NO VIDEO FILE",
        encodingStatus: encoding ? encoding.status : "NO ENCODING",
        manifestStatus: manifest ? manifest.status : "NO MANIFEST"
      });
    })
    .catch(error => {
      res.status(500).send(error);
      next({ error, message, encoding, manifest });
    });
});

export const EncodeController: Router = router;
