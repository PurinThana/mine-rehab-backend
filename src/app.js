import express from 'express'
import cors from 'cors'

import apiRoutes from './routes/index.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'

const app = express()

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
)
app.use(express.json({ limit: '1mb' }))

app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api', apiRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
