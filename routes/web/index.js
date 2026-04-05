import express from "express";
import passport from "../../config/passport.js";
import { info } from "../../methods/logger.js";
import pondsRouter from "./ponds/index.js";
import accessRouter from "./access.js";
import notificationsRouter from "./notifications.js";

const router = express.Router();

router.use(passport.authenticate("jwt-web", { session: false }));

router.use("/ponds", pondsRouter);
router.use("/access", accessRouter);
router.use("/notifications", notificationsRouter);

router.get("/auth/token-check", (req, res) => {
  info(req.user.user_id, "token-check", req.ip);
  res.json({
    ok: true,
    user: req.user,
  });
});

export default router;
