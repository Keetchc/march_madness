// Centralised table names. Prefix with env if you want staging/prod separation.
const prefix = process.env.DYNAMO_TABLE_PREFIX ?? "mm";

export const TABLES = {
  USERS:      `${prefix}-users`,
  TOURNAMENT: `${prefix}-tournament`,
  BRACKETS:   `${prefix}-brackets`,
  GROUPS:     `${prefix}-groups`,
  SCORES:     `${prefix}-scores`,
} as const;

