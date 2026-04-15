import express from "express";
import passport from "../../config/passport.js";
import {
  postCrashReport,
  postMaintenanceRecord,
  postSensorData,
  postSensorDataV1,
} from "./handlers.js";
import { info } from "../../methods/logger.js";

const router = express.Router();

router.use(passport.authenticate("jwt-sensor", { session: false }));

router.post("/v1/include", postSensorDataV1);
router.post("/include", postSensorData);
router.post("/maintainRecord", postMaintenanceRecord);
router.post("/crashReport", postCrashReport);

router.get("/auth/token-check", (req, res) => {
  info(req.user.user_id, "token-check", req.ip);
  res.json({
    ok: true,
    user: req.user,
  });
});

export default router;
