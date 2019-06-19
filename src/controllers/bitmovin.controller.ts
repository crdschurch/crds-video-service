import * as bitmovinService from "../services/bitmovin.service";
import { Response, Request, Router } from "express";
import { NextFunction } from "connect";

const router: Router = Router();

router.get('/listEncodings', (req: Request, res: Response, next: NextFunction) => {
  bitmovinService.getAllEncodings()
    .then(encodings => {
      res.send(encodings);
    })
    .catch(err => next(err))
})

router.get('/getAllEncodingDurations', (req: Request, res: Response, next: NextFunction) => {
  bitmovinService.getAllEncodings()
    .then((encodings) => {
      Promise.all(encodings.map(encoding => {
        return bitmovinService.getEncodingStreamDuration(encoding)
          .then(duration => {
            return {
              "id": encoding.name,
              "duration": duration
            }
          }).catch(err => console.log(`The following error is most likely due to errored encodings => ${err.message}`))
      })).then(encodingDurations => res.send(encodingDurations))
    })
    .catch(err => next(err));
})

export const BitmovinController: Router = router;
