import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const FILE_MAP: Record<string, string> = {
  manual: 'USER_MANUAL.md',
  changelog: 'VERSION_LOG.md'
}

/**
 * Reads a bundled markdown document by logical name.
 * Searches dev-root, dev resources/, and compiled process.resourcesPath.
 */
export function readAppDocument(docName: 'manual' | 'changelog'): string {
  const fileName = FILE_MAP[docName]
  if (!fileName) throw new Error(`Unknown document: ${docName}`)

  // Candidate paths: dev root, dev resources folder, packaged resources path
  const candidates = [
    join(app.getAppPath(), fileName),
    join(app.getAppPath(), 'resources', fileName),
    join(process.resourcesPath, fileName)
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, 'utf-8')
    }
  }

  throw new Error(`Document file not found for "${docName}". Searched: ${candidates.join(', ')}`)
}
