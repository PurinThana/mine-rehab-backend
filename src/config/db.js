import mysql from 'mysql2/promise'
import 'dotenv/config'

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  namedPlaceholders: true,
  dateStrings: true, // return DATE/DATETIME as 'YYYY-MM-DD' strings, not JS Date objects
})

export async function pingDb() {
  const conn = await pool.getConnection()
  try {
    await conn.query('SELECT 1')
  } finally {
    conn.release()
  }
}
