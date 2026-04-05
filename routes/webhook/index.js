import express from "express";
import grafanaRouter from "./grafana.js";

const router = express.Router();

router.use("/grafana", grafanaRouter);

export default router;
