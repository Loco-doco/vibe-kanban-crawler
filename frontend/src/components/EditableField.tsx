import { useState, useRef, useEffect } from 'react'

interface Props {
  label: string
  value: string | null
  rawValue?: string | null
  onSave: (value: string) => void
  type?: 'text' | 'textarea' | 'number'
  placeholder?: string
  disabled?: boolean
}

export default function EditableField({ label, value, rawValue, onSave, type = 'text', placeholder, disabled }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  const handleEdit = () => {
    if (disabled) return
    setDraft(value || '')
    setEditing(true)
  }

  const handleSave = () => {
    setEditing(false)
    if (draft !== (value || '')) {
      onSave(draft)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setDraft(value || '')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const isOverridden = rawValue !== undefined && rawValue !== null && value !== rawValue

  return (
    <div className="editable-field">
      <div className="editable-field-header">
        <span className="editable-field-label">{label}</span>
        {isOverridden && (
          <span className="editable-field-overridden" title={`원본: ${rawValue}`}>수정됨</span>
        )}
      </div>
      {editing ? (
        <div className="editable-field-edit">
          {type === 'textarea' ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              className="editable-field-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder={placeholder}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              className="editable-field-input"
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
            />
          )}
          <div className="editable-field-actions">
            <button className="btn-inline-save" onClick={handleSave}>저장</button>
            <button className="btn-inline-cancel" onClick={handleCancel}>취소</button>
          </div>
        </div>
      ) : (
        <div className="editable-field-display" onClick={handleEdit}>
          <span className={value ? '' : 'text-muted'}>
            {value || placeholder || '(없음)'}
          </span>
          {!disabled && <span className="editable-field-pencil">✏️</span>}
        </div>
      )}
      {isOverridden && (
        <div className="editable-field-raw">원본: {rawValue}</div>
      )}
    </div>
  )
}
