import express from "express";
import pondsRouter from "./ponds.js";
import sensorsRouter from "./sensors.js";
import dailyLogsRouter from "./daily_logs.js";
import sensorDataRouter from "./sensor_data.js";

const router = express.Router();

router.use("/ponds", pondsRouter);
router.use("/sensors", sensorsRouter);
router.use("/daily-logs", dailyLogsRouter);
router.use("/sensor-data", sensorDataRouter);

export default router;
