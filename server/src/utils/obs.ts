import qiniu from 'qiniu'
import { env } from '../config/env'

interface QiniuConfig {
  accessKey: string
  secretKey: string
  bucket: string
  zone: qiniu.conf.Zone
}

function getConfig(): QiniuConfig {
  return {
    accessKey: env.STORAGE_ACCESS_KEY_ID!,
    secretKey: env.STORAGE_SECRET_ACCESS_KEY!,
    bucket: env.STORAGE_BUCKET!,
    zone: qiniu.zone.Zone_z0
  }
}

function ensureRequiredConfig(config: QiniuConfig) {
  if (!config.accessKey || !config.secretKey || !config.bucket) {
    throw new Error(
      '配置不完整，请设置 STORAGE_ACCESS_KEY_ID、STORAGE_SECRET_ACCESS_KEY、STORAGE_BUCKET'
    )
  }

  if (!env.STORAGE_DOMAIN) {
    throw new Error('配置不完整，请设置 STORAGE_DOMAIN')
  }
}

function createQiniuClient() {
  const config = getConfig()
  ensureRequiredConfig(config)

  const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
  const putPolicy = new qiniu.rs.PutPolicy({ scope: config.bucket })
  const uploadToken = putPolicy.uploadToken(mac)
  const formConfig = new qiniu.conf.Config()
  const bucketManager = new qiniu.rs.BucketManager(mac, formConfig)

  formConfig.zone = config.zone

  return {
    config,
    uploadToken,
    bucketManager
  }
}

function createObjectKey(sourceUrl: string) {
  const url = new URL(sourceUrl)
  const fileName = url.pathname.split('/').pop() || 'file'

  return `obs/${Date.now()}-${fileName}`
}

export async function putObject(sourceUrl: string) {
  const { config, bucketManager } = createQiniuClient()
  const objectKey = createObjectKey(sourceUrl)

  await new Promise<void>((resolve, reject) => {
    bucketManager.fetch(sourceUrl, config.bucket, objectKey, (error, body, info) => {
      if (error) {
        reject(error)
        return
      }

      if (!info || info.statusCode < 200 || info.statusCode >= 300) {
        reject(new Error(`对象存储抓取失败: ${info?.statusCode ?? 'unknown'}`))
        return
      }

      const responseBody = body as { key?: string; error?: string } | undefined

      if (responseBody?.error) {
        reject(new Error(responseBody.error))
        return
      }

      resolve()
    })
  })

  return {
    url: `${env.STORAGE_DOMAIN!.replace(/\/$/, '')}/${objectKey}`
  }
}
