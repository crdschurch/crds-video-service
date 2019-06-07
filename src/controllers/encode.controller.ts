import { Response, Request, Router, NextFunction } from "express";
import { Message } from "../models/message.model";
import * as BitmovinService from "../services/bitmovin.service";
import * as ContentfulService from "../services/contentful.service";

const router: Router = Router();

router.post('/message', (req: Request, res: Response, next: NextFunction) => {
  Message.createMessageFromJson(req.body)
    .then(message => {
      BitmovinService.createEncoding(message)
        .then((message) => {
          return res.status(200).send(message);
        })
        .catch((error) => {
          res.status(500).send(error);
          next(error);
        })
    })
    .catch(err => res.status(400).send(err))
});

router.get('/latestMessageStatus', (req: Request, res: Response, next: NextFunction) => {
  ContentfulService.getLatestMessage()
    .then(message => {
      BitmovinService.getEncoding(message.videoId)
        .then(encoding => {
          BitmovinService.getManifestForEncoding(encoding.id)
            .then(manifest => {
              res.send({
                messageTitle: message.title,
                messageId: message.id,
                messageBitmovinUrl: message.bitmovinUrl,
                videoId: message.videoId,
                encodingStatus: encoding.status,
                manifestStatus: manifest.status
              })
            })
        })
    }).catch(error => {
      res.status(500).send(error);
      next(error);
    });
});

export const EncodeController: Router = router;
