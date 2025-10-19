import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";

const connectionConfig = {
  user: process.env.DATABASE_USER,
  host: process.env.DATABASE_URL,
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
};

export const pool_RW = new Pool({
  ...connectionConfig,
  port: process.env.DATABASE_PORT_RW,
});

export const pool_RO = new Pool({
  ...connectionConfig,
  port: process.env.DATABASE_PORT_RO,
});
