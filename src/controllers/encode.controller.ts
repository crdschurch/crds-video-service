import { Response, Request, Router } from "express";
import { Message } from "../models/message.model";
import * as BitmovinService from "../services/bitmovin.service";

const router: Router = Router();

router.post('/message', (req: Request, res: Response) => {
  Message.createMessageFromJson(req.body)
    .then(message => {
      BitmovinService.createEncoding(message).then((message) => {
        res.status(200).send(message);
      })
    })
    .catch(err => res.status(400).send(err))
});

export const EncodeController: Router = router;
