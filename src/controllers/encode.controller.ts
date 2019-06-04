import { Response, Request, Router, NextFunction } from "express";
import { Message } from "../models/message.model";
import * as BitmovinService from "../services/bitmovin.service";

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

export const EncodeController: Router = router;
