<script setup lang="ts">
import { computed, onMounted, reactive, ref, nextTick } from 'vue'
import AppShell from '../components/AppShell.vue'
import { useAuth } from '../auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
const { user } = useAuth()

type BudgetType = 'income' | 'fixed' | 'variable' | 'savings'
type SectionKey = 'income' | 'fixed' | 'variable' | 'savings'

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

const selectedYear = ref(new Date().getFullYear())
const viewMode = ref<'year' | 'month'>('year')
const selectedMonthIndex = ref(new Date().getMonth())

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

function fmt(value: number, dash = true): string {
  if (dash && value === 0) return '—'
  return (
    new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + ' kr.'
  )
}

// ── cell selection ────────────────────────────────────────
const selectedCell = ref<{ label: string; month: string } | null>(null)
const cellAmount = ref('')

function isCellSelected(label: string, month: string) {
  return selectedCell.value?.label === label && selectedCell.value?.month === month
}

async function selectCell(row: RowDef, monthKey: string) {
  editingRowLabel.value = null
  selectedCell.value = { label: row.label, month: monthKey }
  const existing = getEntry(row.label, monthKey)
  cellAmount.value = existing ? String(existing.amount) : ''
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

  const amount = Number(cellAmount.value)
  if (!Number.isFinite(amount) || amount < 0) {
    pageError.value = 'Enter a valid amount.'
    return
  }

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
  void loadRowDefs()
  void loadEntries()
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
                placeholder="Amount in kr."
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
