import { Response, Request, Router } from "express";

const router: Router = Router();

router.get('/', (req: Request, res: Response) => {
  res.status(200).send('Video Service is live');
});

export const StatusController: Router = router;
