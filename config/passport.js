import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { pool_RW } from "../SQL_Controller/db_connect.js";
import { error as logError } from "../methods/logger.js";

const getWebSecret = () => process.env.WEB_JWT_SECRET;
const getSensorSecret = () => process.env.SENSOR_JWT_SECRET;

const buildJwtOptions = (secret) => ({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: secret,
  algorithms: ["HS256"],
});

passport.use(
  "web-local",
  new LocalStrategy(
    {
      usernameField: "user_name",
      passwordField: "password",
    },
    async (user_name, password, done) => {
      try {
        const result = await pool_RW.query(
          "SELECT id, user_name, password_hash, created_at FROM users WHERE user_name = $1",
          [user_name],
        );

        if (result.rows.length === 0) {
          return done(null, false, { message: "用戶名稱或密碼錯誤" });
        }

        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(
          password,
          user.password_hash,
        );
        if (!isValidPassword) {
          return done(null, false, { message: "用戶名稱或密碼錯誤" });
        }

        await pool_RW.query(
          "UPDATE users SET last_login_at = now() WHERE id = $1",
          [user.id],
        );

        return done(null, {
          user_id: user.id,
          user_name: user.user_name,
          created_at: user.created_at,
        });
      } catch (err) {
        logError("web-local", err);
        return done(err, false);
      }
    },
  ),
);

passport.use(
  "jwt-web",
  new JwtStrategy(buildJwtOptions(getWebSecret()), (payload, done) => {
    try {
      if (!payload?.user_id) {
        return done(null, false, { message: "Invalid token payload" });
      }
      return done(null, { user_id: payload.user_id });
    } catch (err) {
      logError("jwt-web", err);
      return done(err, false);
    }
  }),
);

passport.use(
  "jwt-sensor",
  new JwtStrategy(buildJwtOptions(getSensorSecret()), (payload, done) => {
    try {
      if (!payload?.user_id || !payload?.pond_id || !payload?.sensor_id) {
        return done(null, false, { message: "Invalid token payload" });
      }
      return done(null, {
        user_id: payload.user_id,
        pond_id: payload.pond_id,
        sensor_id: payload.sensor_id,
      });
    } catch (err) {
      logError("jwt-sensor", err);
      return done(err, false);
    }
  }),
);

export default passport;
