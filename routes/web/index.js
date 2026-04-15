import express from "express";
import passport from "../../config/passport.js";
import { info } from "../../methods/logger.js";
import pondsRouter from "./ponds/index.js";
import notificationsRouter from "./notifications.js";
import dailyLogOptionsRouter from "./daily_log_options.js";

const router = express.Router();

router.use(passport.authenticate("jwt-web", { session: false }));

router.use("/ponds", pondsRouter);
router.use("/notifications", notificationsRouter);
router.use("/daily-log-options", dailyLogOptionsRouter);

router.get("/auth/token-check", (req, res) => {
  info(req.user.user_id, "token-check", req.ip);
  res.json({
    ok: true,
    user: req.user,
  });
});

export default router;
