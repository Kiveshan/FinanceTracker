import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

import './db'
import accountsRouter from './routes/accounts.route'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// LEARNING NOTE: What does app.use('/api/accounts', accountsRouter) mean?
// It mounts the accounts router at the /api/accounts prefix.
// So router.get('/') becomes GET /api/accounts
// And router.get('/:id') becomes GET /api/accounts/123
// The /api prefix is a convention that clearly separates backend API
// routes from frontend routes. Every backend route will start with /api.
app.use('/api/accounts', accountsRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
