'use client'

import Link from 'next/link'

import SegmentedControl from '@/components/ui/SegmentedControl'
import Switch from '@/components/ui/Switch'

export type ScrapeProvider = 'jina' | 'firecrawl'

const SCRAPE_PROVIDERS: { value: ScrapeProvider; label: string }[] = [
  { value: 'jina', label: 'Jina' },
  { value: 'firecrawl', label: 'Firecrawl' },
]

interface ScraperControlsProps {
  enabled: boolean
  onEnabledChange?: (enabled: boolean) => void
  provider: ScrapeProvider
  onProviderChange: (provider: ScrapeProvider) => void
  firecrawlFallback: boolean
  onFirecrawlFallbackChange: (enabled: boolean) => void
  firecrawlKeyConfigured: boolean
  showEnabledToggle?: boolean
  enabledLabel?: string
}

export default function ScraperControls({
  enabled,
  onEnabledChange,
  provider,
  onProviderChange,
  firecrawlFallback,
  onFirecrawlFallbackChange,
  firecrawlKeyConfigured,
  showEnabledToggle = true,
  enabledLabel = 'Scrape pages for context',
}: ScraperControlsProps) {
  return (
    <div className="space-y-3">
      {showEnabledToggle ? (
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-sm">{enabledLabel}</span>
          <Switch
            ariaLabel={enabledLabel}
            checked={enabled}
            onChange={checked => {
              onEnabledChange?.(checked)
              if (!checked) onFirecrawlFallbackChange(false)
            }}
          />
        </div>
      ) : null}

      {enabled ? (
        <>
          <div className="space-y-2">
            <span className="block text-xs text-muted uppercase tracking-wider">Primary scraper</span>
            <SegmentedControl
              value={provider}
              onChange={onProviderChange}
              options={SCRAPE_PROVIDERS}
              ariaLabel="Primary page scraper"
            />
            {provider === 'firecrawl' && !firecrawlKeyConfigured ? (
              <p className="text-xs text-warning">
                Add a Firecrawl key in <Link href="/settings" className="text-accent">Settings</Link> before running.
              </p>
            ) : null}
          </div>

          {provider === 'jina' ? (
            <div className="flex items-center justify-between gap-4 py-2">
              <span className="text-sm">Firecrawl fallback</span>
              <Switch
                ariaLabel="Allow Firecrawl fallback"
                checked={firecrawlFallback}
                onChange={onFirecrawlFallbackChange}
                disabled={!firecrawlKeyConfigured}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
