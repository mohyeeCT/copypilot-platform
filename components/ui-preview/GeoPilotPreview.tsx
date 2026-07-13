'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bot,
  Braces,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Globe2,
  HelpCircle,
  Layers3,
  Link2,
  Menu,
  MessageSquareText,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  Radar,
  Search,
  Settings,
  Sparkles,
  Sun,
  Tag,
  Target,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './GeoPilotPreview.module.css'

type Surface = 'all' | 'google' | 'chatgpt' | 'gemini' | 'claude'

type ResultRow = {
  id: number
  prompt: string
  collection: string
  surface: Exclude<Surface, 'all'>
  mentioned: boolean
  prominence: 'Early' | 'Middle' | 'Late' | '-'
  sentiment: 'Positive' | 'Neutral' | '-'
  citations: number
  ownedCitations: number
  checked: string
  summary: string
  response: string
  citedDomains: string[]
}

const NAV_GROUPS = [
  {
    label: 'Create',
    items: [
      { label: 'FAQ Copy', icon: HelpCircle, href: '/faq/jobs' },
      { label: 'Page Intro', icon: FileText, href: '/intro/jobs' },
      { label: 'Meta Copy', icon: Tag, href: '/meta/jobs' },
      { label: 'All in One', icon: Layers3, href: '/all-in-one/jobs' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Brand Pulse', icon: Radar, href: '/brand-mentions' },
      { label: 'GEOPilot', icon: Bot, href: '/ui-preview/geopilot', active: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Schema Generator', icon: Braces, href: '/schema/jobs' },
      { label: 'Indexer', icon: Link2, href: '/indexer/jobs' },
    ],
  },
]

const SURFACE_OPTIONS: Array<{ value: Surface; label: string; shortLabel: string }> = [
  { value: 'all', label: 'All surfaces', shortLabel: 'All' },
  { value: 'google', label: 'Google AI Overview', shortLabel: 'Google AIO' },
  { value: 'chatgpt', label: 'ChatGPT', shortLabel: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini', shortLabel: 'Gemini' },
  { value: 'claude', label: 'Claude', shortLabel: 'Claude' },
]

const RUN_SURFACES = SURFACE_OPTIONS.filter(option => option.value !== 'all') as Array<{
  value: Exclude<Surface, 'all'>
  label: string
  shortLabel: string
}>

const RESULTS: ResultRow[] = [
  {
    id: 1,
    prompt: 'Where can I find the best halal burger in Detroit?',
    collection: 'Local discovery',
    surface: 'google',
    mentioned: true,
    prominence: 'Early',
    sentiment: 'Positive',
    citations: 4,
    ownedCitations: 2,
    checked: '12 min ago',
    summary: 'Taystee is named among the leading halal burger options in Detroit and appears in the opening recommendation group.',
    response: 'For halal burgers in Detroit, Taystee is a strong option for loaded burgers and late-night dining. Other frequently recommended choices include ...',
    citedDomains: ['taysteesburger.com', 'yelp.com', 'visitdetroit.com'],
  },
  {
    id: 2,
    prompt: 'Best halal burger near Dearborn for a family dinner',
    collection: 'Family occasions',
    surface: 'chatgpt',
    mentioned: true,
    prominence: 'Early',
    sentiment: 'Positive',
    citations: 3,
    ownedCitations: 1,
    checked: '18 min ago',
    summary: 'Taystee is recommended early, with emphasis on menu variety and convenient locations.',
    response: 'Taystee is one of the better-known halal burger restaurants around Detroit and Dearborn. It is a useful choice for groups because ...',
    citedDomains: ['taysteesburger.com', 'tripadvisor.com', 'halalrun.com'],
  },
  {
    id: 3,
    prompt: 'What are the top late-night burger spots in Detroit?',
    collection: 'Local discovery',
    surface: 'gemini',
    mentioned: true,
    prominence: 'Middle',
    sentiment: 'Positive',
    citations: 5,
    ownedCitations: 0,
    checked: '24 min ago',
    summary: 'Taystee appears in the middle of the answer, but the response relies entirely on third-party sources.',
    response: 'Detroit has several late-night burger options. After the downtown staples, Taystee is also regularly highlighted for its creative halal menu ...',
    citedDomains: ['yelp.com', 'doordash.com', 'restaurantji.com'],
  },
  {
    id: 4,
    prompt: 'Best smash burgers around Detroit metro',
    collection: 'Category comparison',
    surface: 'claude',
    mentioned: false,
    prominence: '-',
    sentiment: '-',
    citations: 4,
    ownedCitations: 0,
    checked: '31 min ago',
    summary: 'The answer names four competitors but does not mention Taystee.',
    response: 'Some of the most discussed smash burger options in the Detroit metro include ...',
    citedDomains: ['detroit.eater.com', 'yelp.com', 'hourdetroit.com'],
  },
  {
    id: 5,
    prompt: 'Halal restaurants for families visiting Detroit',
    collection: 'Family occasions',
    surface: 'chatgpt',
    mentioned: true,
    prominence: 'Middle',
    sentiment: 'Neutral',
    citations: 4,
    ownedCitations: 2,
    checked: '42 min ago',
    summary: 'Taystee is included as a casual family option, supported by two owned-domain citations.',
    response: 'Families looking for halal food in Detroit can choose from Middle Eastern restaurants, casual burger spots such as Taystee, and ...',
    citedDomains: ['taysteesburger.com', 'visitdetroit.com', 'halalfoodjunkiee.com'],
  },
  {
    id: 6,
    prompt: 'Detroit burger restaurants with unusual toppings',
    collection: 'Category comparison',
    surface: 'google',
    mentioned: true,
    prominence: 'Late',
    sentiment: 'Positive',
    citations: 6,
    ownedCitations: 1,
    checked: '1 hr ago',
    summary: 'Taystee is mentioned late for its loaded menu; competitor citations receive more prominent placement.',
    response: 'For less traditional burgers, Detroit diners often compare several local menus. Taystee stands out for loaded combinations including ...',
    citedDomains: ['taysteesburger.com', 'detroit.eater.com', 'metrotimes.com'],
  },
]

const METRICS = [
  { label: 'Visibility', value: '67%', change: '+8.2%', direction: 'up', note: '4 of 6 prompts', icon: Target },
  { label: 'Share of voice', value: '42%', change: '+3.6%', direction: 'up', note: 'vs. 4 competitors', icon: BarChart3 },
  { label: 'Owned citations', value: '35%', change: '-2.1%', direction: 'down', note: '6 of 17 citations', icon: Link2 },
  { label: 'AI Overview coverage', value: '75%', change: '+5.0%', direction: 'up', note: 'Google searches', icon: Sparkles },
]

const SURFACE_METRICS = [
  { label: 'Google AI Overview', value: 78, change: '+10%', tone: 'google' },
  { label: 'ChatGPT', value: 72, change: '+7%', tone: 'chatgpt' },
  { label: 'Gemini', value: 61, change: '+4%', tone: 'gemini' },
  { label: 'Claude', value: 48, change: '-2%', tone: 'claude' },
]

function PreviewDialog({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={clsx(styles.dialog, className)}
      aria-labelledby={labelledBy}
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {children}
    </dialog>
  )
}

function SurfaceMark({ surface }: { surface: Exclude<Surface, 'all'> }) {
  const label = SURFACE_OPTIONS.find(option => option.value === surface)?.shortLabel || surface
  return (
    <span className={clsx(styles.surfaceMark, styles[`surface_${surface}`])}>
      <span aria-hidden="true" className={styles.surfaceDot} />
      <span className={styles.surfaceLabel}>{label}</span>
    </span>
  )
}

function MetricStrip() {
  return (
    <section className={styles.metricStrip} aria-label="Key visibility metrics">
      {METRICS.map(metric => {
        const Icon = metric.icon
        const Direction = metric.direction === 'up' ? ArrowUp : ArrowDown
        return (
          <article key={metric.label} className={styles.metricItem}>
            <div className={styles.metricLabelRow}>
              <span className={styles.metricIcon}><Icon size={16} /></span>
              <span className={styles.metricLabel}>{metric.label}</span>
              <button className={styles.helpButton} aria-label={`About ${metric.label}`} title={`About ${metric.label}`}>
                <CircleHelp size={13} />
              </button>
            </div>
            <div className={styles.metricValueRow}>
              <strong>{metric.value}</strong>
              <span className={metric.direction === 'up' ? styles.positive : styles.negative}>
                <Direction size={12} /> {metric.change}
              </span>
            </div>
            <p>{metric.note}</p>
          </article>
        )
      })}
    </section>
  )
}

function VisibilityChart() {
  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartYAxis} aria-hidden="true">
        <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
      </div>
      <div className={styles.chartCanvas}>
        <svg viewBox="0 0 720 230" role="img" aria-label="Visibility trend increased from 48 percent to 67 percent over 30 days">
          <g className={styles.gridLines}>
            <line x1="0" y1="15" x2="720" y2="15" />
            <line x1="0" y1="65" x2="720" y2="65" />
            <line x1="0" y1="115" x2="720" y2="115" />
            <line x1="0" y1="165" x2="720" y2="165" />
            <line x1="0" y1="215" x2="720" y2="215" />
          </g>
          <polyline className={styles.chartComparison} points="0,160 90,156 180,165 270,148 360,151 450,140 540,144 630,132 720,136" />
          <polyline className={styles.chartPrimary} points="0,150 90,142 180,148 270,123 360,128 450,96 540,101 630,74 720,80" />
          <circle className={styles.chartPoint} cx="720" cy="80" r="5" />
        </svg>
        <div className={styles.chartXAxis} aria-hidden="true">
          <span>14 Jun</span><span>21 Jun</span><span>28 Jun</span><span>5 Jul</span><span>13 Jul</span>
        </div>
      </div>
    </div>
  )
}

function Sidebar({
  collapsed,
  mobileOpen,
  onCollapse,
  onClose,
}: {
  collapsed: boolean
  mobileOpen: boolean
  onCollapse: () => void
  onClose: () => void
}) {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className={clsx(styles.mobileScrim, styles.mobileScrimOpen)}
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
      <aside className={clsx(styles.sidebar, collapsed && styles.sidebarCollapsed, mobileOpen && styles.sidebarMobileOpen)}>
        <div className={styles.brandRow}>
          <Link href="/ui-preview/geopilot" className={styles.brand} aria-label="CopyPilot preview home">
            <Image src="/favicon-32x32.png" alt="" width={28} height={28} className={styles.logo} />
            <span className={styles.brandName}>CopyPilot</span>
          </Link>
          <button type="button" className={styles.mobileClose} aria-label="Close navigation" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <button type="button" className={styles.workspaceButton} title={collapsed ? 'Northline Agency' : undefined}>
          <span className={styles.workspaceAvatar}>N</span>
          <span className={styles.workspaceText}>
            <strong>Northline Agency</strong>
            <small>3 client profiles</small>
          </span>
          <ChevronDown className={styles.workspaceChevron} size={15} />
        </button>

        <nav className={styles.navigation} aria-label="Main navigation">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className={styles.navGroup}>
              <p className={styles.navLabel}>{group.label}</p>
              {group.items.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={clsx(styles.navItem, item.active && styles.navItemActive)}
                    title={collapsed ? item.label : undefined}
                    onClick={onClose}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                    {item.active ? <span className={styles.activeRail} /> : null}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/settings" className={styles.navItem} title={collapsed ? 'Settings' : undefined}>
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          <div className={styles.accountRow} title={collapsed ? 'Mohye El-Din' : undefined}>
            <span className={styles.accountAvatar}>ME</span>
            <span className={styles.accountText}>
              <strong>Mohye El-Din</strong>
              <small>Agency workspace</small>
            </span>
            <MoreHorizontal className={styles.accountMore} size={16} />
          </div>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={onCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            <span>Collapse sidebar</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default function GeoPilotPreview() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileViewport, setMobileViewport] = useState(false)
  const [dark, setDark] = useState(false)
  const [surface, setSurface] = useState<Surface>('all')
  const [range, setRange] = useState('30d')
  const [query, setQuery] = useState('')
  const [runOpen, setRunOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [selectedRunSurfaces, setSelectedRunSurfaces] = useState<Array<Exclude<Surface, 'all'>>>(['google', 'chatgpt', 'gemini', 'claude'])
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const update = () => setMobileViewport(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filteredResults = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return RESULTS.filter(row => {
      const matchesSurface = surface === 'all' || row.surface === surface
      const matchesQuery = !normalized || row.prompt.toLowerCase().includes(normalized) || row.collection.toLowerCase().includes(normalized)
      return matchesSurface && matchesQuery
    })
  }, [query, surface])

  const measurementCount = selectedRunSurfaces.length * 6

  function toggleRunSurface(value: Exclude<Surface, 'all'>) {
    setSelectedRunSurfaces(current => {
      if (current.includes(value)) {
        return current.length === 1 ? current : current.filter(item => item !== value)
      }
      return [...current, value]
    })
  }

  return (
    <div className={styles.preview} data-preview-theme={dark ? 'dark' : 'light'}>
      {!mobileViewport || mobileOpen ? (
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCollapse={() => setCollapsed(value => !value)}
          onClose={() => setMobileOpen(false)}
        />
      ) : null}

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarStart}>
            <button type="button" className={styles.mobileMenu} aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <Menu size={19} />
            </button>
            <div className={styles.breadcrumbs} aria-label="Breadcrumb">
              <span>Insights</span>
              <ChevronRight size={13} />
              <strong>GEOPilot</strong>
            </div>
          </div>
          <button type="button" className={styles.commandButton} onClick={() => setCommandOpen(true)}>
            <Search size={15} />
            <span>Search clients, prompts, and jobs</span>
            <kbd><Command size={11} /> K</kbd>
          </button>
          <div className={styles.topbarActions}>
            <span className={styles.previewBadge}>UI preview</span>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={dark ? 'Use light theme' : 'Use dark theme'}
              title={dark ? 'Use light theme' : 'Use dark theme'}
              onClick={() => setDark(value => !value)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.profileHeader}>
            <div>
              <Link href="/geopilot" className={styles.backLink}><ArrowLeft size={14} /> All profiles</Link>
              <div className={styles.titleRow}>
                <span className={styles.clientMark}>T</span>
                <div>
                  <div className={styles.profileTitleLine}>
                    <h1>Taystee</h1>
                    <span className={styles.statusBadge}><span /> Active</span>
                  </div>
                  <p>taysteesburger.com <span>/</span> Detroit, US <span>/</span> Desktop <span>/</span> English</p>
                </div>
              </div>
            </div>
            <div className={styles.profileActions}>
              <button type="button" className={styles.secondaryButton}><Download size={15} /> Export</button>
              <button type="button" className={styles.secondaryButton}><Pencil size={15} /> Edit profile</button>
              <button type="button" className={styles.primaryButton} onClick={() => setRunOpen(true)}><Play size={15} /> Run now</button>
            </div>
          </section>

          <nav className={styles.pageTabs} aria-label="GEOPilot profile views">
            <button type="button" className={styles.pageTabActive}>Overview</button>
            <button type="button">Prompts <span>6</span></button>
            <button type="button">Results <span>124</span></button>
            <button type="button">Opportunities <span>8</span></button>
          </nav>

          <MetricStrip />

          <div className={styles.dashboardGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Visibility trend</h2>
                  <p>Share of successful prompts that mention Taystee</p>
                </div>
                <div className={styles.rangeControl} aria-label="Chart date range">
                  {['7d', '30d', '90d'].map(option => (
                    <button
                      key={option}
                      type="button"
                      className={range === option ? styles.segmentActive : undefined}
                      aria-pressed={range === option}
                      onClick={() => setRange(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.chartLegend}>
                <span><i className={styles.legendPrimary} /> Taystee</span>
                <span><i className={styles.legendComparison} /> Competitor average</span>
              </div>
              <VisibilityChart />
            </section>

            <section className={clsx(styles.panel, styles.surfacePanel)}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>By surface</h2>
                  <p>Visibility across measured sources</p>
                </div>
                <button type="button" className={styles.iconButton} aria-label="Surface metric options" title="Surface metric options">
                  <MoreHorizontal size={17} />
                </button>
              </div>
              <div className={styles.surfaceRail}>
                {SURFACE_METRICS.map(item => (
                  <div key={item.label} className={styles.surfaceMetric}>
                    <div className={styles.surfaceMetricTop}>
                      <span><i className={styles[`rail_${item.tone}`]} /> {item.label}</span>
                      <strong>{item.value}%</strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <span className={styles[`bar_${item.tone}`]} style={{ width: `${item.value}%` }} />
                    </div>
                    <small className={item.change.startsWith('+') ? styles.positive : styles.negative}>{item.change} this period</small>
                  </div>
                ))}
              </div>
              <div className={styles.lastRun}>
                <span className={styles.runStatusIcon}><Check size={14} /></span>
                <div><strong>Last run completed</strong><small>24 measurements, 12 minutes ago</small></div>
                <button type="button" aria-label="Open latest run" title="Open latest run"><ChevronRight size={16} /></button>
              </div>
            </section>
          </div>

          <section className={clsx(styles.panel, styles.resultsPanel)}>
            <div className={styles.resultsHeader}>
              <div>
                <h2>Latest measurements</h2>
                <p>Deterministic brand matching across all tracked prompts</p>
              </div>
              <button type="button" className={styles.textButton}><span>View all results</span><ChevronRight size={14} /></button>
            </div>

            <div className={styles.tableToolbar}>
              <label className={styles.tableSearch}>
                <Search size={15} />
                <span className={styles.srOnly}>Search measurements</span>
                <input
                  type="search"
                  name="measurement-search"
                  placeholder="Search prompts"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                />
                {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button> : null}
              </label>
              <div className={styles.surfaceFilters} aria-label="Filter by surface">
                {SURFACE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={surface === option.value ? styles.filterActive : undefined}
                    aria-pressed={surface === option.value}
                    onClick={() => setSurface(option.value)}
                  >
                    {option.shortLabel}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.filterButton}><Filter size={14} /> Filters</button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.resultsTable}>
                <thead>
                  <tr>
                    <th>Prompt</th>
                    <th>Surface</th>
                    <th>Mention</th>
                    <th>Prominence</th>
                    <th>Citations</th>
                    <th>Checked</th>
                    <th><span className={styles.srOnly}>Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map(row => (
                    <tr key={row.id} onClick={() => setSelectedResult(row)}>
                      <td>
                        <button type="button" className={styles.promptButton} onClick={() => setSelectedResult(row)}>
                          <strong>{row.prompt}</strong>
                          <small>{row.collection}</small>
                        </button>
                      </td>
                      <td><SurfaceMark surface={row.surface} /></td>
                      <td>
                        <span className={row.mentioned ? styles.mentionYes : styles.mentionNo}>
                          {row.mentioned ? <Check size={12} /> : <X size={12} />}
                          <span className={styles.mentionLabel}>{row.mentioned ? 'Mentioned' : 'Not found'}</span>
                        </span>
                      </td>
                      <td><span className={styles.cellMuted}>{row.prominence}</span></td>
                      <td><span className={styles.citationCell}>{row.citations}<small>{row.ownedCitations} owned</small></span></td>
                      <td><span className={styles.timeCell}><Clock3 size={13} /> {row.checked}</span></td>
                      <td><button type="button" className={styles.rowAction} aria-label={`Inspect result for ${row.prompt}`}><ChevronRight size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredResults.length ? (
                <div className={styles.emptyState}>
                  <Search size={21} />
                  <strong>No matching measurements</strong>
                  <p>Clear the search or choose another surface.</p>
                  <button type="button" onClick={() => { setQuery(''); setSurface('all') }}>Clear filters</button>
                </div>
              ) : null}
            </div>

            <footer className={styles.tableFooter}>
              <span>Showing {filteredResults.length} of 124 measurements</span>
              <div>
                <button type="button" aria-label="Previous page" disabled><ChevronLeft size={15} /></button>
                <span>Page 1 of 21</span>
                <button type="button" aria-label="Next page"><ChevronRight size={15} /></button>
              </div>
            </footer>
          </section>
        </main>
      </div>

      <PreviewDialog open={runOpen} onClose={() => setRunOpen(false)} labelledBy="run-dialog-title">
        <div className={styles.dialogCard}>
          <div className={styles.dialogHeader}>
            <span className={styles.dialogIcon}><Play size={18} /></span>
            <div>
              <h2 id="run-dialog-title">Run Taystee measurements</h2>
              <p>Choose which sources to check for all 6 active prompts.</p>
            </div>
            <button type="button" className={styles.dialogClose} aria-label="Close run dialog" onClick={() => setRunOpen(false)}><X size={17} /></button>
          </div>

          <fieldset className={styles.runOptions}>
            <legend>Measurement sources</legend>
            {RUN_SURFACES.map(option => {
              const selected = selectedRunSurfaces.includes(option.value)
              return (
                <label key={option.value} className={clsx(styles.runOption, selected && styles.runOptionSelected)}>
                  <input type="checkbox" checked={selected} onChange={() => toggleRunSurface(option.value)} />
                  <span className={styles.runOptionCheck}>{selected ? <Check size={13} /> : null}</span>
                  <span className={clsx(styles.runSurfaceIcon, styles[`run_${option.value}`])}>
                    {option.value === 'google' ? <Globe2 size={17} /> : <MessageSquareText size={17} />}
                  </span>
                  <span><strong>{option.label}</strong><small>{option.value === 'google' ? 'Organic search result' : 'Web-enabled response'}</small></span>
                </label>
              )
            })}
          </fieldset>

          <div className={styles.runSummary}>
            <div><strong>6</strong><span>Prompts</span></div>
            <div><strong>{selectedRunSurfaces.length}</strong><span>Sources</span></div>
            <div><strong>{measurementCount}</strong><span>Measurements</span></div>
          </div>

          <div className={styles.dialogFooter}>
            <p><Clock3 size={14} /> Usually completes in 4-7 minutes</p>
            <button type="button" className={styles.secondaryButton} onClick={() => setRunOpen(false)}>Cancel</button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setRunOpen(false)
                setToast(`Preview only: ${measurementCount} measurements were not started.`)
              }}
            >
              <Play size={14} /> Start {measurementCount} measurements
            </button>
          </div>
        </div>
      </PreviewDialog>

      <PreviewDialog
        open={Boolean(selectedResult)}
        onClose={() => setSelectedResult(null)}
        labelledBy="result-sheet-title"
        className={styles.sheetDialog}
      >
        {selectedResult ? (
          <aside className={styles.resultSheet}>
            <div className={styles.sheetHeader}>
              <div>
                <span className={styles.eyebrow}>Measurement result</span>
                <h2 id="result-sheet-title">Result details</h2>
              </div>
              <button type="button" className={styles.dialogClose} aria-label="Close result details" onClick={() => setSelectedResult(null)}><X size={17} /></button>
            </div>
            <div className={styles.sheetBody}>
              <div className={styles.sheetPrompt}>
                <SurfaceMark surface={selectedResult.surface} />
                <p>{selectedResult.prompt}</p>
                <small>{selectedResult.collection} / {selectedResult.checked}</small>
              </div>
              <div className={styles.sheetStats}>
                <div><span>Brand mention</span><strong className={selectedResult.mentioned ? styles.positive : styles.negative}>{selectedResult.mentioned ? 'Yes' : 'No'}</strong></div>
                <div><span>Prominence</span><strong>{selectedResult.prominence}</strong></div>
                <div><span>Sentiment</span><strong>{selectedResult.sentiment}</strong></div>
              </div>
              <section className={styles.sheetSection}>
                <h3>Summary</h3>
                <p>{selectedResult.summary}</p>
              </section>
              <section className={styles.sheetSection}>
                <div className={styles.sheetSectionTitle}><h3>Response excerpt</h3><button type="button">View raw result <ExternalLink size={12} /></button></div>
                <blockquote>{selectedResult.response}</blockquote>
              </section>
              <section className={styles.sheetSection}>
                <h3>Citation domains</h3>
                <div className={styles.domainList}>
                  {selectedResult.citedDomains.map(domain => (
                    <div key={domain}><Globe2 size={14} /><span>{domain}</span>{domain === 'taysteesburger.com' ? <small>Owned</small> : null}</div>
                  ))}
                </div>
              </section>
            </div>
            <footer className={styles.sheetFooter}>
              <button type="button" className={styles.secondaryButton}><Download size={14} /> Export result</button>
              <button type="button" className={styles.primaryButton} onClick={() => setSelectedResult(null)}>Done</button>
            </footer>
          </aside>
        ) : null}
      </PreviewDialog>

      <PreviewDialog open={commandOpen} onClose={() => setCommandOpen(false)} labelledBy="command-dialog-title" className={styles.commandDialog}>
        <div className={styles.commandCard}>
          <div className={styles.commandSearch}>
            <Search size={18} />
            <label className={styles.srOnly} htmlFor="preview-command-search">Search CopyPilot</label>
            <input id="preview-command-search" autoFocus placeholder="Search CopyPilot" />
            <kbd>Esc</kbd>
          </div>
          <div className={styles.commandResults}>
            <p>Quick actions</p>
            <button type="button" onClick={() => { setCommandOpen(false); setRunOpen(true) }}><span><Play size={15} /></span><strong>Run Taystee measurements</strong><small>GEOPilot</small></button>
            <button type="button"><span><Plus size={15} /></span><strong>Create a prompt collection</strong><small>GEOPilot</small></button>
            <p>Clients</p>
            <button type="button"><span className={styles.commandClient}>T</span><strong>Taystee</strong><small>GEOPilot profile</small></button>
            <button type="button"><span className={styles.commandClient}>G</span><strong>GreenCare Clinic</strong><small>Brand Pulse profile</small></button>
          </div>
          <div className={styles.commandFooter}><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span></div>
        </div>
      </PreviewDialog>

      <div className={clsx(styles.toast, toast && styles.toastVisible)} role="status" aria-live="polite">
        <Check size={15} /> {toast}
      </div>
    </div>
  )
}
