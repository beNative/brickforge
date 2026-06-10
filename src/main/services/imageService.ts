import { getDb } from '../database/connection'
import { net } from 'electron'

// ─── Cache CRUD ───────────────────────────────────────────────

export function getCachedImage(url: string): { data: Buffer; contentType: string } | null {
  const db = getDb()
  const row = db
    .prepare('SELECT image_data, content_type FROM image_cache WHERE url = ?')
    .get(url) as { image_data: Buffer; content_type: string } | undefined

  if (!row) return null
  return { data: row.image_data, contentType: row.content_type }
}

export function cacheImage(url: string, data: Buffer, contentType: string): void {
  const db = getDb()
  db.prepare(
    'INSERT OR REPLACE INTO image_cache (url, image_data, content_type, size_bytes, cached_at) VALUES (?, ?, ?, ?, ?)'
  ).run(url, data, contentType, data.length, new Date().toISOString())
}

export function isImageCached(url: string): boolean {
  const db = getDb()
  const row = db.prepare('SELECT 1 FROM image_cache WHERE url = ?').get(url)
  return !!row
}

export function getImageCacheStats(): { totalImages: number; totalSizeBytes: number } {
  const db = getDb()
  const row = db
    .prepare(
      'SELECT count(*) as totalImages, COALESCE(sum(size_bytes), 0) as totalSizeBytes FROM image_cache'
    )
    .get() as { totalImages: number; totalSizeBytes: number }
  return row
}

export function clearImageCache(): void {
  const db = getDb()
  db.prepare('DELETE FROM image_cache').run()
}

// ─── URL collection helpers ───────────────────────────────────

/** Get all image URLs relevant to a set (set image + inventory part images) that are NOT cached yet. */
export function getUncachedUrlsForSet(setNum: string): string[] {
  const db = getDb()

  // 1. Set image URL
  const set = db.prepare('SELECT image_url FROM sets WHERE set_num = ?').get(setNum) as
    | { image_url: string | null }
    | undefined
  const setUrl = set?.image_url || null

  // 2. Inventory part image URLs
  const inventory = db
    .prepare('SELECT id FROM inventories WHERE set_num = ? ORDER BY version ASC LIMIT 1')
    .get(setNum) as { id: number } | undefined

  let partUrls: string[] = []
  if (inventory) {
    const rows = db
      .prepare(
        "SELECT DISTINCT img_url FROM inventory_parts WHERE inventory_id = ? AND img_url IS NOT NULL AND img_url != ''"
      )
      .all(inventory.id) as { img_url: string }[]
    partUrls = rows.map((r) => r.img_url)
  }

  // Combine all URLs
  const allUrls: string[] = []
  if (setUrl) allUrls.push(setUrl)
  allUrls.push(...partUrls)

  if (allUrls.length === 0) return []

  // Filter out already-cached URLs
  // Use a temp approach: check each URL (SQLite IN clause with many params is fine for hundreds)
  const placeholders = allUrls.map(() => '?').join(',')
  const cachedRows = db
    .prepare(`SELECT url FROM image_cache WHERE url IN (${placeholders})`)
    .all(...allUrls) as { url: string }[]

  const cachedSet = new Set(cachedRows.map((r) => r.url))
  return allUrls.filter((u) => !cachedSet.has(u))
}

// ─── Download engine ──────────────────────────────────────────

interface DownloadProgress {
  setNum: string
  total: number
  completed: number
  failed: number
  phase: 'downloading' | 'done' | 'error'
}

type ProgressCallback = (progress: DownloadProgress) => void

/** Download a single image URL. Returns null on failure. */
async function fetchImage(url: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const response = await net.fetch(url, {
      headers: { 'User-Agent': 'BrickForge/1.2.0 (Desktop App)' }
    })
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return { data: Buffer.from(arrayBuffer), contentType }
  } catch {
    return null
  }
}

/** Download and cache all uncached images for a given set with concurrency control. */
export async function downloadAndCacheSetImages(
  setNum: string,
  onProgress?: ProgressCallback
): Promise<{ total: number; downloaded: number; failed: number; skipped: number }> {
  const urls = getUncachedUrlsForSet(setNum)
  const total = urls.length

  if (total === 0) {
    onProgress?.({ setNum, total: 0, completed: 0, failed: 0, phase: 'done' })
    return { total: 0, downloaded: 0, failed: 0, skipped: 0 }
  }

  let completed = 0
  let failed = 0
  const CONCURRENCY = 6

  onProgress?.({ setNum, total, completed: 0, failed: 0, phase: 'downloading' })

  // Process in batches of CONCURRENCY
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const result = await fetchImage(url)
        if (result) {
          cacheImage(url, result.data, result.contentType)
          return true
        }
        return false
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        completed++
      } else {
        failed++
      }
    }

    onProgress?.({ setNum, total, completed, failed, phase: 'downloading' })
  }

  onProgress?.({ setNum, total, completed, failed, phase: 'done' })
  return { total, downloaded: completed, failed, skipped: 0 }
}

/** Download images for all sets in the user's collection. */
export async function downloadCollectionImages(
  onProgress?: (progress: {
    totalSets: number
    completedSets: number
    currentSet: string
    imageProgress: DownloadProgress
  }) => void
): Promise<{
  totalSets: number
  totalImages: number
  totalDownloaded: number
  totalFailed: number
}> {
  const db = getDb()
  const collectionSets = db.prepare('SELECT uc.set_num FROM user_collection uc').all() as {
    set_num: string
  }[]

  let totalImages = 0
  let totalDownloaded = 0
  let totalFailed = 0

  for (let i = 0; i < collectionSets.length; i++) {
    const setNum = collectionSets[i].set_num
    const stats = await downloadAndCacheSetImages(setNum, (imgProgress) => {
      onProgress?.({
        totalSets: collectionSets.length,
        completedSets: i,
        currentSet: setNum,
        imageProgress: imgProgress
      })
    })
    totalImages += stats.total
    totalDownloaded += stats.downloaded
    totalFailed += stats.failed
  }

  return { totalSets: collectionSets.length, totalImages, totalDownloaded, totalFailed }
}
