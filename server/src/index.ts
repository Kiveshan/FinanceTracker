import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// LEARNING NOTE: dotenv.config() must be called before any other imports
// that rely on process.env. It reads your .env file and loads the variables
// into process.env. Order matters here.
dotenv.config()

// Import database connection — this runs the connection test on startup
import './db'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
