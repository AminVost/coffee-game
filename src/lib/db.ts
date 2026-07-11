import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

type SqlValue = string | number | bigint | boolean | Date | Buffer | null;

const globalDb = globalThis as unknown as { cgsPool?: Pool };

export const db = globalDb.cgsPool ?? mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4"
});

if (process.env.NODE_ENV !== "production") globalDb.cgsPool = db;

export async function queryRows<T extends RowDataPacket[]>(sql: string, params: SqlValue[] = []) {
  const [rows] = await db.query<T>(sql, params);
  return rows;
}

export async function execute(sql: string, params: SqlValue[] = []) {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result;
}
