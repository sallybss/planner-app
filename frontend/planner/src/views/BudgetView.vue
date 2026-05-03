<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { useAuth } from '../auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
const { user } = useAuth()

type BudgetType = 'income' | 'fixed' | 'variable' | 'savings'

type BudgetEntry = {
  _id?: string
  id?: string
  month: string
  type: BudgetType
  category: string
  label: string
  amount: number
  owner: string
  createdAt?: string
  updatedAt?: string
}

const monthOptions = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
  '2026-11',
  '2026-12',
]

const selectedMonth = ref('2026-05')
const entries = ref<BudgetEntry[]>([])
const selectedEntryId = ref<string | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const pageError = ref('')

const typeLabels: Record<BudgetType, string> = {
  income: 'Income',
  fixed: 'Fixed costs',
  variable: 'Variable costs',
  savings: 'Savings',
}

const entryForm = reactive({
  month: '2026-05',
  type: 'income' as BudgetType,
  category: '',
  label: '',
  amount: '',
})

const editForm = reactive({
  month: '2026-05',
  type: 'income' as BudgetType,
  category: '',
  label: '',
  amount: '',
})

function normalizeEntry(entry: BudgetEntry) {
  return {
    ...entry,
    id: entry.id ?? entry._id ?? crypto.randomUUID(),
  }
}

const monthEntries = computed(() =>
  entries.value.filter((entry) => entry.month === selectedMonth.value),
)

const summary = computed(() => {
  const income = monthEntries.value
    .filter((entry) => entry.type === 'income')
    .reduce((sum, entry) => sum + entry.amount, 0)
  const fixed = monthEntries.value
    .filter((entry) => entry.type === 'fixed')
    .reduce((sum, entry) => sum + entry.amount, 0)
  const variable = monthEntries.value
    .filter((entry) => entry.type === 'variable')
    .reduce((sum, entry) => sum + entry.amount, 0)
  const savings = monthEntries.value
    .filter((entry) => entry.type === 'savings')
    .reduce((sum, entry) => sum + entry.amount, 0)

  return {
    income,
    fixed,
    variable,
    savings,
    net: income - fixed - variable - savings,
  }
})

const groupedRows = computed(() =>
  monthEntries.value.map((entry) => ({
    ...entry,
    typeLabel: typeLabels[entry.type],
  })),
)

const selectedEntry = computed(
  () => entries.value.find((entry) => entry.id === selectedEntryId.value || entry._id === selectedEntryId.value) ?? null,
)

function currency(value: number) {
  return new Intl.NumberFormat('en-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 2,
  }).format(value)
}

function syncEditForm(entry: BudgetEntry) {
  editForm.month = entry.month
  editForm.type = entry.type
  editForm.category = entry.category
  editForm.label = entry.label
  editForm.amount = String(entry.amount)
}

function selectEntry(entry: BudgetEntry) {
  selectedEntryId.value = entry.id ?? null
  syncEditForm(entry)
}

async function parseResponseError(response: Response, fallback: string) {
  try {
    const payload = await response.json()
    return payload?.error ?? fallback
  } catch {
    try {
      return (await response.text()) || fallback
    } catch {
      return fallback
    }
  }
}

async function loadEntries() {
  if (!user.value?.id) return

  isLoading.value = true
  pageError.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/budget-entries?owner=${encodeURIComponent(user.value.id)}`)
    if (!response.ok) throw new Error('Unable to load budget entries.')

    const payload = (await response.json()) as BudgetEntry[]
    entries.value = payload.map(normalizeEntry)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to load budget entries.'
    entries.value = []
  } finally {
    isLoading.value = false
  }
}

async function submitEntry() {
  if (!user.value?.id || !user.value.token) {
    pageError.value = 'You must be logged in to create budget entries.'
    return
  }

  const amount = Number(entryForm.amount)
  if (!entryForm.category.trim() || !entryForm.label.trim() || !Number.isFinite(amount)) {
    pageError.value = 'Month, category, label, and amount are required.'
    return
  }

  isSaving.value = true
  pageError.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/budget-entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.value.token}`,
      },
      body: JSON.stringify({
        month: entryForm.month,
        type: entryForm.type,
        category: entryForm.category.trim(),
        label: entryForm.label.trim(),
        amount,
        owner: user.value.id,
      }),
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response, 'Unable to create budget entry.'))
    }

    const created = normalizeEntry((await response.json()) as BudgetEntry)
    entries.value = [...entries.value, created]
    entryForm.category = ''
    entryForm.label = ''
    entryForm.amount = ''
    selectEntry(created)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to create budget entry.'
  } finally {
    isSaving.value = false
  }
}

async function saveEntry(entry: BudgetEntry, updates: Partial<BudgetEntry>) {
  if (!user.value?.token) {
    pageError.value = 'You must be logged in to update budget entries.'
    return null
  }

  const id = entry.id ?? entry._id
  if (!id) return null

  const response = await fetch(`${API_BASE_URL}/budget-entries/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.value.token}`,
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error(await parseResponseError(response, 'Unable to update budget entry.'))
  }

  return normalizeEntry((await response.json()) as BudgetEntry)
}

async function updateSelectedEntry() {
  if (!selectedEntry.value) return

  const amount = Number(editForm.amount)
  if (!editForm.category.trim() || !editForm.label.trim() || !Number.isFinite(amount)) {
    pageError.value = 'Month, category, label, and amount are required.'
    return
  }

  isSaving.value = true
  pageError.value = ''

  try {
    const updated = await saveEntry(selectedEntry.value, {
      month: editForm.month,
      type: editForm.type,
      category: editForm.category.trim(),
      label: editForm.label.trim(),
      amount,
    })

    if (!updated) return

    entries.value = entries.value.map((entry) => (entry.id === updated.id ? updated : entry))
    selectEntry(updated)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to save budget entry.'
  } finally {
    isSaving.value = false
  }
}

async function removeSelectedEntry() {
  if (!selectedEntry.value || !user.value?.token) return

  const id = selectedEntry.value.id ?? selectedEntry.value._id
  if (!id) return

  isSaving.value = true
  pageError.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/budget-entries/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user.value.token}`,
      },
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response, 'Unable to delete budget entry.'))
    }

    entries.value = entries.value.filter((entry) => entry.id !== id)
    selectedEntryId.value = null
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to delete budget entry.'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  void loadEntries()
})
</script>

<template>
  <AppShell active-section="budget" eyebrow="Budget planner" title="Money overview">
    <template #sidebar>
      <section class="CalendarSidebar__summary WorkspaceSummaryCard">
        <span>Budgeting</span>
        <p>{{ monthEntries.length }} entries in {{ selectedMonth }}</p>
        <p>Track income, fixed costs, variable costs, and savings with a cleaner app interface.</p>
      </section>
    </template>

    <section class="BudgetPage">
      <div class="FeatureIntro">
        <div>
          <p class="FeatureIntro__title">Annual budget dashboard</p>
          <span>A modernized version of your spreadsheet logic, built around saved entries and monthly totals.</span>
        </div>

        <label class="CalendarFilter">
          <select v-model="selectedMonth">
            <option v-for="month in monthOptions" :key="month" :value="month">{{ month }}</option>
          </select>
        </label>
      </div>

      <p v-if="pageError" class="CalendarBoard__message CalendarBoard__message--error">{{ pageError }}</p>
      <p v-else-if="isLoading" class="CalendarBoard__message">Loading budget entries...</p>

      <div class="BudgetHighlights">
        <article class="BudgetMetric" data-tone="mint">
          <span>Income</span>
          <strong>{{ currency(summary.income) }}</strong>
        </article>
        <article class="BudgetMetric" data-tone="sand">
          <span>Fixed costs</span>
          <strong>{{ currency(summary.fixed) }}</strong>
        </article>
        <article class="BudgetMetric" data-tone="peach">
          <span>Variable costs</span>
          <strong>{{ currency(summary.variable) }}</strong>
        </article>
        <article class="BudgetMetric" data-tone="violet">
          <span>Net savings/loss</span>
          <strong>{{ currency(summary.net) }}</strong>
        </article>
      </div>

      <div class="BudgetLayout">
        <section class="BudgetTableCard">
          <div class="BudgetTableCard__header">
            <div>
              <h2>Monthly entries</h2>
              <p>Each row behaves like a spreadsheet record but stays easier to manage in the app.</p>
            </div>
          </div>

          <div class="BudgetTableWrap">
            <table class="BudgetTable">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Label</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in groupedRows"
                  :key="entry.id"
                  class="BudgetTable__row"
                  :class="{ 'BudgetTable__row--active': selectedEntryId === entry.id }"
                  @click="selectEntry(entry)"
                >
                  <td>{{ entry.typeLabel }}</td>
                  <td>{{ entry.category }}</td>
                  <td>{{ entry.label }}</td>
                  <td>{{ currency(entry.amount) }}</td>
                </tr>
                <tr v-if="groupedRows.length === 0">
                  <td colspan="4">No entries for this month yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="CalendarDetails CalendarDetails--panel">
          <form class="EventComposer EventComposer--panel" @submit.prevent="submitEntry">
            <div class="EventComposer__header">
              <span>New budget row</span>
              <p>Add income or expense entries for the selected month.</p>
            </div>

            <label class="EventComposer__field">
              <select v-model="entryForm.month">
                <option v-for="month in monthOptions" :key="month" :value="month">{{ month }}</option>
              </select>
            </label>

            <label class="EventComposer__field">
              <select v-model="entryForm.type">
                <option value="income">Income</option>
                <option value="fixed">Fixed costs</option>
                <option value="variable">Variable costs</option>
                <option value="savings">Savings</option>
              </select>
            </label>

            <label class="EventComposer__field">
              <input v-model="entryForm.category" type="text" placeholder="Category" />
            </label>

            <label class="EventComposer__field">
              <input v-model="entryForm.label" type="text" placeholder="Label" />
            </label>

            <label class="EventComposer__field">
              <input v-model="entryForm.amount" type="number" min="0" step="0.01" placeholder="Amount" />
            </label>

            <button class="EventComposer__submit" type="submit" :disabled="isSaving">
              {{ isSaving ? 'Saving...' : 'Save entry' }}
            </button>
          </form>

          <div class="CalendarDetails__section">
            <template v-if="selectedEntry">
              <span class="CalendarDetails__eyebrow">Selected entry</span>
              <h2>Edit budget row</h2>
              <p>Update the values that drive the monthly totals.</p>

              <label class="EventComposer__field">
                <select v-model="editForm.month">
                  <option v-for="month in monthOptions" :key="month" :value="month">{{ month }}</option>
                </select>
              </label>

              <label class="EventComposer__field">
                <select v-model="editForm.type">
                  <option value="income">Income</option>
                  <option value="fixed">Fixed costs</option>
                  <option value="variable">Variable costs</option>
                  <option value="savings">Savings</option>
                </select>
              </label>

              <label class="EventComposer__field">
                <input v-model="editForm.category" type="text" placeholder="Category" />
              </label>

              <label class="EventComposer__field">
                <input v-model="editForm.label" type="text" placeholder="Label" />
              </label>

              <label class="EventComposer__field">
                <input v-model="editForm.amount" type="number" min="0" step="0.01" placeholder="Amount" />
              </label>

              <div class="CalendarDetails__actions">
                <button class="CalendarDetails__editBtn" type="button" :disabled="isSaving" @click="updateSelectedEntry">
                  {{ isSaving ? 'Saving…' : 'Save' }}
                </button>
                <button class="CalendarDetails__deleteBtn" type="button" :disabled="isSaving" @click="removeSelectedEntry">
                  Delete
                </button>
              </div>
            </template>

            <template v-else>
              <span class="CalendarDetails__eyebrow">Nothing selected</span>
              <h2>Pick a budget row</h2>
              <p>Select any row from the monthly table to edit or remove it.</p>
            </template>
          </div>
        </aside>
      </div>
    </section>
  </AppShell>
</template>
