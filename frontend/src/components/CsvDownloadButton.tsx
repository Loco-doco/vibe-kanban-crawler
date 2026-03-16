import { exportCsvUrl } from '../api/leads'

interface Props {
  jobId: number | null
}

export default function CsvDownloadButton({ jobId }: Props) {
  const url = exportCsvUrl(jobId ? { job_id: jobId } : {})

  return (
    <a href={url} download className="btn-export">
      엑셀 파일로 내려받기
    </a>
  )
}
