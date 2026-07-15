'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Download, ExternalLink, FileSpreadsheet, FileText, Sheet } from 'lucide-react'

type ExportMenuAction = {
  label: string
  description: string
  icon: ReactNode
  onClick: () => void | Promise<void>
  disabled?: boolean
}

type ExportMenuProps = {
  csvLabel?: string
  xlsxLabel?: string
  docxLabel?: string
  sheetsLabel?: string
  docsLabel?: string
  sheetsLoading?: boolean
  docsLoading?: boolean
  onCsv?: () => void
  onXlsx?: () => void
  onDocx?: () => void
  onGoogleSheets?: () => void | Promise<void>
  onGoogleDocs?: () => void | Promise<void>
  downloadActions?: ExportMenuAction[]
  className?: string
}

function ExportMenuItem({ action, onSelect }: { action: ExportMenuAction; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={action.disabled}
      onClick={() => {
        onSelect()
        void action.onClick()
      }}
      className="cp-menu-item cp-menu-item-rich disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-accent">
        {action.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.8125rem] font-semibold leading-tight text-text">{action.label}</span>
        <span className="block text-[0.6875rem] leading-tight text-muted">{action.description}</span>
      </span>
    </button>
  )
}

export default function ExportMenu({
  csvLabel = 'CSV',
  xlsxLabel = 'XLSX',
  docxLabel = 'DOCX',
  sheetsLabel,
  docsLabel,
  sheetsLoading = false,
  docsLoading = false,
  onCsv,
  onXlsx,
  onDocx,
  onGoogleSheets,
  onGoogleDocs,
  downloadActions: customDownloadActions = [],
  className = '',
}: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const downloadActions: ExportMenuAction[] = []
  if (onDocx) {
    downloadActions.push({
      label: docxLabel,
      description: 'Word document',
      icon: <FileText size={15} />,
      onClick: onDocx,
    })
  }
  if (onCsv) {
    downloadActions.push({
      label: csvLabel,
      description: 'Comma-separated values',
      icon: <Download size={15} />,
      onClick: onCsv,
    })
  }
  if (onXlsx) {
    downloadActions.push({
      label: xlsxLabel,
      description: 'Excel workbook',
      icon: <Sheet size={15} />,
      onClick: onXlsx,
    })
  }
  downloadActions.push(...customDownloadActions)
  const sendActions: ExportMenuAction[] = []
  if (onGoogleSheets) {
    sendActions.push({
      label: sheetsLoading ? 'Exporting...' : (sheetsLabel || 'Google Sheets'),
      description: 'Open in a new tab',
      icon: sheetsLoading ? <FileSpreadsheet size={15} /> : <ExternalLink size={15} />,
      onClick: onGoogleSheets,
      disabled: sheetsLoading,
    })
  }
  if (onGoogleDocs) {
    sendActions.push({
      label: docsLoading ? 'Exporting...' : (docsLabel || 'Google Docs'),
      description: 'Create a Google Doc',
      icon: docsLoading ? <FileText size={15} /> : <ExternalLink size={15} />,
      onClick: onGoogleDocs,
      disabled: docsLoading,
    })
  }

  return (
    <div ref={menuRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn-primary"
      >
        <Download size={14} />
        Export
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="cp-menu absolute right-0 top-[calc(100%+8px)] z-50 max-h-[70vh] w-72 overflow-y-auto py-2"
        >
          {downloadActions.length > 0 && (
            <>
              <p className="cp-menu-label">Download</p>
              {downloadActions.map(action => (
                <ExportMenuItem key={action.label} action={action} onSelect={() => setOpen(false)} />
              ))}
            </>
          )}
          {downloadActions.length > 0 && sendActions.length > 0 && <div className="cp-menu-divider" />}
          {sendActions.length > 0 && (
            <>
              <p className="cp-menu-label">Send to</p>
              {sendActions.map(action => (
                <ExportMenuItem key={action.label} action={action} onSelect={() => setOpen(false)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
