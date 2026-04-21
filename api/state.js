import { Redis } from '@upstash/redis'

const STATE_KEY = 'tracker:app-state:main'

function getRedisClient() {
  const hasConfig =
    typeof process !== 'undefined' &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN

  if (!hasConfig) {
    return null
  }

  return Redis.fromEnv()
}

function parseBody(rawBody) {
  if (!rawBody) return {}
  if (typeof rawBody === 'object') return rawBody

  try {
    return JSON.parse(rawBody)
  } catch {
    return {}
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const redis = getRedisClient()
  if (!redis) {
    return res.status(503).json({
      error: 'Server storage is not configured.',
      configured: false,
      storage: 'none',
    })
  }

  try {
    if (req.method === 'GET') {
      const state = await redis.get(STATE_KEY)
      return res.status(200).json({
        state: state ?? null,
        configured: true,
        storage: 'upstash-redis',
      })
    }

    const body = parseBody(req.body)
    const state = body?.state ?? body

    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'Invalid state payload' })
    }

    await redis.set(STATE_KEY, state)
    return res.status(200).json({ ok: true, configured: true, storage: 'upstash-redis' })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to access server storage',
      configured: true,
      storage: 'upstash-redis',
    })
  }
}
