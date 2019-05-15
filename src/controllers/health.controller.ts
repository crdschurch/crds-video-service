import { Response, Request, Router } from "express";

const router: Router = Router();

router.get('/status', (req: Request, res: Response) => {
  res.sendStatus(200).send("Everything seems ok");
})

export const HealthController: Router = router;
