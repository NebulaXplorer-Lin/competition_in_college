import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type Decision = 'yes' | 'maybe' | 'no'
type EventStatus = 'open' | 'closed' | 'ended'

type EventRecord = {
  id: string
  title: string
  organizer: string
  category: string
  tags: string[]
  description: string
  source_url: string
  registration_start: string
  registration_deadline: string
  event_start: string
  event_end: string
  location: string
  eligibility: string
  status: EventStatus
  participation_decision: Decision
  priority: string
  notes: string
  last_verified: string
  starred: boolean
}

type Filters = {
  query: string
  tag: string
  category: string
  decision: 'all' | Decision
  status: 'all' | EventStatus
  view: 'all' | 'starred' | 'urgent'
}

const CSV_HEADERS = ['id', 'title', 'organizer', 'category', 'tags', 'description', 'source_url', 'registration_start', 'registration_deadline', 'event_start', 'event_end', 'location', 'eligibility', 'status', 'participation_decision', 'priority', 'notes', 'last_verified'] as const

const decisionLabels: Record<Decision, string> = { yes: '确定参加', maybe: '不一定', no: '确定不参加' }
const statusLabels: Record<EventStatus, string> = { open: '报名中', closed: '报名结束', ended: '已结束' }

const daysFromToday = (days: number) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const starterEvents: EventRecord[] = [
  { id: 'campus-ai-2026', title: '全国大学生人工智能创新大赛', organizer: '校创新创业学院', category: '创新创业', tags: ['人工智能', '校级', '高含金量'], description: '面向全校本科生，围绕 AI 应用、算法与智能硬件提交作品。', source_url: 'https://example.com/ai', registration_start: daysFromToday(-12), registration_deadline: daysFromToday(3), event_start: daysFromToday(25), event_end: daysFromToday(27), location: '线上提交，创新楼 201', eligibility: '全日制本科生，个人或团队均可', status: 'open', participation_decision: 'maybe', priority: '高', notes: '需要准备项目简介和 3 分钟演示视频', last_verified: daysFromToday(0), starred: true },
  { id: 'english-speech-2026', title: '“外研社·国才杯”英语演讲大赛', organizer: '大学外语教学部', category: '语言文化', tags: ['英语', '演讲', '校级'], description: '校级选拔赛，优秀选手将代表学校参加省赛。', source_url: 'https://example.com/english', registration_start: daysFromToday(-5), registration_deadline: daysFromToday(8), event_start: daysFromToday(18), event_end: daysFromToday(18), location: '外语楼报告厅', eligibility: '全校学生', status: 'open', participation_decision: 'yes', priority: '中', notes: '', last_verified: daysFromToday(-1), starred: false },
  { id: 'math-model-2026', title: '全国大学生数学建模竞赛', organizer: '教务处', category: '学科竞赛', tags: ['数学', '团队', '高含金量'], description: '三人组队，在规定时间内完成建模论文。', source_url: 'https://example.com/math', registration_start: daysFromToday(-24), registration_deadline: daysFromToday(1), event_start: daysFromToday(14), event_end: daysFromToday(17), location: '线上', eligibility: '本科生，三人一队', status: 'open', participation_decision: 'yes', priority: '高', notes: '和室友确认分工；报名后下载往年题', last_verified: daysFromToday(0), starred: true },
  { id: 'design-innovation-2026', title: '大学生创新设计挑战赛', organizer: '学生工作处', category: '设计创意', tags: ['设计', '产品', '校级'], description: '以校园真实问题为题，完成一个可落地的产品方案。', source_url: 'https://example.com/design', registration_start: daysFromToday(-3), registration_deadline: daysFromToday(15), event_start: daysFromToday(38), event_end: daysFromToday(39), location: '创客空间', eligibility: '本科生及研究生', status: 'open', participation_decision: 'maybe', priority: '中', notes: '', last_verified: daysFromToday(0), starred: false },
  { id: 'volunteer-2026', title: '校园公益项目征集', organizer: '青年志愿者协会', category: '社会实践', tags: ['公益', '志愿服务'], description: '征集关注社区服务、无障碍与环保的校园公益项目。', source_url: 'https://example.com/volunteer', registration_start: daysFromToday(-40), registration_deadline: daysFromToday(22), event_start: daysFromToday(48), event_end: daysFromToday(48), location: '线上申报', eligibility: '学生社团或个人', status: 'open', participation_decision: 'no', priority: '低', notes: '目前时间冲突，先保留记录', last_verified: daysFromToday(-3), starred: false },
  { id: 'robot-2026', title: '全国大学生机器人大赛校内选拔', organizer: '机械与电气工程学院', category: '科技竞赛', tags: ['机器人', '硬件', '团队'], description: '机器人赛项校内选拔，进入校队后参加区域赛。', source_url: 'https://example.com/robot', registration_start: daysFromToday(-30), registration_deadline: daysFromToday(-4), event_start: daysFromToday(6), event_end: daysFromToday(7), location: '工程训练中心', eligibility: '对机器人感兴趣的学生', status: 'closed', participation_decision: 'no', priority: '中', notes: '已错过报名，明年关注', last_verified: daysFromToday(-4), starred: false },
]

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"') {
      if (quoted && next === '"') { cell += '"'; i++ } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++
      row.push(cell); if (row.some(value => value.trim())) rows.push(row)
      row = []; cell = ''
    } else cell += char
  }
  if (cell || row.length) { row.push(cell); if (row.some(value => value.trim())) rows.push(row) }
  return rows
}

function csvCell(value: string) { return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value }
function toCSV(events: EventRecord[]) {
  const rows = [CSV_HEADERS.join(',')]
  events.forEach(event => rows.push(CSV_HEADERS.map(header => csvCell(header === 'tags' ? event.tags.join(';') : String(event[header] ?? ''))).join(',')))
  return '\ufeff' + rows.join('\r\n')
}

function normalizeRecord(values: Record<string, string>, rowIndex: number): { record?: EventRecord, errors: string[] } {
  const errors: string[] = []
  const required = ['id', 'title']
  required.forEach(key => { if (!values[key]?.trim()) errors.push(`第 ${rowIndex} 行缺少 ${key}`) })
  const decision = values.participation_decision as Decision
  if (!['yes', 'maybe', 'no'].includes(decision)) errors.push(`第 ${rowIndex} 行的 participation_decision 必须是 yes、maybe 或 no`)
  const status = (values.status || 'open') as EventStatus
  if (!['open', 'closed', 'ended'].includes(status)) errors.push(`第 ${rowIndex} 行的 status 无效`)
  const dateFields = ['registration_start', 'registration_deadline', 'event_start', 'event_end', 'last_verified']
  dateFields.forEach(field => { if (values[field] && !/^\d{4}-\d{2}-\d{2}$/.test(values[field])) errors.push(`第 ${rowIndex} 行的 ${field} 应为 YYYY-MM-DD`) })
  const tags = (values.tags || '').split(';').map(tag => tag.trim()).filter(Boolean)
  if (new Set(tags).size !== tags.length) errors.push(`第 ${rowIndex} 行包含重复标签`)
  if (errors.length) return { errors }
  return { errors, record: {
    id: values.id.trim(), title: values.title.trim(), organizer: values.organizer || '', category: values.category || '未分类', tags,
    description: values.description || '', source_url: values.source_url || '', registration_start: values.registration_start || '', registration_deadline: values.registration_deadline || '',
    event_start: values.event_start || '', event_end: values.event_end || '', location: values.location || '', eligibility: values.eligibility || '', status,
    participation_decision: decision, priority: values.priority || '中', notes: values.notes || '', last_verified: values.last_verified || '', starred: false,
  }}
}

function formatDate(date: string) {
  if (!date) return '未设置'
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(parsed)
}
function daysLeft(date: string) {
  if (!date) return null
  const target = new Date(`${date}T00:00:00`).getTime()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((target - today.getTime()) / 86400000)
}
function urgency(event: EventRecord) {
  const days = daysLeft(event.registration_deadline)
  if (event.status === 'ended' || (days !== null && days < 0)) return 'overdue'
  if (days !== null && days <= 3) return 'danger'
  if (days !== null && days <= 7) return 'soon'
  return 'normal'
}

function App() {
  const [events, setEvents] = useState<EventRecord[]>(() => {
    try { const saved = localStorage.getItem('campus-events'); return saved ? JSON.parse(saved) : starterEvents } catch { return starterEvents }
  })
  const [filters, setFilters] = useState<Filters>({ query: '', tag: 'all', category: 'all', decision: 'all', status: 'all', view: 'all' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showTags, setShowTags] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { localStorage.setItem('campus-events', JSON.stringify(events)) }, [events])

  const allTags = useMemo(() => Array.from(new Set(events.flatMap(event => event.tags))).sort((a, b) => a.localeCompare(b, 'zh-CN')), [events])
  const categories = useMemo(() => Array.from(new Set(events.map(event => event.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN')), [events])
  const selected = events.find(event => event.id === selectedId) || null

  const stats = useMemo(() => ({
    total: events.length,
    urgent: events.filter(event => ['danger', 'soon'].includes(urgency(event)) && event.status === 'open').length,
    yes: events.filter(event => event.participation_decision === 'yes').length,
    maybe: events.filter(event => event.participation_decision === 'maybe').length,
  }), [events])

  const filteredEvents = useMemo(() => events.filter(event => {
    const query = filters.query.trim().toLowerCase()
    const matchesQuery = !query || [event.title, event.organizer, event.description, event.notes, ...event.tags].join(' ').toLowerCase().includes(query)
    const matchesTag = filters.tag === 'all' || event.tags.includes(filters.tag)
    const matchesCategory = filters.category === 'all' || event.category === filters.category
    const matchesDecision = filters.decision === 'all' || event.participation_decision === filters.decision
    const matchesStatus = filters.status === 'all' || event.status === filters.status
    const matchesView = filters.view === 'all' || (filters.view === 'starred' ? event.starred : ['danger', 'soon'].includes(urgency(event)))
    return matchesQuery && matchesTag && matchesCategory && matchesDecision && matchesStatus && matchesView
  }).sort((a, b) => {
    const da = daysLeft(a.registration_deadline) ?? 99999, db = daysLeft(b.registration_deadline) ?? 99999
    return da - db
  }), [events, filters])

  const updateEvent = (id: string, patch: Partial<EventRecord>) => setEvents(current => current.map(event => event.id === id ? { ...event, ...patch } : event))
  const clearFilters = () => setFilters({ query: '', tag: 'all', category: 'all', decision: 'all', status: 'all', view: 'all' })

  const importCSV = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parseCSV(String(reader.result || '').replace(/^\ufeff/, ''))
      if (rows.length < 2) { setValidationErrors(['CSV 文件没有可导入的数据']); return }
      const headers = rows[0].map(header => header.trim())
      const missing = CSV_HEADERS.filter(header => !headers.includes(header))
      if (missing.length) { setValidationErrors([`缺少字段：${missing.join('、')}`]); return }
      const seenIds = new Set<string>(), seenUrls = new Set<string>(), imported: EventRecord[] = [], errors: string[] = []
      rows.slice(1).forEach((row, index) => {
        const values = Object.fromEntries(headers.map((header, i) => [header, (row[i] || '').trim()]))
        const result = normalizeRecord(values, index + 2)
        if (result.record) {
          if (seenIds.has(result.record.id)) errors.push(`第 ${index + 2} 行重复 id：${result.record.id}`)
          if (result.record.source_url && seenUrls.has(result.record.source_url)) errors.push(`第 ${index + 2} 行重复 source_url`)
          seenIds.add(result.record.id); if (result.record.source_url) seenUrls.add(result.record.source_url); imported.push(result.record)
        }
        errors.push(...result.errors)
      })
      if (errors.length) { setValidationErrors(errors); setImportMessage('导入未完成，请先修正 CSV'); return }
      setEvents(imported.map(record => { const old = events.find(event => event.id === record.id); return old ? { ...record, starred: old.starred } : record }))
      setValidationErrors([]); setImportMessage(`已导入 ${imported.length} 条活动`)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const downloadCSV = () => {
    const blob = new Blob([toCSV(events)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob), anchor = document.createElement('a')
    anchor.href = url; anchor.download = '我的比赛活动.csv'; anchor.click(); URL.revokeObjectURL(url)
  }
  const downloadTemplate = () => {
    const blob = new Blob([toCSV([{ ...starterEvents[0], tags: ['示例标签'], id: 'example-id', title: '示例活动' }])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = '比赛活动模板.csv'; anchor.click(); URL.revokeObjectURL(url)
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">⌁</div><div><strong>竞赛雷达</strong><span>我的校园活动清单</span></div></div>
      <nav className="nav-list">
        <button className={`nav-item ${filters.view === 'all' ? 'active' : ''}`} onClick={() => setFilters({ ...filters, view: 'all' })}><span>▦</span>全部活动 <em>{stats.total}</em></button>
        <button className={`nav-item ${filters.view === 'urgent' ? 'active' : ''}`} onClick={() => setFilters({ ...filters, view: 'urgent' })}><span>◷</span>即将截止 <em className="red-count">{stats.urgent}</em></button>
        <button className={`nav-item ${filters.view === 'starred' ? 'active' : ''}`} onClick={() => setFilters({ ...filters, view: 'starred' })}><span>☆</span>我的关注 <em>{events.filter(event => event.starred).length}</em></button>
      </nav>
      <div className="side-section"><div className="section-label">参加意向</div>
        {(['yes', 'maybe', 'no'] as Decision[]).map(decision => <button key={decision} className="side-filter" onClick={() => setFilters({ ...filters, decision })}><i className={`dot ${decision}`} />{decisionLabels[decision]}<em>{events.filter(event => event.participation_decision === decision).length}</em></button>)}
      </div>
      <div className="side-section"><div className="section-label">标签 <button className="tiny-action" onClick={() => setShowTags(!showTags)}>{showTags ? '收起' : '管理'}</button></div>
        <div className={`tag-cloud ${showTags ? 'expanded' : ''}`}>{allTags.slice(0, showTags ? allTags.length : 6).map(tag => <button key={tag} className={`side-tag ${filters.tag === tag ? 'selected' : ''}`} onClick={() => setFilters({ ...filters, tag })}># {tag}<em>{events.filter(event => event.tags.includes(tag)).length}</em></button>)}</div>
      </div>
      <div className="sidebar-bottom"><div className="data-card"><div className="data-card-icon">↥</div><div><strong>用 CSV 维护</strong><span>导入你的活动清单</span></div><button onClick={() => fileRef.current?.click()}>导入</button></div><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={event => event.target.files?.[0] && importCSV(event.target.files[0])} /><button className="link-button" onClick={downloadTemplate}>下载 CSV 模板 →</button><button className="link-button" onClick={downloadCSV}>导出当前数据 ↓</button></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs">我的空间 <span>/</span> 活动总览</div><div className="top-actions"><span className="saved-state"><i /> 已自动保存</span><button className="avatar">我</button></div></header>
      <section className="hero"><div><p className="eyebrow">SATURDAY · {new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(new Date())}</p><h1>把机会留在视线里<span>。</span></h1><p className="hero-copy">你有 <b>{stats.urgent} 个活动</b> 将在近期截止，先处理最重要的事。</p></div><div className="hero-orbit"><div className="orbit-dot one" /><div className="orbit-dot two" /><div className="orbit-dot three" /><div className="orbit-center">{stats.total}<small>活动</small></div></div></section>
      <section className="stats-row"><StatCard label="全部活动" value={stats.total} detail="已收录" tone="blue" /><StatCard label="即将截止" value={stats.urgent} detail="7 天内需要关注" tone="orange" /><StatCard label="确定参加" value={stats.yes} detail="已列入计划" tone="purple" /><StatCard label="不一定" value={stats.maybe} detail="等待进一步了解" tone="yellow" /></section>
      <div className="content-heading"><div><h2>{filters.view === 'urgent' ? '即将截止' : filters.view === 'starred' ? '我的关注' : '全部活动'} <span>{filteredEvents.length}</span></h2><p>按报名截止时间排列，先完成最紧急的决定</p></div><button className="primary-button" onClick={() => { const fresh: EventRecord = { ...starterEvents[0], id: `new-${Date.now()}`, title: '新活动', tags: [], description: '', source_url: '', registration_start: '', registration_deadline: '', event_start: '', event_end: '', location: '', eligibility: '', notes: '', last_verified: daysFromToday(0), participation_decision: 'maybe', status: 'open', starred: false }; setEvents([fresh, ...events]); setSelectedId(fresh.id) }}>＋ 新建活动</button></div>
      <div className="filter-bar"><div className="search-box"><span>⌕</span><input value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} placeholder="搜索活动、主办方或标签" /></div><select value={filters.tag} onChange={event => setFilters({ ...filters, tag: event.target.value })}><option value="all">所有标签</option>{allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select><select value={filters.category} onChange={event => setFilters({ ...filters, category: event.target.value })}><option value="all">所有分类</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select><select value={filters.decision} onChange={event => setFilters({ ...filters, decision: event.target.value as Filters['decision'] })}><option value="all">参加意向</option><option value="yes">确定参加</option><option value="maybe">不一定</option><option value="no">确定不参加</option></select><select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value as Filters['status'] })}><option value="all">活动状态</option><option value="open">报名中</option><option value="closed">报名结束</option><option value="ended">已结束</option></select>{(filters.query || filters.tag !== 'all' || filters.category !== 'all' || filters.decision !== 'all' || filters.status !== 'all' || filters.view !== 'all') && <button className="clear-button" onClick={clearFilters}>清除筛选</button>}</div>
      {importMessage && <div className="import-message">{importMessage}<button onClick={() => setImportMessage('')}>×</button></div>}
      {validationErrors.length > 0 && <div className="error-box"><strong>CSV 需要修正</strong>{validationErrors.slice(0, 5).map(error => <span key={error}>· {error}</span>)}{validationErrors.length > 5 && <span>· 还有 {validationErrors.length - 5} 个问题</span>}<button onClick={() => setValidationErrors([])}>×</button></div>}
      <section className="event-list">{filteredEvents.length ? filteredEvents.map(event => <EventCard key={event.id} event={event} onOpen={() => setSelectedId(event.id)} onDecision={decision => updateEvent(event.id, { participation_decision: decision })} onStar={() => updateEvent(event.id, { starred: !event.starred })} />) : <div className="empty-state"><div>⌁</div><h3>没有找到匹配的活动</h3><p>试试清除筛选条件，或者导入一份新的 CSV。</p><button className="secondary-button" onClick={clearFilters}>清除筛选</button></div>}</section>
    </main>
    {selected && <DetailPanel event={selected} onClose={() => setSelectedId(null)} onUpdate={patch => updateEvent(selected.id, patch)} onDelete={() => { setEvents(events.filter(event => event.id !== selected.id)); setSelectedId(null) }} />}
  </div>
}

function StatCard({ label, value, detail, tone }: { label: string, value: number, detail: string, tone: string }) { return <div className={`stat-card ${tone}`}><div className="stat-icon">{tone === 'blue' ? '▦' : tone === 'orange' ? '◷' : tone === 'purple' ? '✓' : '…'}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }

function EventCard({ event, onOpen, onDecision, onStar }: { event: EventRecord, onOpen: () => void, onDecision: (decision: Decision) => void, onStar: () => void }) {
  const left = daysLeft(event.registration_deadline), level = urgency(event)
  return <article className={`event-card ${level}`}><div className="event-main" onClick={onOpen}><div className="event-topline"><span className={`category-label ${event.category.length > 5 ? 'long' : ''}`}>{event.category}</span>{event.priority === '高' && <span className="priority-label">高优先级</span>}<span className="verified">最近更新 {event.last_verified ? formatDate(event.last_verified) : '—'}</span></div><h3>{event.title}</h3><div className="event-meta"><span>⌖ {event.organizer || '未填写主办方'}</span><span>◫ {formatDate(event.event_start)}</span><span>⌘ {event.location || '地点待定'}</span></div><div className="tag-row">{event.tags.map(tag => <span className="tag" key={tag}># {tag}</span>)}</div></div><div className="event-side"><button className={`star-button ${event.starred ? 'starred' : ''}`} onClick={event => { event.stopPropagation(); onStar() }}>{event.starred ? '★' : '☆'}</button><div className={`deadline ${level}`}><small>{left !== null && left < 0 ? '已截止' : '报名截止'}</small><strong>{formatDate(event.registration_deadline)}</strong>{left !== null && left >= 0 && <span>还有 {left} 天</span>}</div><div className="decision-group">{(['yes', 'maybe', 'no'] as Decision[]).map(decision => <button key={decision} title={decisionLabels[decision]} className={event.participation_decision === decision ? `selected ${decision}` : ''} onClick={click => { click.stopPropagation(); onDecision(decision) }}>{decision === 'yes' ? '✓' : decision === 'maybe' ? '…' : '×'}</button>)}</div></div></article>
}

function DetailPanel({ event, onClose, onUpdate, onDelete }: { event: EventRecord, onClose: () => void, onUpdate: (patch: Partial<EventRecord>) => void, onDelete: () => void }) {
  const [draftTags, setDraftTags] = useState(event.tags.join(';'))
  useEffect(() => setDraftTags(event.tags.join(';')), [event.id])
  const saveTags = () => onUpdate({ tags: Array.from(new Set(draftTags.split(';').map(tag => tag.trim()).filter(Boolean))) })
  return <div className="drawer-backdrop" onClick={onClose}><aside className="detail-panel" onClick={event => event.stopPropagation()}><div className="detail-header"><div><span className="eyebrow">活动详情</span><h2>{event.title}</h2></div><button className="close-button" onClick={onClose}>×</button></div><div className="detail-scroll"><div className="detail-deadline"><div><small>报名截止</small><strong>{formatDate(event.registration_deadline)}</strong></div><span className={`deadline-pill ${urgency(event)}`}>{daysLeft(event.registration_deadline) !== null && (daysLeft(event.registration_deadline)! < 0 ? '已截止' : `还有 ${daysLeft(event.registration_deadline)} 天`)}</span></div><label className="field-label">参加意向<div className="decision-select">{(['yes', 'maybe', 'no'] as Decision[]).map(decision => <button key={decision} className={event.participation_decision === decision ? `selected ${decision}` : ''} onClick={() => onUpdate({ participation_decision: decision })}>{decisionLabels[decision]}</button>)}</div></label><label className="field-label">活动状态<select value={event.status} onChange={e => onUpdate({ status: e.target.value as EventStatus })}><option value="open">报名中</option><option value="closed">报名结束</option><option value="ended">已结束</option></select></label><div className="detail-grid"><Info label="主办方" value={event.organizer} /><Info label="活动日期" value={`${formatDate(event.event_start)}${event.event_end ? ` — ${formatDate(event.event_end)}` : ''}`} /><Info label="活动地点" value={event.location} /><Info label="适合人群" value={event.eligibility} /></div><label className="field-label">标签<span className="field-hint">使用分号分隔，例如：人工智能;校级</span><input value={draftTags} onChange={e => setDraftTags(e.target.value)} onBlur={saveTags} /></label><div className="detail-description"><span className="field-label">活动简介</span><p>{event.description || '暂无简介，可以在 CSV 中补充。'}</p></div><label className="field-label">我的备注<textarea value={event.notes} placeholder="记录报名材料、组队情况或你的下一步行动" onChange={e => onUpdate({ notes: e.target.value })} /></label>{event.source_url && <a className="source-link" href={event.source_url} target="_blank" rel="noreferrer">打开活动来源 ↗</a>}<div className="detail-footer"><button className="delete-button" onClick={onDelete}>删除活动</button><span>修改会自动保存到浏览器</span></div></div></aside></div>
}
function Info({ label, value }: { label: string, value: string }) { return <div className="info-block"><span>{label}</span><strong>{value || '未填写'}</strong></div> }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
