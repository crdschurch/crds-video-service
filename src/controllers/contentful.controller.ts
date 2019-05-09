import * as contentfulService from "../services/contentful.service";
import { Response, Request, Router } from "express";
import { Message } from "../models/message.model";

const router: Router = Router();

router.get('/listMessages', (req: Request, res: Response) => {
  contentfulService.getEntries({ content_type: 'message' },[],0)
  .then(function(entries: any) {
    Promise.all(Message.createMessageArray(entries)).then(messages =>
      res.status(200).send(messages)
    ).catch(err => res.status(400).send(err)
);
  })
  .catch((err: any) => console.log(err));
});

export const ContentfulController: Router = router;
