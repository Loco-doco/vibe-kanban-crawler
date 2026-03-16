import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createJob } from '../api/jobs'

export default function JobForm() {
  const [urls, setUrls] = useState('')
  const [maxRetries, setMaxRetries] = useState(3)
  const [delayMs, setDelayMs] = useState(2000)
  const [maxDepth, setMaxDepth] = useState(3)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setUrls('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const targets = urls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    if (targets.length === 0) return

    mutation.mutate({
      job: {
        targets,
        max_retries: maxRetries,
        delay_ms: delayMs,
        max_depth: maxDepth,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="job-form">
      <h3>New Crawl Job</h3>

      <label>
        Target URLs (one per line)
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={5}
          placeholder="https://youtube.com/@channelname&#10;https://instagram.com/username&#10;https://example.com"
          required
        />
      </label>

      <div className="form-row">
        <label>
          Max Retries
          <input
            type="number"
            value={maxRetries}
            onChange={(e) => setMaxRetries(Number(e.target.value))}
            min={0}
            max={10}
          />
        </label>

        <label>
          Delay (ms)
          <input
            type="number"
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            min={0}
            step={500}
          />
        </label>

        <label>
          Max Depth
          <input
            type="number"
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
            min={1}
            max={5}
          />
        </label>
      </div>

      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Start Crawling'}
      </button>

      {mutation.isError && (
        <p className="error">Error: {(mutation.error as Error).message}</p>
      )}
    </form>
  )
}
