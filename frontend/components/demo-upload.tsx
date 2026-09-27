'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, FileText, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDemoDocuments, uploadDemoFile, type DemoDocument } from '@/lib/demo-api'

const ACCEPT = '.txt,.md,.markdown,.pdf'
const MAX_TXT = 2 * 1024 * 1024
const MAX_PDF = 10 * 1024 * 1024

function formatCountdown(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return 'expired'
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return 'under a minute'
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  return `${hours}h ${minutes}m`
}

/**
 * Upload panel for the public Try page. Documents are indexed for the demo and
 * deleted automatically after 12 hours; the list shows every temporary upload
 * to the shared demo tenant (titles only, never file contents).
 */
export function DemoUpload() {
  const [documents, setDocuments] = useState<DemoDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getDemoDocuments()
      setDocuments(data.documents ?? [])
    } catch {
      // silent — the list is best-effort
    }
  }, [])

  useEffect(() => {
    refresh()
    tickRef.current = setInterval(refresh, 30000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  // Drop client-side entries whose expiry has actually passed (the server may
  // not have purged them yet).
  const now = Date.now()
  const visible = documents.filter((d) => new Date(d.expiresAt).getTime() > now)

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setSuccess('')

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    const isTxt =
      file.type === 'text/plain' ||
      file.type === 'text/markdown' ||
      /\.(txt|md|markdown)$/i.test(file.name)
    if (!isTxt && !isPdf) {
      setError('Only .txt, .md and .pdf files are supported')
      return
    }
    if (isPdf && file.size > MAX_PDF) {
      setError('PDFs must be 10MB or smaller')
      return
    }
    if (!isPdf && file.size > MAX_TXT) {
      setError('Text files must be 2MB or smaller')
      return
    }

    setUploading(true)
    try {
      const created = await uploadDemoFile(file)
      setSuccess(`“${created.title || file.name}” uploaded — it is now part of your answers.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section aria-labelledby="demo-upload-heading" className="border-t border-border px-4 py-6">
      <h2 id="demo-upload-heading" className="text-sm font-semibold text-fg">
        Try it with your own documents
      </h2>
      <p className="mt-1 text-xs text-fg-muted">
        Uploaded files are indexed for this demo and deleted automatically after 12 hours.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id="demo-upload-input"
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          className="sr-only"
        />
        <label
          htmlFor="demo-upload-input"
          className={cn(
            'inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-fg-secondary transition-colors hover:border-border-strong hover:text-fg',
            uploading && 'cursor-not-allowed opacity-60',
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Uploading…' : 'Add document'}
          <span className="sr-only">Upload a .txt, .md or .pdf file</span>
        </label>

        {uploading && (
          <span className="flex items-center gap-1.5 text-xs text-fg-muted" aria-live="polite">
            <Clock className="h-3.5 w-3.5 animate-pulse" />
            Uploading and indexing
          </span>
        )}
      </div>

      {error && (
        <p id="demo-upload-error" role="alert" aria-live="polite" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
      {success && (
        <p id="demo-upload-success" role="status" aria-live="polite" className="mt-3 text-xs text-success">
          {success}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {visible.length === 0 ? (
          <p className="text-xs text-fg-muted">No temporary documents yet.</p>
        ) : (
          visible.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-fg-muted" />
                <span className="truncate text-sm text-fg-secondary">{doc.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-fg-muted">
                <Clock className="h-3.5 w-3.5" />
                expires in {formatCountdown(doc.expiresAt, now)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}