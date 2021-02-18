import * as bitmovinService from "../services/bitmovin.service";
import { getAllMessages, buildResponse } from "../services/contentful.service";
import { Response, Request, Router } from "express";
import { NextFunction } from "connect";
import bodyParser from "body-parser";

const router: Router = Router();

router.get(
  "/listEncodings",
  (req: Request, res: Response, next: NextFunction) => {
    bitmovinService
      .getAllEncodings()
      .then((encodings) => {
        res.send(encodings);
      })
      .catch((err) => next(err));
  }
);

router.get(
  "/getAllEncodingDurations",
  (req: Request, res: Response, next: NextFunction) => {
    bitmovinService
      .getAllEncodings()
      .then((encodings) => {
        getAllMessages().then((messages) => {
          Promise.all(
            encodings.map((encoding) => {
              let encodingMessage = messages.filter((message) =>
                message.fields.bitmovin_url.includes(encoding.name)
              );
              encodingMessage["createdAt"] = encoding.createdAt;
              return bitmovinService
                .getEncodingStreamDuration(encoding)
                .then(async (duration) => {
                  return {
                    bitmovinEncodingId: encoding.name,
                    duration: duration,
                    messageDetails: buildResponse(encodingMessage),
                  };
                })
                .catch((err) =>
                  console.log(
                    `The following error is most likely due to an encoding error => ${err.message}`
                  )
                );
            })
          ).then((encodingDurations) => res.send(encodingDurations));
        });
      })
      .catch((err) => next(err));
  }
);

router.get(
  "/getEncodingDuration",
  bodyParser.json(),
  (req: Request, res: Response, next: NextFunction) => {
    bitmovinService
      .getEncoding(req.body.encodingName)
      .then((encoding) => {
        return bitmovinService.getEncodingStreamDuration(encoding);
      })
      .then((duration) => res.send({ duration: Math.round(duration) }))
      .catch((err) => console.error(err));
  }
);

export const BitmovinController: Router = router;
