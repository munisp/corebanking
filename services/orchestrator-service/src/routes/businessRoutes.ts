import { Router } from "express";
import { postCreateBusiness } from "../controllers/business/postCreateBusiness";
import { postKybCallback }     from "../controllers/kyb/postKybCallback";

const router = Router();

router.route("/").post(postCreateBusiness);
router.route("/kyb/callback").post(postKybCallback);

export default router;