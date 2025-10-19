import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { readFileSync } from "fs";
import { error as logError } from "../methods/logger.js";

const appConfig = JSON.parse(readFileSync("./config/app-config.json", "utf8"));

// JWT 密鑰 - 優先使用環境變數，若無則使用設定檔
const JWT_SECRET = process.env.JWT_SECRET;

// JWT 策略設定
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
  algorithms: ["HS256"],
};

// JWT 策略
passport.use(
  new JwtStrategy(jwtOptions, (payload, done) => {
    try {
      // 驗證 payload 中的必要欄位
      if (!payload.user_id || !payload.pond_id) {
        logError("認證失敗", new Error("無效的 token payload"), { body: payload });
        return done(null, false, { message: "無效的 token payload" });
      }

      // 返回使用者資訊
      return done(null, {
        user_id: payload.user_id,
        pond_id: payload.pond_id,
      });
    } catch (err) {
      logError("認證失敗", err, { body: payload });
      return done(err, false);
    }
  })
);

export default passport;
