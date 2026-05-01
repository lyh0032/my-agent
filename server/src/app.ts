import cors from 'cors'
import express from 'express'

import { errorMiddleware } from './middlewares/error'
import { notFoundMiddleware } from './middlewares/notFound'
import { apiRouter } from './modules'

const app = express()

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://10.200.166.124:5174',
      'http://192.168.154.97:5173',
      'http://localhost:5174',
      'http://192.168.10.226:5173',
      'https://bin-distribution-intersection-following.trycloudflare.com'
    ],
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
