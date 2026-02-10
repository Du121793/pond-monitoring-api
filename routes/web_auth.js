import express from "express";
import bcrypt from "bcrypt";
import passport from "../config/passport.js";
import { pool_RW } from "../SQL_Controller/db_connect.js";
import { createWebToken } from "../methods/auth.js";
import { info, error as logError } from "../methods/logger.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { user_name, password } = req.body;
  if (!user_name || !password) {
    return res
      .status(400)
      .json({ message: "缺少 user_name 或 password" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool_RW.query(
      "INSERT INTO users (user_name, password_hash) VALUES ($1, $2) RETURNING id, user_name, created_at",
      [user_name, passwordHash],
    );

    const user = result.rows[0];
    const token = createWebToken({ user_id: user.id });
    info(user.id, "網頁註冊已簽發 token", req.ip);
    return res.json({
      ok: true,
      token,
      user: {
        user_id: user.id,
        user_name: user.user_name,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ message: "user_name 已存在" });
    }
    logError("web-register", err, req);
    return res.status(500).json({ ok: false, message: "註冊失敗" });
  }
});

router.post("/login", (req, res, next) => {
  passport.authenticate("web-local", { session: false }, (err, user, info) => {
    if (err) {
      logError("web-login", err, req);
      return res.status(500).json({ ok: false, message: "登入失敗" });
    }
    if (!user) {
      return res.status(401).json({ message: info?.message || "登入失敗" });
    }

    const token = createWebToken({ user_id: user.user_id });
    info(user.user_id, "網頁登入已簽發 token", req.ip);
    return res.json({
      ok: true,
      token,
      user: {
        user_id: user.user_id,
        user_name: user.user_name,
        created_at: user.created_at,
      },
    });
  })(req, res, next);
});

export default router;
