import { env } from './config/env'
import app from './app'
import os from 'os'

const port = env.PORT

const getLocalIP = () => {
  const nets = os.networkInterfaces()

  // 直接遍历 nets 的所有值 (即所有的网卡数组)
  for (const network of Object.values(nets)) {
    if (!network) continue // 防御性编程，防止为空

    for (const net of network) {
      // 寻找 IPv4 且非内部的地址
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

app.listen(port, '0.0.0.0', () => {
  const localIp = getLocalIP()
  console.log(`Server running at http://localhost:${port} & http://${localIp}:${port}`)
})
