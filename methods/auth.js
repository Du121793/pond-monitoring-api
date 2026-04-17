import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { error as logError } from "./logger.js";

const authConfig = {
  jwtExpiresIn: "24h",
  webJwtExpiresIn: null,
  webJwtPermanent: false,
  allowRegister: true,
};

try {
  const appConfig = JSON.parse(
    readFileSync(new URL("../config/app-config.json", import.meta.url), "utf8"),
  );
  if (appConfig?.auth?.jwtExpiresIn) {
    authConfig.jwtExpiresIn = appConfig.auth.jwtExpiresIn;
  }
  if (appConfig?.auth?.webJwtExpiresIn) {
    authConfig.webJwtExpiresIn = appConfig.auth.webJwtExpiresIn;
  }
  if (typeof appConfig?.auth?.webJwtPermanent === "boolean") {
    authConfig.webJwtPermanent = appConfig.auth.webJwtPermanent;
  }
  if (typeof appConfig?.auth?.allowRegister === "boolean") {
    authConfig.allowRegister = appConfig.auth.allowRegister;
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
    jwtOptions.expiresIn = authConfig.jwtExpiresIn;
  }
  return jwt.sign(payload, secret, jwtOptions);
};

export const getAuthConfig = () => ({ ...authConfig });

export const createWebToken = ({ user_id }) => {
  if (!user_id) {
    throw new Error("user_id is required");
  }
  if (authConfig.webJwtPermanent) {
    return signToken({ user_id }, getWebSecret(), { expiresIn: null });
  }
  if (authConfig.webJwtExpiresIn) {
    return signToken({ user_id }, getWebSecret(), {
      expiresIn: authConfig.webJwtExpiresIn,
    });
  }
  return signToken({ user_id }, getWebSecret());
};

export const createAiHelperToken = ({ user_id, roles = ["user"] }) => {
  if (!user_id) {
    throw new Error("user_id is required");
  }

  const expiresIn = process.env.AI_HELPER_JWT_EXPIRES_IN || "60s";

  return signToken(
    {
      user_id,
      roles,
      iss: "backend-api",
      aud: "ai-helper",
    },
    getWebSecret(),
    { expiresIn },
  );
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
  return signToken({ user_id, pond_id, sensor_id }, getSensorSecret(), {
    expiresIn: null,
  });
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

export const requireGrafanaBridge = (req, res, next) => {
  const token = req.cookies?.grafana_bridge;
  if (!token) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const payload = jwt.verify(token, process.env.GRAFANA_BRIDGE_SECRET);
    req.grafanaUser = payload;
    next();
  } catch (err) {
    return res.status(401).send("Unauthorized");
  }
};
