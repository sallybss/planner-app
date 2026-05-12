<script setup lang="ts">
import { computed, onMounted, reactive, ref, nextTick, watch } from 'vue'
import AppShell from '../components/AppShell.vue'
import { useAuth } from '../auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
const { user } = useAuth()

type BudgetType = 'income' | 'fixed' | 'variable' | 'savings'
type SectionKey = 'income' | 'fixed' | 'variable' | 'savings'
type CurrencyCode = 'DKK' | 'EUR'

type BudgetEntry = {
  _id?: string
  id?: string
  month: string
  type: BudgetType
  category: string
  label: string
  amount: number
  owner: string
}

type RowDef = { _id?: string; label: string; type: BudgetType; section: SectionKey }

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const YEAR_RANGE = Array.from({ length: 8 }, (_, i) => 2022 + i)
const CURRENCY_STORAGE_KEY = 'plannerBudgetCurrency'
const BASE_BUDGET_CURRENCY: CurrencyCode = 'DKK'
const ECB_EUR_TO_DKK_RATE = 7.4726
const currencyMeta: Record<CurrencyCode, { locale: string; symbol: string }> = {
  DKK: { locale: 'da-DK', symbol: 'kr.' },
  EUR: { locale: 'de-DE', symbol: 'EUR' },
}

const selectedYear = ref(new Date().getFullYear())
const viewMode = ref<'year' | 'month'>('year')
const selectedMonthIndex = ref(new Date().getMonth())
const selectedCurrency = ref<CurrencyCode>('DKK')

const MONTHS = computed(() =>
  MONTH_LABELS.map((short, i) => ({
    key: `${selectedYear.value}-${String(i + 1).padStart(2, '0')}`,
    short,
  }))
)

const displayMonths = computed((): Array<{ key: string; short: string }> =>
  viewMode.value === 'year'
    ? MONTHS.value
    : MONTHS.value.filter((_, i) => i === selectedMonthIndex.value)
)

const DEFAULT_ROWS: Record<SectionKey, RowDef[]> = {
  income: [
    { label: 'SU', type: 'income', section: 'income' },
    { label: 'Salary', type: 'income', section: 'income' },
  ],
  fixed: [
    { label: 'Subscriptions - Spotify', type: 'fixed', section: 'fixed' },
    { label: 'Callme + Mac + Vivacom', type: 'fixed', section: 'fixed' },
    { label: 'Apple + SydBank + Revolute', type: 'fixed', section: 'fixed' },
    { label: 'Uni subscriptions', type: 'fixed', section: 'fixed' },
  ],
  variable: [
    { label: 'Groceries', type: 'variable', section: 'variable' },
    { label: 'Eating/going out', type: 'variable', section: 'variable' },
    { label: 'Transportation', type: 'variable', section: 'variable' },
    { label: 'Fashion/beauty', type: 'variable', section: 'variable' },
    { label: 'Gifts', type: 'variable', section: 'variable' },
    { label: 'Rent', type: 'variable', section: 'variable' },
    { label: 'Shopping', type: 'variable', section: 'variable' },
    { label: 'Health/medical', type: 'variable', section: 'variable' },
    { label: 'Gym', type: 'variable', section: 'variable' },
    { label: 'Pocket money', type: 'variable', section: 'variable' },
    { label: 'Others', type: 'variable', section: 'variable' },
  ],
  savings: [
    { label: 'Emergency fund', type: 'savings', section: 'savings' },
    { label: 'Savings acc', type: 'savings', section: 'savings' },
  ],
}

const rowDefs = reactive<Record<SectionKey, RowDef[]>>({
  income: [],
  fixed: [],
  variable: [],
  savings: [],
})

async function loadRowDefs() {
  if (!user.value?.id || !user.value?.token) return
  try {
    const res = await fetch(`${API_BASE_URL}/budget-row-defs?owner=${encodeURIComponent(user.value.id)}`)
    if (!res.ok) return
    const rows = (await res.json()) as Array<{ _id: string; label: string; type: SectionKey }>
    if (rows.length === 0) {
      await seedDefaultRows()
      return
    }
    rowDefs.income = rows.filter((r) => r.type === 'income').map((r) => ({ _id: r._id, label: r.label, type: r.type, section: r.type }))
    rowDefs.fixed = rows.filter((r) => r.type === 'fixed').map((r) => ({ _id: r._id, label: r.label, type: r.type, section: r.type }))
    rowDefs.variable = rows.filter((r) => r.type === 'variable').map((r) => ({ _id: r._id, label: r.label, type: r.type, section: r.type }))
    rowDefs.savings = rows.filter((r) => r.type === 'savings').map((r) => ({ _id: r._id, label: r.label, type: r.type, section: r.type }))
  } catch {}
}

async function seedDefaultRows() {
  for (const section of (['income', 'fixed', 'variable', 'savings'] as SectionKey[])) {
    for (const row of DEFAULT_ROWS[section]) {
      await createRowDefOnServer(row.label, section)
    }
  }
}

async function createRowDefOnServer(label: string, section: SectionKey): Promise<RowDef | null> {
  if (!user.value?.id || !user.value?.token) return null
  try {
    const res = await fetch(`${API_BASE_URL}/budget-row-defs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.value.token}` },
      body: JSON.stringify({ label, type: section, owner: user.value.id }),
    })
    if (!res.ok) return null
    const created = (await res.json()) as { _id: string; label: string; type: SectionKey }
    return { _id: created._id, label: created.label, type: created.type, section: created.type }
  } catch {
    return null
  }
}

const allRows = computed(() => [...rowDefs.income, ...rowDefs.fixed, ...rowDefs.variable, ...rowDefs.savings])

// ── entries ──────────────────────────────────────────────
const entries = ref<BudgetEntry[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const pageError = ref('')

function normalizeEntry(e: BudgetEntry) {
  return { ...e, id: e.id ?? e._id ?? crypto.randomUUID() }
}

function getEntry(label: string, month: string) {
  return entries.value.find((e) => e.label === label && e.month === month) ?? null
}

function getAmount(label: string, month: string): number {
  return getEntry(label, month)?.amount ?? 0
}

function sumRows(rows: RowDef[], month: string): number {
  return rows.reduce((s, r) => s + getAmount(r.label, month), 0)
}

const monthTotals = computed(() =>
  MONTHS.value.map(({ key }) => {
    const income = sumRows(rowDefs.income, key)
    const fixed = sumRows(rowDefs.fixed, key)
    const variable = sumRows(rowDefs.variable, key)
    const savings = sumRows(rowDefs.savings, key)
    const expenses = fixed + variable
    const net = income - expenses - savings
    return { month: key, income, fixed, variable, expenses, savings, net }
  }),
)

function totalsFor(monthKey: string) {
  return monthTotals.value.find((t) => t.month === monthKey)!
}

const annualSummary = computed(() => ({
  income: monthTotals.value.reduce((s, t) => s + t.income, 0),
  expenses: monthTotals.value.reduce((s, t) => s + t.expenses, 0),
  savings: monthTotals.value.reduce((s, t) => s + t.savings, 0),
  net: monthTotals.value.reduce((s, t) => s + t.net, 0),
}))

const summaryStat = computed(() => {
  if (viewMode.value === 'month') {
    const t = monthTotals.value[selectedMonthIndex.value] ?? { income: 0, expenses: 0, savings: 0, net: 0 }
    return { label: `${MONTHS.value[selectedMonthIndex.value]?.short ?? ''} ${selectedYear.value}`, ...t }
  }
  return { label: `${selectedYear.value} annual`, ...annualSummary.value }
})

const exportLabel = computed(() =>
  viewMode.value === 'month'
    ? `${MONTHS.value[selectedMonthIndex.value]?.short ?? ''} ${selectedYear.value}`
    : `${selectedYear.value} annual overview`,
)

function fmt(value: number, dash = true): string {
  if (dash && value === 0) return '—'
  const { locale, symbol } = currencyMeta[selectedCurrency.value]
  return (
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(convertFromStorage(value)) + ` ${symbol}`
  )
}

function setCurrency(currency: CurrencyCode) {
  selectedCurrency.value = currency
  window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency)
}

function convertFromStorage(value: number): number {
  if (selectedCurrency.value === BASE_BUDGET_CURRENCY) return value
  return value / ECB_EUR_TO_DKK_RATE
}

function convertToStorage(value: number): number {
  if (selectedCurrency.value === BASE_BUDGET_CURRENCY) return value
  return value * ECB_EUR_TO_DKK_RATE
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderExportRows(rows: RowDef[], title: string, totalLabel: string, totalKey: 'income' | 'fixed' | 'variable' | 'savings' | 'expenses' | 'net') {
  const headerCells = displayMonths.value
    .map((month) => `<th>${escapeHtml(month.short)}</th>`)
    .join('')

  const bodyRows = rows
    .map((row) => {
      const valueCells = displayMonths.value
        .map((month) => `<td>${escapeHtml(fmt(getAmount(row.label, month.key)))}</td>`)
        .join('')
      return `<tr><td>${escapeHtml(row.label)}</td>${valueCells}</tr>`
    })
    .join('')

  const totalCells = displayMonths.value
    .map((month) => `<td>${escapeHtml(fmt(totalsFor(month.key)[totalKey], false))}</td>`)
    .join('')

  return `
    <section class="BudgetExport__section">
      <h2>${escapeHtml(title)}</h2>
      <table class="BudgetExport__table">
        <thead>
          <tr>
            <th>Category</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          <tr class="BudgetExport__totalRow">
            <td>${escapeHtml(totalLabel)}</td>
            ${totalCells}
          </tr>
        </tbody>
      </table>
    </section>
  `
}

function downloadBudgetOverview() {
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Budget overview - ${escapeHtml(exportLabel.value)}</title>
        <style>
          :root {
            color-scheme: light;
            --ink: #1c1730;
            --muted: #6d6788;
            --line: #d9d4ea;
            --panel: #f6f3ff;
            --panel-strong: #ece6ff;
            --accent: #6b5bd2;
            --danger: #a94d66;
            --mint: #2f8f68;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 32px;
            font-family: Inter, "Segoe UI", sans-serif;
            color: var(--ink);
            background: #ffffff;
          }
          .BudgetExport {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            gap: 24px;
          }
          .BudgetExport__hero {
            padding: 24px 28px;
            border: 1px solid var(--line);
            border-radius: 24px;
            background: linear-gradient(135deg, var(--panel), #fff 70%);
          }
          .BudgetExport__eyebrow {
            margin: 0 0 8px;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--accent);
          }
          .BudgetExport__hero h1 {
            margin: 0;
            font-size: 34px;
            line-height: 1.1;
          }
          .BudgetExport__heroMeta {
            margin-top: 10px;
            color: var(--muted);
            font-size: 14px;
          }
          .BudgetExport__stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
          .BudgetExport__stat {
            padding: 18px;
            border-radius: 18px;
            border: 1px solid var(--line);
            background: var(--panel);
          }
          .BudgetExport__stat span {
            display: block;
            margin-bottom: 8px;
            color: var(--muted);
            font-size: 13px;
          }
          .BudgetExport__stat strong {
            font-size: 22px;
            line-height: 1.2;
          }
          .BudgetExport__section {
            display: grid;
            gap: 12px;
          }
          .BudgetExport__section h2 {
            margin: 0;
            font-size: 20px;
          }
          .BudgetExport__table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            border: 1px solid var(--line);
            border-radius: 18px;
            overflow: hidden;
          }
          .BudgetExport__table th,
          .BudgetExport__table td {
            padding: 12px 14px;
            border-bottom: 1px solid var(--line);
            text-align: right;
            font-size: 14px;
            vertical-align: top;
          }
          .BudgetExport__table th:first-child,
          .BudgetExport__table td:first-child {
            width: 28%;
            text-align: left;
            font-weight: 600;
          }
          .BudgetExport__table thead th {
            background: var(--panel);
          }
          .BudgetExport__totalRow td {
            background: var(--panel-strong);
            font-weight: 700;
          }
          .BudgetExport__footnote {
            color: var(--muted);
            font-size: 12px;
          }
          @media print {
            body { padding: 16px; }
            .BudgetExport { gap: 18px; }
          }
        </style>
      </head>
      <body onload="window.print()">
        <main class="BudgetExport">
          <section class="BudgetExport__hero">
            <p class="BudgetExport__eyebrow">Planix budget export</p>
            <h1>${escapeHtml(exportLabel.value)}</h1>
            <div class="BudgetExport__heroMeta">
              Currency: ${escapeHtml(selectedCurrency.value)} · Generated ${escapeHtml(generatedAt)}
            </div>
          </section>

          <section class="BudgetExport__stats">
            <article class="BudgetExport__stat">
              <span>Total income</span>
              <strong>${escapeHtml(fmt(summaryStat.value.income, false))}</strong>
            </article>
            <article class="BudgetExport__stat">
              <span>Total expenses</span>
              <strong>${escapeHtml(fmt(summaryStat.value.expenses, false))}</strong>
            </article>
            <article class="BudgetExport__stat">
              <span>Total savings</span>
              <strong>${escapeHtml(fmt(summaryStat.value.savings, false))}</strong>
            </article>
            <article class="BudgetExport__stat">
              <span>Net / Loss</span>
              <strong>${escapeHtml(fmt(summaryStat.value.net, false))}</strong>
            </article>
          </section>

          ${renderExportRows(rowDefs.income, 'Net income', 'Total income', 'income')}
          ${renderExportRows(rowDefs.fixed, 'Fixed expenses', 'Total fixed', 'fixed')}
          ${renderExportRows(rowDefs.variable, 'Variable expenses', 'Total variable', 'variable')}
          ${renderExportRows(rowDefs.savings, 'Savings', 'Total savings', 'savings')}

          <section class="BudgetExport__section">
            <h2>Overall totals</h2>
            <table class="BudgetExport__table">
              <thead>
                <tr>
                  <th>Summary</th>
                  ${displayMonths.value.map((month) => `<th>${escapeHtml(month.short)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Monthly expenses</td>
                  ${displayMonths.value.map((month) => `<td>${escapeHtml(fmt(totalsFor(month.key).expenses, false))}</td>`).join('')}
                </tr>
                <tr class="BudgetExport__totalRow">
                  <td>Net / Loss</td>
                  ${displayMonths.value.map((month) => `<td>${escapeHtml(fmt(totalsFor(month.key).net, false))}</td>`).join('')}
                </tr>
              </tbody>
            </table>
          </section>

          <p class="BudgetExport__footnote">
            If you choose “Save as PDF” in the print dialog, this overview will be downloaded as a PDF document.
          </p>
        </main>
      </body>
    </html>
  `

  const htmlBlob = new Blob([html], { type: 'text/html' })
  const htmlUrl = URL.createObjectURL(htmlBlob)
  const printWindow = window.open(htmlUrl, '_blank', 'width=1100,height=800')

  if (!printWindow) {
    URL.revokeObjectURL(htmlUrl)
    pageError.value = 'Unable to open the overview. Please allow pop-ups and try again.'
    return
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(htmlUrl)
  }, 15000)
}

// ── cell selection ────────────────────────────────────────
const selectedCell = ref<{ label: string; month: string } | null>(null)
const cellAmount = ref('')

function syncSelectedCellAmount() {
  if (!selectedCell.value) return
  const existing = getEntry(selectedCell.value.label, selectedCell.value.month)
  cellAmount.value = existing ? String(Number(convertFromStorage(existing.amount).toFixed(2))) : ''
}

function isCellSelected(label: string, month: string) {
  return selectedCell.value?.label === label && selectedCell.value?.month === month
}

async function selectCell(row: RowDef, monthKey: string) {
  editingRowLabel.value = null
  selectedCell.value = { label: row.label, month: monthKey }
  syncSelectedCellAmount()
  await nextTick()
  const input = document.querySelector<HTMLInputElement>('.SpreadsheetTable__cell--selected .SpreadsheetTable__cellInput')
  input?.focus()
  input?.select()
}

async function handleCellBlur() {
  if (!selectedCell.value) return
  if (cellAmount.value === '' && !getEntry(selectedCell.value.label, selectedCell.value.month)) return
  await saveCellAmount()
}

function closePanel() {
  selectedCell.value = null
  cellAmount.value = ''
}

function monthLabel(key: string) {
  return MONTHS.value.find((m) => m.key === key)?.short ?? key
}

// ── row editing ───────────────────────────────────────────
const editingRowLabel = ref<string | null>(null)
const editingRowValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

function startEditRow(label: string) {
  selectedCell.value = null
  editingRowLabel.value = label
  editingRowValue.value = label
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

async function confirmRenameRow(section: SectionKey, oldLabel: string) {
  const newLabel = editingRowValue.value.trim()
  editingRowLabel.value = null
  if (!newLabel || newLabel === oldLabel) return

  const row = rowDefs[section].find((r) => r.label === oldLabel)
  if (row) {
    row.label = newLabel
    if (row._id && user.value?.token) {
      try {
        await fetch(`${API_BASE_URL}/budget-row-defs/${row._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.value.token}` },
          body: JSON.stringify({ label: newLabel }),
        })
      } catch {}
    }
  }

  const toUpdate = entries.value.filter((e) => e.label === oldLabel)
  for (const entry of toUpdate) {
    const id = entry.id ?? entry._id
    if (!id || !user.value?.token) continue
    try {
      const res = await fetch(`${API_BASE_URL}/budget-entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.value.token}` },
        body: JSON.stringify({ label: newLabel }),
      })
      if (res.ok) {
        const updated = normalizeEntry((await res.json()) as BudgetEntry)
        entries.value = entries.value.map((e) => (e.id === updated.id ? updated : e))
      }
    } catch {}
  }
}

async function deleteRow(section: SectionKey, label: string) {
  if (!confirm(`Delete row "${label}" and all its data?`)) return

  const toDelete = entries.value.filter((e) => e.label === label)
  for (const entry of toDelete) {
    const id = entry.id ?? entry._id
    if (!id || !user.value?.token) continue
    try {
      await fetch(`${API_BASE_URL}/budget-entries/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.value.token}` },
      })
    } catch {}
  }

  entries.value = entries.value.filter((e) => e.label !== label)
  const rowDef = rowDefs[section].find((r) => r.label === label)
  if (rowDef?._id && user.value?.token) {
    try {
      await fetch(`${API_BASE_URL}/budget-row-defs/${rowDef._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.value.token}` },
      })
    } catch {}
  }
  rowDefs[section] = rowDefs[section].filter((r) => r.label !== label)

  if (selectedCell.value?.label === label) closePanel()
}

// ── add row ───────────────────────────────────────────────
const addingToSection = ref<SectionKey | null>(null)
const newRowLabel = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)

function startAddRow(section: SectionKey) {
  addingToSection.value = section
  newRowLabel.value = ''
  nextTick(() => addInputRef.value?.focus())
}

async function confirmAddRow() {
  const label = newRowLabel.value.trim()
  if (!label || !addingToSection.value) {
    addingToSection.value = null
    return
  }
  const section = addingToSection.value
  addingToSection.value = null
  newRowLabel.value = ''
  const created = await createRowDefOnServer(label, section)
  rowDefs[section].push(created ?? { label, type: section, section })
}

// ── API helpers ───────────────────────────────────────────
async function parseResponseError(res: Response, fallback: string) {
  try {
    const p = await res.json()
    return p?.error ?? fallback
  } catch {
    return fallback
  }
}

async function loadEntries() {
  if (!user.value?.id) return
  isLoading.value = true
  pageError.value = ''
  try {
    const res = await fetch(`${API_BASE_URL}/budget-entries?owner=${encodeURIComponent(user.value.id)}`)
    if (!res.ok) throw new Error('Unable to load budget entries.')
    entries.value = ((await res.json()) as BudgetEntry[]).map(normalizeEntry)
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : 'Unable to load budget entries.'
    entries.value = []
  } finally {
    isLoading.value = false
  }
}

async function saveCellAmount() {
  if (!selectedCell.value || !user.value?.id || !user.value.token) return

  const displayAmount = Number(cellAmount.value)
  if (!Number.isFinite(displayAmount) || displayAmount < 0) {
    pageError.value = 'Enter a valid amount.'
    return
  }
  const amount = Number(convertToStorage(displayAmount).toFixed(2))

  isSaving.value = true
  pageError.value = ''

  const { label, month } = selectedCell.value
  const existing = getEntry(label, month)
  const rowDef = allRows.value.find((r) => r.label === label)!

  try {
    if (existing) {
      const id = existing.id ?? existing._id
      const res = await fetch(`${API_BASE_URL}/budget-entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.value.token}` },
        body: JSON.stringify({ amount }),
      })
      if (!res.ok) throw new Error(await parseResponseError(res, 'Unable to update.'))
      const updated = normalizeEntry((await res.json()) as BudgetEntry)
      entries.value = entries.value.map((e) => (e.id === updated.id ? updated : e))
    } else {
      const res = await fetch(`${API_BASE_URL}/budget-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.value.token}` },
        body: JSON.stringify({ month, type: rowDef.type, category: rowDef.section, label, amount, owner: user.value.id }),
      })
      if (!res.ok) throw new Error(await parseResponseError(res, 'Unable to create.'))
      entries.value = [...entries.value, normalizeEntry((await res.json()) as BudgetEntry)]
    }
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : 'Unable to save.'
  } finally {
    isSaving.value = false
  }
}

async function deleteCellEntry() {
  if (!selectedCell.value || !user.value?.token) return
  const existing = getEntry(selectedCell.value.label, selectedCell.value.month)
  if (!existing) return

  const id = existing.id ?? existing._id
  if (!id) return

  isSaving.value = true
  pageError.value = ''

  try {
    const res = await fetch(`${API_BASE_URL}/budget-entries/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user.value.token}` },
    })
    if (!res.ok) throw new Error(await parseResponseError(res, 'Unable to delete.'))
    entries.value = entries.value.filter((e) => e.id !== id)
    closePanel()
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : 'Unable to delete.'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY)
  if (storedCurrency === 'DKK' || storedCurrency === 'EUR') {
    selectedCurrency.value = storedCurrency
  }
  void loadRowDefs()
  void loadEntries()
})

watch(selectedCurrency, () => {
  syncSelectedCellAmount()
})
</script>

<template>
  <AppShell active-section="budget" eyebrow="My personal budget planner" title="Budget planner">
    <template #sidebar>
      <section class="CalendarSidebar__summary WorkspaceSummaryCard">
        <span>{{ summaryStat.label }}</span>
        <p>Total income: {{ fmt(summaryStat.income, false) }}</p>
        <p>Total expenses: {{ fmt(summaryStat.expenses, false) }}</p>
        <p>Total savings: {{ fmt(summaryStat.savings, false) }}</p>
        <p>Net / Loss: {{ fmt(summaryStat.net, false) }}</p>
      </section>
    </template>

    <section class="BudgetPage">
      <div class="FeatureIntro">
        <div>
          <p class="FeatureIntro__title">{{ viewMode === 'year' ? `${selectedYear} — annual overview` : `${MONTHS[selectedMonthIndex]?.short ?? ''} ${selectedYear}` }}</p>
          <span>Click any amount to edit. Click a row label to rename it, then press Enter to save.</span>
        </div>
        <div class="BudgetControls">
          <div class="BudgetControls__toggle">
            <button
              class="BudgetControls__tab"
              :class="{ 'BudgetControls__tab--active': viewMode === 'year' }"
              @click="viewMode = 'year'"
            >Year</button>
            <button
              class="BudgetControls__tab"
              :class="{ 'BudgetControls__tab--active': viewMode === 'month' }"
              @click="viewMode = 'month'"
            >Month</button>
          </div>
          <select v-model.number="selectedYear" class="BudgetControls__select">
            <option v-for="y in YEAR_RANGE" :key="y" :value="y">{{ y }}</option>
          </select>
          <select v-if="viewMode === 'month'" v-model.number="selectedMonthIndex" class="BudgetControls__select"
            :style="{ width: `calc(${(MONTHS[selectedMonthIndex]?.short ?? '').length}ch + 32px)` }">
            <option v-for="(m, i) in MONTHS" :key="m.key" :value="i">{{ m.short }}</option>
          </select>
          <select
            :value="selectedCurrency"
            class="BudgetControls__select"
            aria-label="Budget currency"
            @change="setCurrency(($event.target as HTMLSelectElement).value as CurrencyCode)"
          >
            <option value="DKK">DKK</option>
            <option value="EUR">EUR</option>
          </select>
          <button class="BudgetControls__exportBtn" type="button" @click="downloadBudgetOverview">Download overview</button>
        </div>
      </div>

      <p v-if="pageError" class="CalendarBoard__message CalendarBoard__message--error">{{ pageError }}</p>
      <p v-else-if="isLoading" class="CalendarBoard__message">Loading budget...</p>

      <div class="BudgetSheetLayout">
        <!-- SPREADSHEET TABLE -->
        <div class="SpreadsheetWrap">
          <table class="SpreadsheetTable">
            <thead>
              <tr>
                <th class="SpreadsheetTable__labelCol"></th>
                <th v-for="m in displayMonths" :key="m.key">{{ m.short }}</th>
              </tr>
            </thead>
            <tbody>

              <!-- NET INCOME -->
              <tr class="SpreadsheetTable__sectionHeader">
                <td :colspan="displayMonths.length + 1">Net income</td>
              </tr>
              <tr v-for="row in rowDefs.income" :key="row.label" class="SpreadsheetTable__dataRow">
                <td class="SpreadsheetTable__labelCol">
                  <div class="RowLabel">
                    <template v-if="editingRowLabel === row.label">
                      <input
                        ref="editInputRef"
                        v-model="editingRowValue"
                        class="RowLabel__input"
                        @keydown.enter.prevent="confirmRenameRow('income', row.label)"
                        @keydown.escape="editingRowLabel = null"
                        @blur="confirmRenameRow('income', row.label)"
                      />
                    </template>
                    <template v-else>
                      <button class="RowLabel__textButton" type="button" @click.stop="startEditRow(row.label)">{{ row.label }}</button>
                      <div class="RowLabel__actions">
                        <button class="RowLabel__btn RowLabel__btn--delete" title="Delete row" @click.stop="deleteRow('income', row.label)">✕</button>
                      </div>
                    </template>
                  </div>
                </td>
                <td
                  v-for="m in displayMonths" :key="m.key"
                  class="SpreadsheetTable__cell"
                  :class="{
                    'SpreadsheetTable__cell--selected': isCellSelected(row.label, m.key),
                    'SpreadsheetTable__cell--empty': !isCellSelected(row.label, m.key) && getAmount(row.label, m.key) === 0,
                  }"
                  @click="selectCell(row, m.key)"
                >
                  <input
                    v-if="isCellSelected(row.label, m.key)"
                    v-model="cellAmount"
                    class="SpreadsheetTable__cellInput"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    @keydown.enter.prevent="saveCellAmount"
                    @keydown.escape="closePanel"
                    @blur="handleCellBlur"
                    @click.stop
                  />
                  <template v-else>{{ fmt(getAmount(row.label, m.key)) }}</template>
                </td>
              </tr>
              <!-- Add income row -->
              <tr class="SpreadsheetTable__addRow">
                <td :colspan="displayMonths.length + 1">
                  <template v-if="addingToSection === 'income'">
                    <div class="AddRowForm">
                      <input
                        ref="addInputRef"
                        v-model="newRowLabel"
                        class="RowLabel__input"
                        placeholder="Row name…"
                        @keydown.enter.prevent="confirmAddRow"
                        @keydown.escape="addingToSection = null"
                        @blur="confirmAddRow"
                      />
                    </div>
                  </template>
                  <button v-else class="AddRowBtn" @click="startAddRow('income')">+ Add row</button>
                </td>
              </tr>
              <tr class="SpreadsheetTable__totalRow SpreadsheetTable__totalRow--income">
                <td class="SpreadsheetTable__labelCol">TOTAL MONTHLY</td>
                <td v-for="m in displayMonths" :key="m.key">{{ fmt(totalsFor(m.key).income, false) }}</td>
              </tr>
              <tr class="SpreadsheetTable__totalRow SpreadsheetTable__totalRow--income">
                <td class="SpreadsheetTable__labelCol">NET MONTHLY</td>
                <td v-for="m in displayMonths" :key="m.key">{{ fmt(totalsFor(m.key).income, false) }}</td>
              </tr>

              <!-- FIXED EXPENSES -->
              <tr class="SpreadsheetTable__sectionHeader">
                <td :colspan="displayMonths.length + 1">Monthly expenses — Fixed</td>
              </tr>
              <tr v-for="row in rowDefs.fixed" :key="row.label" class="SpreadsheetTable__dataRow">
                <td class="SpreadsheetTable__labelCol">
                  <div class="RowLabel">
                    <template v-if="editingRowLabel === row.label">
                      <input
                        ref="editInputRef"
                        v-model="editingRowValue"
                        class="RowLabel__input"
                        @keydown.enter.prevent="confirmRenameRow('fixed', row.label)"
                        @keydown.escape="editingRowLabel = null"
                        @blur="confirmRenameRow('fixed', row.label)"
                      />
                    </template>
                    <template v-else>
                      <button class="RowLabel__textButton" type="button" @click.stop="startEditRow(row.label)">{{ row.label }}</button>
                      <div class="RowLabel__actions">
                        <button class="RowLabel__btn RowLabel__btn--delete" title="Delete row" @click.stop="deleteRow('fixed', row.label)">✕</button>
                      </div>
                    </template>
                  </div>
                </td>
                <td
                  v-for="m in displayMonths" :key="m.key"
                  class="SpreadsheetTable__cell"
                  :class="{
                    'SpreadsheetTable__cell--selected': isCellSelected(row.label, m.key),
                    'SpreadsheetTable__cell--empty': !isCellSelected(row.label, m.key) && getAmount(row.label, m.key) === 0,
                  }"
                  @click="selectCell(row, m.key)"
                >
                  <input
                    v-if="isCellSelected(row.label, m.key)"
                    v-model="cellAmount"
                    class="SpreadsheetTable__cellInput"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    @keydown.enter.prevent="saveCellAmount"
                    @keydown.escape="closePanel"
                    @blur="handleCellBlur"
                    @click.stop
                  />
                  <template v-else>{{ fmt(getAmount(row.label, m.key)) }}</template>
                </td>
              </tr>
              <tr class="SpreadsheetTable__addRow">
                <td :colspan="displayMonths.length + 1">
                  <template v-if="addingToSection === 'fixed'">
                    <div class="AddRowForm">
                      <input
                        ref="addInputRef"
                        v-model="newRowLabel"
                        class="RowLabel__input"
                        placeholder="Row name…"
                        @keydown.enter.prevent="confirmAddRow"
                        @keydown.escape="addingToSection = null"
                        @blur="confirmAddRow"
                      />
                    </div>
                  </template>
                  <button v-else class="AddRowBtn" @click="startAddRow('fixed')">+ Add row</button>
                </td>
              </tr>
              <tr class="SpreadsheetTable__totalRow SpreadsheetTable__totalRow--expense">
                <td class="SpreadsheetTable__labelCol">TOTAL FIXED</td>
                <td v-for="m in displayMonths" :key="m.key">{{ fmt(totalsFor(m.key).fixed, false) }}</td>
              </tr>

              <!-- VARIABLE EXPENSES -->
              <tr class="SpreadsheetTable__sectionHeader">
                <td :colspan="displayMonths.length + 1">Monthly expenses — Variable</td>
              </tr>
              <tr v-for="row in rowDefs.variable" :key="row.label" class="SpreadsheetTable__dataRow">
                <td class="SpreadsheetTable__labelCol">
                  <div class="RowLabel">
                    <template v-if="editingRowLabel === row.label">
                      <input
                        ref="editInputRef"
                        v-model="editingRowValue"
                        class="RowLabel__input"
                        @keydown.enter.prevent="confirmRenameRow('variable', row.label)"
                        @keydown.escape="editingRowLabel = null"
                        @blur="confirmRenameRow('variable', row.label)"
                      />
                    </template>
                    <template v-else>
                      <button class="RowLabel__textButton" type="button" @click.stop="startEditRow(row.label)">{{ row.label }}</button>
                      <div class="RowLabel__actions">
                        <button class="RowLabel__btn RowLabel__btn--delete" title="Delete row" @click.stop="deleteRow('variable', row.label)">✕</button>
                      </div>
                    </template>
                  </div>
                </td>
                <td
                  v-for="m in displayMonths" :key="m.key"
                  class="SpreadsheetTable__cell"
                  :class="{
                    'SpreadsheetTable__cell--selected': isCellSelected(row.label, m.key),
                    'SpreadsheetTable__cell--empty': !isCellSelected(row.label, m.key) && getAmount(row.label, m.key) === 0,
                  }"
                  @click="selectCell(row, m.key)"
                >
                  <input
                    v-if="isCellSelected(row.label, m.key)"
                    v-model="cellAmount"
                    class="SpreadsheetTable__cellInput"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    @keydown.enter.prevent="saveCellAmount"
                    @keydown.escape="closePanel"
                    @blur="handleCellBlur"
                    @click.stop
                  />
                  <template v-else>{{ fmt(getAmount(row.label, m.key)) }}</template>
                </td>
              </tr>
              <tr class="SpreadsheetTable__addRow">
                <td :colspan="displayMonths.length + 1">
                  <template v-if="addingToSection === 'variable'">
                    <div class="AddRowForm">
                      <input
                        ref="addInputRef"
                        v-model="newRowLabel"
                        class="RowLabel__input"
                        placeholder="Row name…"
                        @keydown.enter.prevent="confirmAddRow"
                        @keydown.escape="addingToSection = null"
                        @blur="confirmAddRow"
                      />
                    </div>
                  </template>
                  <button v-else class="AddRowBtn" @click="startAddRow('variable')">+ Add row</button>
                </td>
              </tr>
              <!-- SAVINGS -->
              <tr class="SpreadsheetTable__sectionHeader">
                <td :colspan="displayMonths.length + 1">Savings</td>
              </tr>
              <tr v-for="row in rowDefs.savings" :key="row.label" class="SpreadsheetTable__dataRow SpreadsheetTable__dataRow--savings">
                <td class="SpreadsheetTable__labelCol">
                  <div class="RowLabel">
                    <template v-if="editingRowLabel === row.label">
                      <input
                        ref="editInputRef"
                        v-model="editingRowValue"
                        class="RowLabel__input"
                        @keydown.enter.prevent="confirmRenameRow('savings', row.label)"
                        @keydown.escape="editingRowLabel = null"
                        @blur="confirmRenameRow('savings', row.label)"
                      />
                    </template>
                    <template v-else>
                      <button class="RowLabel__textButton" type="button" @click.stop="startEditRow(row.label)">{{ row.label }}</button>
                      <div class="RowLabel__actions">
                        <button class="RowLabel__btn RowLabel__btn--delete" title="Delete row" @click.stop="deleteRow('savings', row.label)">✕</button>
                      </div>
                    </template>
                  </div>
                </td>
                <td
                  v-for="m in displayMonths" :key="m.key"
                  class="SpreadsheetTable__cell"
                  :class="{
                    'SpreadsheetTable__cell--selected': isCellSelected(row.label, m.key),
                    'SpreadsheetTable__cell--empty': !isCellSelected(row.label, m.key) && getAmount(row.label, m.key) === 0,
                  }"
                  @click="selectCell(row, m.key)"
                >
                  <input
                    v-if="isCellSelected(row.label, m.key)"
                    v-model="cellAmount"
                    class="SpreadsheetTable__cellInput"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    @keydown.enter.prevent="saveCellAmount"
                    @keydown.escape="closePanel"
                    @blur="handleCellBlur"
                    @click.stop
                  />
                  <template v-else>{{ fmt(getAmount(row.label, m.key)) }}</template>
                </td>
              </tr>
              <tr class="SpreadsheetTable__addRow">
                <td :colspan="displayMonths.length + 1">
                  <template v-if="addingToSection === 'savings'">
                    <div class="AddRowForm">
                      <input
                        ref="addInputRef"
                        v-model="newRowLabel"
                        class="RowLabel__input"
                        placeholder="Row name…"
                        @keydown.enter.prevent="confirmAddRow"
                        @keydown.escape="addingToSection = null"
                        @blur="confirmAddRow"
                      />
                    </div>
                  </template>
                  <button v-else class="AddRowBtn" @click="startAddRow('savings')">+ Add row</button>
                </td>
              </tr>
              <tr class="SpreadsheetTable__totalRow SpreadsheetTable__totalRow--savings">
                <td class="SpreadsheetTable__labelCol">TOTAL SAVINGS</td>
                <td v-for="m in displayMonths" :key="m.key">{{ fmt(totalsFor(m.key).savings, false) }}</td>
              </tr>

              <!-- GRAND TOTALS -->
              <tr class="SpreadsheetTable__totalRow SpreadsheetTable__totalRow--expense">
                <td class="SpreadsheetTable__labelCol">Monthly expenses</td>
                <td v-for="m in displayMonths" :key="m.key">{{ fmt(totalsFor(m.key).expenses, false) }}</td>
              </tr>
              <tr class="SpreadsheetTable__totalRow SpreadsheetTable__totalRow--savings">
                <td class="SpreadsheetTable__labelCol">Net / Loss</td>
                <td
                  v-for="m in displayMonths" :key="m.key"
                  :class="totalsFor(m.key).net < 0 ? 'SpreadsheetTable__cell--negative' : ''"
                >{{ fmt(totalsFor(m.key).net, false) }}</td>
              </tr>

            </tbody>
          </table>
        </div>

        <!-- SIDE PANEL -->
        <aside class="CalendarDetails CalendarDetails--panel BudgetCellPanel">
          <template v-if="selectedCell">
            <div class="CalendarDetails__section">
              <span class="CalendarDetails__eyebrow">Edit cell</span>
              <h2>{{ selectedCell.label }}</h2>
              <p>{{ monthLabel(selectedCell.month) }}</p>
            </div>

            <label class="EventComposer__field">
              <input
                v-model="cellAmount"
                type="number"
                min="0"
                step="0.01"
                :placeholder="`Amount in ${selectedCurrency}`"
                @keydown.enter.prevent="saveCellAmount"
              />
            </label>

            <button class="EventComposer__submit" type="button" :disabled="isSaving" @click="saveCellAmount">
              {{ isSaving ? 'Saving…' : 'Save amount' }}
            </button>

            <div class="CalendarDetails__actions">
              <button
                v-if="getEntry(selectedCell.label, selectedCell.month)"
                class="CalendarDetails__deleteBtn"
                type="button"
                :disabled="isSaving"
                @click="deleteCellEntry"
              >Clear</button>
              <button class="CalendarDetails__editBtn" type="button" @click="closePanel">Cancel</button>
            </div>
          </template>

          <template v-else>
            <div class="CalendarDetails__section">
              <span class="CalendarDetails__eyebrow">No cell selected</span>
              <h2>Pick a cell</h2>
              <p>Click any data cell to add or edit the amount for that month.</p>
            </div>

            <div class="BudgetCellPanel__hint">
              <div class="BudgetCellPanel__hintRow">
                <span class="BudgetCellPanel__dot BudgetCellPanel__dot--income"></span>
                <span>Net income rows</span>
              </div>
              <div class="BudgetCellPanel__hintRow">
                <span class="BudgetCellPanel__dot BudgetCellPanel__dot--fixed"></span>
                <span>Fixed expense rows</span>
              </div>
              <div class="BudgetCellPanel__hintRow">
                <span class="BudgetCellPanel__dot BudgetCellPanel__dot--savings"></span>
                <span>Savings rows</span>
              </div>
            </div>
          </template>
        </aside>
      </div>
    </section>
  </AppShell>
</template>
