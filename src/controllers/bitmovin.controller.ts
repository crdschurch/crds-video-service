import * as bitmovinService from "../services/bitmovin.service";
import { Response, Router } from "express";

const router: Router = Router();

router.get('/listEncodings', (res: Response) => {
  bitmovinService.getAllEncodings()
    .then(encodings => {
      res.send(encodings);
    })
})

router.get('/getAllEncodingDurations', (res: Response) => {
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
    .catch(err => console.log(err));
})

export const BitmovinController: Router = router;
