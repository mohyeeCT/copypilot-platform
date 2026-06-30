'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Download, ExternalLink, FileSpreadsheet, Sheet } from 'lucide-react'

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
  sheetsLabel?: string
  sheetsLoading?: boolean
  onCsv: () => void
  onXlsx: () => void
  onGoogleSheets: () => void | Promise<void>
  className?: string
}

function ExportMenuItem({ action, onSelect }: { action: ExportMenuAction; onSelect: () => void }) {
  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={() => {
        onSelect()
        void action.onClick()
      }}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-accent">
        {action.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight text-text">{action.label}</span>
        <span className="block text-xs leading-tight text-muted">{action.description}</span>
      </span>
    </button>
  )
}

export default function ExportMenu({
  csvLabel = 'CSV',
  xlsxLabel = 'XLSX',
  sheetsLabel,
  sheetsLoading = false,
  onCsv,
  onXlsx,
  onGoogleSheets,
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

  const downloadActions: ExportMenuAction[] = [
    {
      label: csvLabel,
      description: 'Comma-separated values',
      icon: <Download size={15} />,
      onClick: onCsv,
    },
    {
      label: xlsxLabel,
      description: 'Excel workbook',
      icon: <Sheet size={15} />,
      onClick: onXlsx,
    },
  ]
  const sendActions: ExportMenuAction[] = [
    {
      label: sheetsLoading ? 'Exporting...' : (sheetsLabel || 'Google Sheets'),
      description: 'Open in a new tab',
      icon: sheetsLoading ? <FileSpreadsheet size={15} /> : <ExternalLink size={15} />,
      onClick: onGoogleSheets,
      disabled: sheetsLoading,
    },
  ]

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
          className="dropdown-menu absolute right-0 top-[calc(100%+8px)] z-50 w-72 py-2"
        >
          <p className="px-4 pb-1 pt-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted">Download</p>
          {downloadActions.map(action => (
            <ExportMenuItem key={action.label} action={action} onSelect={() => setOpen(false)} />
          ))}
          <div className="mx-4 my-2 h-px bg-border" />
          <p className="px-4 pb-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted">Send to</p>
          {sendActions.map(action => (
            <ExportMenuItem key={action.label} action={action} onSelect={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  )
}
