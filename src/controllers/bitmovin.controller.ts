import * as bitmovinService from "../services/bitmovin.service";
import { Response, Request, Router } from "express";

const router: Router = Router();

router.get('/listEncodings', (req: Request, res: Response) => {
  bitmovinService.getAllEncodings()
  .then(encodings => {
    res.send(encodings);
  })
})

export const BitmovinController: Router = router;
