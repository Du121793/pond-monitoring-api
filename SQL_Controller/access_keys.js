import { pool_RW, pool_RO } from "./db_connect.js";

const EMPTY_BIGINT_ARRAY_SQL = "'{}'::bigint[]";

const getExecutor = (client) => client ?? pool_RW;

export const getUserPondsByIds = async (userId, pondIds) => {
  if (!pondIds || pondIds.length === 0) {
    return [];
  }
  const query = `
    SELECT id
    FROM ponds
    WHERE user_id = $1 AND id = ANY($2::bigint[])
  `;
  const { rows } = await pool_RO.query(query, [userId, pondIds]);
  return rows;
};

export const getUserSensorsByIds = async (userId, sensorIds) => {
  if (!sensorIds || sensorIds.length === 0) {
    return [];
  }
  const query = `
    SELECT s.id, s.pond_id
    FROM sensors s
    JOIN ponds p ON p.id = s.pond_id
    WHERE p.user_id = $1 AND s.id = ANY($2::bigint[])
  `;
  const { rows } = await pool_RO.query(query, [userId, sensorIds]);
  return rows;
};

export const getSensorsByPondIds = async (userId, pondIds) => {
  if (!pondIds || pondIds.length === 0) {
    return [];
  }
  const query = `
    SELECT s.id, s.pond_id
    FROM sensors s
    JOIN ponds p ON p.id = s.pond_id
    WHERE p.user_id = $1 AND s.pond_id = ANY($2::bigint[])
  `;
  const { rows } = await pool_RO.query(query, [userId, pondIds]);
  return rows;
};

export const createAccessKeyRecord = async ({
  userId,
  accessHash,
  accessPreview,
  pondIds,
  sensorIds,
  expiresAt,
  maxRequests,
}) => {
  const query = `
    INSERT INTO access_keys (
      user_id,
      access_hash,
      access_preview,
      pond_ids,
      sensor_ids,
      expires_at,
      max_requests
    ) VALUES (
      $1, $2, $3, $4::bigint[], $5::bigint[], $6, $7
    )
    RETURNING id, user_id, pond_ids, sensor_ids,
              max_requests, used_requests, expires_at,
              revoked_at, created_at, updated_at
  `;
  const values = [
    userId,
    accessHash,
    accessPreview,
    pondIds,
    sensorIds,
    expiresAt,
    maxRequests,
  ];
  const { rows } = await pool_RW.query(query, values);
  return rows[0];
};

export const getAccessKeysByUser = async (userId, { limit, offset }) => {
  const query = `
    SELECT id, user_id, pond_ids, sensor_ids,
           max_requests, used_requests, expires_at,
           revoked_at, created_at, updated_at, access_preview
    FROM access_keys
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await pool_RO.query(query, [userId, limit, offset]);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM access_keys
    WHERE user_id = $1
  `;
  const countResult = await pool_RO.query(countQuery, [userId]);
  return { rows, total: countResult.rows[0]?.total ?? 0 };
};

export const getAccessKeyById = async (accessId, userId) => {
  const query = `
    SELECT id, user_id, pond_ids, sensor_ids,
           max_requests, used_requests, expires_at,
           revoked_at, created_at, updated_at, access_preview
    FROM access_keys
    WHERE id = $1 AND user_id = $2
    LIMIT 1
  `;
  const { rows } = await pool_RO.query(query, [accessId, userId]);
  return rows[0] || null;
};

export const updateAccessKeyRecord = async (accessId, userId, data) => {
  const setClauses = [];
  const values = [];
  let valueCount = 1;

  if (data.pondIds !== undefined) {
    setClauses.push(`pond_ids = $${valueCount++}::bigint[]`);
    values.push(data.pondIds);
  }
  if (data.sensorIds !== undefined) {
    setClauses.push(`sensor_ids = $${valueCount++}::bigint[]`);
    values.push(data.sensorIds);
  }
  if (data.expiresAt) {
    setClauses.push(`expires_at = $${valueCount++}`);
    values.push(data.expiresAt);
  }
  if (Number.isFinite(data.maxRequests)) {
    setClauses.push(`max_requests = $${valueCount++}`);
    values.push(data.maxRequests);
  }

  if (setClauses.length === 0) {
    return getAccessKeyById(accessId, userId);
  }

  const query = `
    UPDATE access_keys
    SET ${setClauses.join(", ")}, updated_at = now()
    WHERE id = $${valueCount++} AND user_id = $${valueCount++}
    RETURNING id, user_id, pond_ids, sensor_ids,
              max_requests, used_requests, expires_at,
              revoked_at, created_at, updated_at, access_preview
  `;
  values.push(accessId, userId);

  const { rows } = await pool_RW.query(query, values);
  return rows[0] || null;
};

export const revokeAccessKeyRecord = async (accessId, userId) => {
  const query = `
    UPDATE access_keys
    SET revoked_at = now(), updated_at = now()
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `;
  const { rows } = await pool_RW.query(query, [accessId, userId]);
  return rows.length > 0;
};

export const deleteAccessKeyById = async (accessId, userId) => {
  const query = `
    DELETE FROM access_keys
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `;
  const { rows } = await pool_RW.query(query, [accessId, userId]);
  return rows.length > 0;
};

export const deleteAccessKeyByHash = async (accessHash) => {
  const query = `
    DELETE FROM access_keys
    WHERE access_hash = $1
    RETURNING id
  `;
  const { rows } = await pool_RW.query(query, [accessHash]);
  return rows.length > 0;
};

export const deleteExpiredAccessKeys = async () => {
  const query = `
    DELETE FROM access_keys
    WHERE expires_at <= now()
  `;
  const result = await pool_RW.query(query);
  return result.rowCount ?? 0;
};

export const getAccessKeyStatusByHash = async (accessHash) => {
  const query = `
    SELECT id, user_id, pond_ids, sensor_ids,
           max_requests, used_requests, expires_at,
           revoked_at, access_preview
    FROM access_keys
    WHERE access_hash = $1
    LIMIT 1
  `;
  const { rows } = await pool_RO.query(query, [accessHash]);
  return rows[0] || null;
};

export const consumeAccessKey = async (accessHash) => {
  const query = `
    UPDATE access_keys
    SET used_requests = used_requests + 1,
        last_used_at = now(),
        updated_at = now()
    WHERE access_hash = $1
      AND revoked_at IS NULL
      AND expires_at > now()
      AND used_requests < max_requests
    RETURNING id, user_id, pond_ids, sensor_ids,
              max_requests, used_requests, expires_at,
              revoked_at, access_preview
  `;
  const { rows } = await pool_RW.query(query, [accessHash]);
  return rows[0] || null;
};

export const removeAccessScopeReferences = async ({
  pondIds = [],
  sensorIds = [],
  client = null,
} = {}) => {
  const normalizedPondIds = Array.from(
    new Set(
      (pondIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  const normalizedSensorIds = Array.from(
    new Set(
      (sensorIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  if (normalizedPondIds.length === 0 && normalizedSensorIds.length === 0) {
    return { updated: 0, deleted: 0 };
  }

  const executor = getExecutor(client);
  const updateQuery = `
    UPDATE access_keys
    SET
      pond_ids = CASE
        WHEN cardinality($1::bigint[]) = 0 THEN pond_ids
        ELSE COALESCE(ARRAY(
          SELECT pond_id
          FROM unnest(pond_ids) AS pond_id
          WHERE NOT (pond_id = ANY($1::bigint[]))
        ), ${EMPTY_BIGINT_ARRAY_SQL})
      END,
      sensor_ids = CASE
        WHEN cardinality($2::bigint[]) = 0 THEN sensor_ids
        ELSE COALESCE(ARRAY(
          SELECT sensor_id
          FROM unnest(sensor_ids) AS sensor_id
          WHERE NOT (sensor_id = ANY($2::bigint[]))
        ), ${EMPTY_BIGINT_ARRAY_SQL})
      END,
      updated_at = NOW()
    WHERE
      (cardinality($1::bigint[]) > 0 AND pond_ids && $1::bigint[])
      OR
      (cardinality($2::bigint[]) > 0 AND sensor_ids && $2::bigint[])
    RETURNING id
  `;
  const updatedResult = await executor.query(updateQuery, [
    normalizedPondIds,
    normalizedSensorIds,
  ]);

  const deleteResult = await deleteEmptyAccessKeys({ client: executor });
  return {
    updated: updatedResult.rowCount ?? 0,
    deleted: deleteResult.deleted,
  };
};

export const deleteEmptyAccessKeys = async ({ client = null } = {}) => {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      DELETE FROM access_keys
      WHERE cardinality(pond_ids) = 0
        AND cardinality(sensor_ids) = 0
      RETURNING id
    `
  );
  return { deleted: result.rowCount ?? 0 };
};

export const pruneAccessKeysAgainstExistingResources = async ({
  client = null,
} = {}) => {
  const executor = getExecutor(client);
  const updateResult = await executor.query(`
    UPDATE access_keys ak
    SET
      pond_ids = COALESCE(ARRAY(
        SELECT pond_id
        FROM unnest(ak.pond_ids) AS pond_id
        JOIN ponds p ON p.id = pond_id
        WHERE p.user_id = ak.user_id
      ), ${EMPTY_BIGINT_ARRAY_SQL}),
      sensor_ids = COALESCE(ARRAY(
        SELECT sensor_id
        FROM unnest(ak.sensor_ids) AS sensor_id
        JOIN sensors s ON s.id = sensor_id
        JOIN ponds p ON p.id = s.pond_id
        WHERE p.user_id = ak.user_id
      ), ${EMPTY_BIGINT_ARRAY_SQL}),
      updated_at = NOW()
  `);

  const deleteResult = await deleteEmptyAccessKeys({ client: executor });
  return {
    updated: updateResult.rowCount ?? 0,
    deleted: deleteResult.deleted,
  };
};
