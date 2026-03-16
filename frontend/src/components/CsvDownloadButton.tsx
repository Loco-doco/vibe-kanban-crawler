import { exportCsvUrl } from '../api/leads'

interface Props {
  jobId: number | null
}

export default function CsvDownloadButton({ jobId }: Props) {
  const url = exportCsvUrl(jobId ? { job_id: jobId } : {})

  return (
    <a href={url} download className="btn-export">
      Download CSV
    </a>
  )
}
