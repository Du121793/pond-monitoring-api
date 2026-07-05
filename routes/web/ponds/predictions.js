import express from "express";
import { checkPondOwnership } from "../../../SQL_Controller/index.js";
import { getLatestForecasts, getLatestRiskScores } from "../../../SQL_Controller/predictions.js";

const router = express.Router({ mergeParams: true });

const roundNumber = (value, decimals = 3) => {
  if (value === null || value === undefined || value === "") {
    return value;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }
  const factor = 10 ** decimals;
  return Math.round(numeric * factor) / factor;
};

const formatForecastRow = (row) => ({
  ...row,
  current_value: roundNumber(row.current_value, 3),
  predicted_value: roundNumber(row.predicted_value, 3),
  delta_value: roundNumber(row.delta_value, 3),
});

const formatRiskScoreRow = (row) => ({
  ...row,
  risk_score: roundNumber(row.risk_score, 2),
  predicted_next_day_death_count: roundNumber(row.predicted_next_day_death_count, 2),
});

router.get('/latest-forecast', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = Number(req.params.pondId);

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: 'pond not found',
      });
    }

    const rows = await getLatestForecasts({ pondIds: [pondId] });
    return res.json({
      ok: true,
      pond_id: pondId,
      forecasts: rows.map(formatForecastRow),
      count: rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'failed to fetch latest forecast',
      detail: error.message,
    });
  }
});

router.get('/latest-risk-score', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = Number(req.params.pondId);

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: 'pond not found',
      });
    }

    const rows = await getLatestRiskScores({ pondIds: [pondId] });
    const latest = rows[0] ? formatRiskScoreRow(rows[0]) : null;
    if (!latest) {
      return res.status(404).json({
        ok: false,
        error: 'latest risk score not found',
      });
    }

    return res.json({
      ok: true,
      pond_id: pondId,
      risk_score: latest,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'failed to fetch latest risk score',
      detail: error.message,
    });
  }
});

export default router;
