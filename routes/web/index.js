import express from "express";
import passport from "../../config/passport.js";
import { info } from "../../methods/logger.js";

const router = express.Router();

router.use(passport.authenticate("jwt-web", { session: false }));

router.get("/auth/token-check", (req, res) => {
  info(req.user.user_id, "token-check", req.ip);
  res.json({
    ok: true,
    user: req.user,
  });
});

export default router;
