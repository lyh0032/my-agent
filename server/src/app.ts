import cors from 'cors'
import express from 'express'

import { errorMiddleware } from './middlewares/error'
import { notFoundMiddleware } from './middlewares/notFound'
import { apiRouter } from './modules'

const app = express()

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  })
)
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'server is running'
  })
})

app.use('/api', apiRouter)
app.use(notFoundMiddleware)
app.use(errorMiddleware)

export default app
