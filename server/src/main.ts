import { env } from './config/env'
import app from './app'

const port = env.PORT

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
