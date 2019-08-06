import { Response, Request, Router, NextFunction } from "express";
import { ContentData } from "../models/contentful-data.model";
import * as BitmovinService from "../services/bitmovin.service";
import * as ContentfulService from "../services/contentful.service";

const router: Router = Router();

router.post('/contentfulData', (req: Request, res: Response, next: NextFunction) => {
  ContentData.createContentfulDataFromJson(req.body)
    .then(contentfulData => {
      BitmovinService.createEncoding(contentfulData)
        .then((contentfulData) => {
          return res.status(200).send(contentfulData);
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
