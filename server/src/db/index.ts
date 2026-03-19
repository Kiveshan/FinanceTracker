import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

// LEARNING NOTE: What is a Pool?
// Instead of opening a new database connection for every request (slow),
// a Pool keeps several connections open and ready. When a request needs
// the database, it borrows a connection, uses it, and returns it.
// The pg library manages all of this automatically.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // LEARNING NOTE: SSL in development vs production
  // Railway (production) requires SSL. Your local PostgreSQL does not.
  // This line turns SSL on in production and off locally, automatically.
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
})

// Test the connection when the server starts
// LEARNING NOTE: pool.connect() borrows a connection from the pool.
// We immediately release it — we just want to know the connection works.
// If it fails, we log the error clearly so you know exactly what's wrong.
pool.connect((err, client, release) => {
  if (err) {
    console.error('Failed to connect to the database:', err.message)
    return
  }
  release()
  console.log('Database connected successfully')
})

// LEARNING NOTE: Why export a query helper instead of the pool directly?
// This wrapper means every file in the app imports { query } and calls
// query(sql, params) — they never touch the pool directly.
// If you ever need to change how queries work (add logging, timing, etc),
// you change it in one place here, not across every file.
export const query = (text: string, params?: unknown[]) => {
  return pool.query(text, params)
}

export default pool
