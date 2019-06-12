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
          res.status(500).send(error);
          next(error);
        })
    })
    .catch(err => res.status(400).send(err))
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
      return BitmovinService.getManifestForEncoding(encoding.id);
    })
    .then(man => {
      manifest = man;
      res.send({
        messageTitle: message.title,
        messageId: message.id,
        messageBitmovinUrl: message.bitmovinUrl,
        videoId: message.videoId,
        encodingStatus: encoding.status,
        manifestStatus: manifest.status
      });
    })
    .catch(error => {
      if (message)
        res.status(200).send({
          messageTitle: message.title,
          messageId: message.id,
          messageBitmovinUrl: message.bitmovinUrl,
          videoId: message.videoId,
          encodingStatus: encoding ? encoding.status : "ERROR",
          manifestStatus: manifest ? manifest.status : "ERROR"
        });
      res.status(500).send(error);
      next(error);
    });
});

export const EncodeController: Router = router;
