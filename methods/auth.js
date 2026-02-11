import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { error as logError } from "./logger.js";

let jwtExpiresIn = "24h";
try {
  const appConfig = JSON.parse(
    readFileSync(new URL("../config/app-config.json", import.meta.url), "utf8"),
  );
  if (appConfig?.auth?.jwtExpiresIn) {
    jwtExpiresIn = appConfig.auth.jwtExpiresIn;
  }
} catch (err) {
  logError("auth", err);
}

const getWebSecret = () => process.env.WEB_JWT_SECRET;
const getSensorSecret = () => process.env.SENSOR_JWT_SECRET;

const signToken = (payload, secret, options = {}) => {
  if (!secret) {
    throw new Error("JWT secret is missing");
  }
  const jwtOptions = {
    algorithm: "HS256",
  };
  if (Object.prototype.hasOwnProperty.call(options, "expiresIn")) {
    if (options.expiresIn !== undefined && options.expiresIn !== null) {
      jwtOptions.expiresIn = options.expiresIn;
    }
  } else {
    jwtOptions.expiresIn = jwtExpiresIn;
  }
  return jwt.sign(payload, secret, jwtOptions);
};

export const createWebToken = ({ user_id }) => {
  if (!user_id) {
    throw new Error("user_id is required");
  }
  return signToken({ user_id }, getWebSecret());
};

export const createSensorToken = ({ user_id, pond_id, sensor_id }) => {
  if (!user_id || !pond_id || !sensor_id) {
    throw new Error("user_id, pond_id, sensor_id are required");
  }
  return signToken({ user_id, pond_id, sensor_id }, getSensorSecret());
};

export const createPermanentSensorToken = ({ user_id, pond_id, sensor_id }) => {
  if (!user_id || !pond_id || !sensor_id) {
    throw new Error("user_id, pond_id, sensor_id are required");
  }
  return signToken(
    { user_id, pond_id, sensor_id },
    getSensorSecret(),
    { expiresIn: null },
  );
};

const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
};

const createAuthMiddleware = ({ getSecret, requiredFields, actor }) => {
  return (req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
      logError(actor, new Error("Missing Authorization header"), req);
      return res.sendStatus(401);
    }

    const secret = getSecret();
    if (!secret) {
      logError(actor, new Error("JWT secret is missing"), req);
      return res.sendStatus(500);
    }

    jwt.verify(token, secret, { algorithms: ["HS256"] }, (err, payload) => {
      if (err) {
        logError(actor, err, req);
        return res.sendStatus(403);
      }

      const missingField = requiredFields.find(
        (field) => payload?.[field] === undefined || payload?.[field] === null,
      );
      if (missingField) {
        logError(actor, new Error("Invalid token payload"), req);
        return res.status(401).json({ message: "Invalid token payload" });
      }

      req.user = payload;
      next();
    });
  };
};

export const requireWebAuth = createAuthMiddleware({
  getSecret: getWebSecret,
  requiredFields: ["user_id"],
  actor: "web-auth",
});

export const requireSensorAuth = createAuthMiddleware({
  getSecret: getSensorSecret,
  requiredFields: ["user_id", "pond_id", "sensor_id"],
  actor: "sensor-auth",
});
