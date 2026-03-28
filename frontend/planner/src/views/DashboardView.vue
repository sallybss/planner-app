<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
const router = useRouter()
const { user, initials, logout } = useAuth()
const dayColumnWidth = 150
const timeColumnWidth = 64
const headerHeight = 60
const rowHeight = 44
const firstVisibleHour = 1
const lastVisibleHour = 23
const headerViewport = useTemplateRef<HTMLDivElement>('headerViewport')
const bodyViewport = useTemplateRef<HTMLDivElement>('bodyViewport')
const bodyScrollTop = ref(0)
const bodyScrollLeft = ref(0)

type CalendarEvent = {
  _id?: string
  id?: string
  title: string
  description?: string
  date: string
  startTime?: string
  endTime?: string
  color?: string
  category?: string
  owner: string
}

const events = ref<CalendarEvent[]>([])
const selectedEventId = ref<string | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const pageError = ref('')
const isEditing = ref(false)

const eventForm = reactive({
  title: '',
  description: '',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  category: 'Work',
  color: '#cfdcff',
})

const editForm = reactive({
  title: '',
  description: '',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  category: 'Work',
  color: '#cfdcff',
})
const filters = reactive({
  field: 'title',
  value: '',
})

const timeSlots = Array.from(
  { length: lastVisibleHour - firstVisibleHour + 1 },
  (_, index) => firstVisibleHour + index,
)

const categoryOptions = ['Work', 'Meeting', 'Personal', 'Study', 'Health']
const colorOptions = [
  { label: 'Blue', value: '#cfdcff' },
  { label: 'Mint', value: '#d9efe4' },
  { label: 'Sand', value: '#f8e2c4' },
  { label: 'Lavender', value: '#eadbff' },
  { label: 'Peach', value: '#ffd6cf' },
  { label: 'Rose', value: '#f2c7dc' },
]
const filterOptions = [
  { label: 'Title', value: 'title' },
  { label: 'Category', value: 'category' },
  { label: 'Description', value: 'description' },
  { label: 'Start time', value: 'startTime' },
  { label: 'End time', value: 'endTime' },
  { label: 'Color', value: 'color' },
] as const

function parseTimeParts(value: string) {
  const [rawHour = '9', rawMinute = '0'] = value.split(':')
  return {
    hour: Number(rawHour),
    minute: Number(rawMinute),
  }
}

function getMinutesFromTime(value: string) {
  const { hour, minute } = parseTimeParts(value)
  return hour * 60 + minute
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31)
}

function toInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const currentYear = new Date().getFullYear()
const yearStart = new Date(currentYear, 0, 1)
const yearEnd = endOfYear(yearStart)
const totalYearDays = Math.round((yearEnd.getTime() - yearStart.getTime()) / 86400000) + 1

const visibleDays = computed(() =>
  Array.from({ length: totalYearDays }, (_, index) => {
    const date = addDays(yearStart, index)
    return {
      key: toInputDate(date),
      short: date.toLocaleDateString('en-US', { weekday: 'short' }),
      monthShort: date.toLocaleDateString('en-US', { month: 'short' }),
      date,
      label: date.toLocaleDateString('en-US', { day: '2-digit' }),
      monthLabel: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    }
  }),
)

const focusedDayIndex = computed(() => {
  const viewport = bodyViewport.value
  if (!viewport) {
    const todayKey = toInputDate(new Date())
    return Math.max(visibleDays.value.findIndex((day) => day.key === todayKey), 0)
  }

  const centerOffset = bodyScrollLeft.value + viewport.clientWidth / 2 - timeColumnWidth
  return Math.min(
    visibleDays.value.length - 1,
    Math.max(0, Math.floor(centerOffset / dayColumnWidth)),
  )
})

const currentMonthLabel = computed(() =>
  visibleDays.value[focusedDayIndex.value]?.monthLabel ?? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
)

const sidebarMonthDate = computed(() => visibleDays.value[focusedDayIndex.value]?.date ?? new Date())
const sidebarMonthLabel = computed(() =>
  sidebarMonthDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
)

async function scrollToMonth(targetDate: Date) {
  await nextTick()
  const viewport = bodyViewport.value
  const targetMonth = targetDate.getMonth()
  const targetYear = targetDate.getFullYear()
  const targetIndex = visibleDays.value.findIndex(
    (day) => day.date.getFullYear() === targetYear && day.date.getMonth() === targetMonth && day.date.getDate() === 1,
  )

  if (!viewport || targetIndex === -1) return

  viewport.scrollLeft = Math.max(0, targetIndex * dayColumnWidth - dayColumnWidth)
  handleBodyScroll()
}

function goToPreviousMonth() {
  const current = sidebarMonthDate.value
  void scrollToMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1))
}

function goToNextMonth() {
  const current = sidebarMonthDate.value
  void scrollToMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1))
}

const sidebarMonthDays = computed(() => {
  const monthDate = sidebarMonthDate.value
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const leading = (start.getDay() + 6) % 7
  const total = leading + end.getDate()
  const cells = Math.ceil(total / 7) * 7
  const todayKey = toInputDate(new Date())
  const focusedKey = visibleDays.value[focusedDayIndex.value]?.key

  return Array.from({ length: cells }, (_, index) => {
    const dayNumber = index - leading + 1
    if (dayNumber < 1 || dayNumber > end.getDate()) {
      return {
        key: `empty-${index}`,
        label: '',
        isCurrentMonth: false,
        isToday: false,
        isFocused: false,
      }
    }

    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber)
    const key = toInputDate(date)
    return {
      key,
      label: String(dayNumber),
      isCurrentMonth: true,
      isToday: key === todayKey,
      isFocused: key === focusedKey,
    }
  })
})

const calendarGridStyle = computed(() => ({
  gridTemplateColumns: `64px repeat(${visibleDays.value.length}, ${dayColumnWidth}px)`,
  gridTemplateRows: `repeat(${timeSlots.length}, ${rowHeight}px)`,
  height: `${timeSlots.length * rowHeight}px`,
}))

const calendarEventsLayerStyle = computed(() => ({
  gridTemplateColumns: `64px repeat(${visibleDays.value.length}, ${dayColumnWidth}px)`,
  height: `${timeSlots.length * rowHeight}px`,
}))

const currentTimeIndicator = computed(() => {
  const now = new Date()
  const todayKey = toInputDate(now)
  const dayIndex = visibleDays.value.findIndex((day) => day.key === todayKey)
  const firstHour = timeSlots[0] ?? firstVisibleHour
  const lastHour = timeSlots[timeSlots.length - 1] ?? 23

  if (dayIndex === -1) return null

  const currentHour = now.getHours()
  if (currentHour < firstHour || currentHour >= lastHour + 1) return null

  const minutesSinceStart = (currentHour - firstHour) * 60 + now.getMinutes()

  return {
    top: (minutesSinceStart / 60) * rowHeight,
    label: now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    dayIndex,
  }
})

const currentTimeBadgeTop = computed(() => {
  if (!currentTimeIndicator.value) return null
  return headerHeight + currentTimeIndicator.value.top - bodyScrollTop.value
})

const currentUserName = computed(() => user.value?.name ?? 'Planix User')
const normalizedFilterValue = computed(() => filters.value.trim().toLowerCase())
const isFilterActive = computed(() => normalizedFilterValue.value.length > 0)

const selectedEvent = computed(() => {
  if (!selectedEventId.value) return null
  return events.value.find((event) => event.id === selectedEventId.value || event._id === selectedEventId.value) ?? null
})

const filteredEvents = computed(() => {
  if (!isFilterActive.value) return events.value

  return events.value.filter((event) => {
    const rawValue = event[filters.field as keyof CalendarEvent]
    if (rawValue == null) return false
    return String(rawValue).toLowerCase().includes(normalizedFilterValue.value)
  })
})

const calendarEvents = computed(() =>
  filteredEvents.value
    .map((event) => {
      const eventDate = new Date(event.date)
      const dayKey = toInputDate(eventDate)
      const dayIndex = visibleDays.value.findIndex((day) => day.key === dayKey)

      if (dayIndex === -1) return null

      const startTime = event.startTime ?? '09:00'
      const endTime = event.endTime ?? '10:00'
      const firstHour = timeSlots[0] ?? firstVisibleHour
      const firstVisibleMinute = firstHour * 60
      const startMinutes = Math.max(getMinutesFromTime(startTime), firstVisibleMinute)
      const rawEndMinutes = getMinutesFromTime(endTime)
      const endMinutes = Math.max(startMinutes + 30, rawEndMinutes)
      const minutesFromTop = startMinutes - firstVisibleMinute
      const durationMinutes = Math.max(30, endMinutes - startMinutes)
      const top = (minutesFromTop / 60) * rowHeight + 6
      const height = Math.max((durationMinutes / 60) * rowHeight - 12, 36)

      return {
        ...event,
        eventDate,
        dayIndex,
        startTime,
        endTime,
        top,
        height,
      }
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .sort((first, second) => {
      const firstTime = new Date(first.date).getTime()
      const secondTime = new Date(second.date).getTime()
      return firstTime - secondTime || first.startTime.localeCompare(second.startTime)
    })
)

const eventsThisYearCount = computed(() => filteredEvents.value.length)

function clearFilters() {
  filters.field = 'title'
  filters.value = ''
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const normalized = hour % 12 || 12
  return `${normalized} ${suffix}`
}

function formatEventDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function normalizeEvent(event: CalendarEvent) {
  return {
    ...event,
    id: event.id ?? event._id ?? crypto.randomUUID(),
  }
}

async function loadEvents() {
  if (!user.value?.id) return
  isLoading.value = true
  pageError.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/events?owner=${encodeURIComponent(user.value.id)}`)
    if (!response.ok) throw new Error('Unable to load events.')
    const payload = (await response.json()) as CalendarEvent[]
    events.value = payload.map(normalizeEvent)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to load events.'
    events.value = []
  } finally {
    isLoading.value = false
  }
}

async function submitEvent() {
  if (!user.value?.id || !user.value.token) {
    pageError.value = 'You must be logged in to create events.'
    return
  }
  if (!eventForm.title.trim() || !eventForm.date) {
    pageError.value = 'Title and date are required.'
    return
  }
  isSaving.value = true
  pageError.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.value.token}`,
      },
      body: JSON.stringify({
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        date: new Date(`${eventForm.date}T00:00:00`).toISOString(),
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        category: eventForm.category.trim(),
        color: eventForm.color,
        owner: user.value.id,
      }),
    })
    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || 'Unable to create event.')
    }
    const createdEvent = normalizeEvent((await response.json()) as CalendarEvent)
    events.value = [createdEvent, ...events.value]
    selectedEventId.value = createdEvent.id ?? null
    eventForm.title = ''
    eventForm.description = ''
    eventForm.date = ''
    eventForm.startTime = '09:00'
    eventForm.endTime = '10:00'
    eventForm.category = 'Work'
    eventForm.color = '#cfdcff'
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to create event.'
  } finally {
    isSaving.value = false
  }
}

function startEditing() {
  if (!selectedEvent.value) return
  Object.assign(editForm, {
    title: selectedEvent.value.title,
    description: selectedEvent.value.description ?? '',
    date: new Date(selectedEvent.value.date).toISOString().slice(0, 10),
    startTime: selectedEvent.value.startTime ?? '09:00',
    endTime: selectedEvent.value.endTime ?? '10:00',
    category: selectedEvent.value.category ?? 'Work',
    color: selectedEvent.value.color ?? '#cfdcff',
  })
  isEditing.value = true
}

async function saveEdit() {
  if (!selectedEvent.value || !user.value?.token) return
  isSaving.value = true
  pageError.value = ''
  try {
    const id = selectedEvent.value._id ?? selectedEvent.value.id
    const response = await fetch(`${API_BASE_URL}/events/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.value.token}`,
      },
      body: JSON.stringify({
        ...editForm,
        date: new Date(`${editForm.date}T00:00:00`).toISOString(),
      }),
    })
    if (!response.ok) throw new Error(await response.text())
    const updated = normalizeEvent((await response.json()) as CalendarEvent)
    events.value = events.value.map((e) => (e.id === updated.id ? updated : e))
    isEditing.value = false
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to save event.'
  } finally {
    isSaving.value = false
  }
}

async function deleteEvent() {
  if (!selectedEvent.value || !user.value?.token) return
  if (!confirm('Delete this event?')) return
  try {
    const id = selectedEvent.value._id ?? selectedEvent.value.id
    const response = await fetch(`${API_BASE_URL}/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user.value.token}` },
    })
    if (!response.ok) throw new Error(await response.text())
    const deletedId = selectedEvent.value.id
    events.value = events.value.filter((e) => e.id !== deletedId)
    selectedEventId.value = null
    isEditing.value = false
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to delete event.'
  }
}

function goToCurrentWeek() {
  void focusCalendarOnToday()
}

function syncHeaderScroll() {
  if (!headerViewport.value || !bodyViewport.value) return
  headerViewport.value.scrollLeft = bodyViewport.value.scrollLeft
}

function handleBodyScroll() {
  if (!bodyViewport.value) return
  bodyScrollTop.value = bodyViewport.value.scrollTop
  bodyScrollLeft.value = bodyViewport.value.scrollLeft
  syncHeaderScroll()
}

async function focusCalendarOnToday() {
  await nextTick()
  const viewport = bodyViewport.value
  const todayKey = toInputDate(new Date())
  const todayIndex = visibleDays.value.findIndex((day) => day.key === todayKey)
  if (!viewport || todayIndex === -1) return
  const targetLeft = Math.max(0, todayIndex * dayColumnWidth - dayColumnWidth)
  const targetTop = Math.max(0, (currentTimeIndicator.value?.top ?? rowHeight * 8) - 220)
  viewport.scrollLeft = targetLeft
  viewport.scrollTop = targetTop
  handleBodyScroll()
}

function handleLogout() {
  logout()
  void router.push('/login')
}

onMounted(() => {
  eventForm.date = toInputDate(new Date())
  void loadEvents()
  void focusCalendarOnToday()
})
</script>

<template>
  <main class="DashboardPage DashboardPage--calendar">
    <aside class="CalendarSidebar">
      <div class="CalendarSidebar__brand">
        <p>Planix</p>
        <span>Calendar workspace</span>
      </div>

      <nav class="CalendarSidebar__nav">
        <button class="CalendarSidebar__link CalendarSidebar__link--active" type="button">Calendar</button>
      </nav>

      <section class="CalendarMini">
        <div class="CalendarMini__header">
          <button type="button" class="CalendarMini__nav" @click="goToPreviousMonth" aria-label="Previous month">
            ‹
          </button>
          <p>{{ sidebarMonthLabel }}</p>
          <button type="button" class="CalendarMini__nav" @click="goToNextMonth" aria-label="Next month">
            ›
          </button>
        </div>
        <div class="CalendarMini__weekdays">
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
          <span>Su</span>
        </div>
        <div class="CalendarMini__grid">
          <span
            v-for="day in sidebarMonthDays"
            :key="day.key"
            class="CalendarMini__day"
            :class="{
              'CalendarMini__day--muted': !day.isCurrentMonth,
              'CalendarMini__day--today': day.isToday,
              'CalendarMini__day--focused': day.isFocused,
            }"
          >
            {{ day.label }}
          </span>
        </div>
      </section>

      <section class="CalendarSidebar__summary">
        <span>Overview</span>
        <p>{{ eventsThisYearCount }} events this year</p>
        <p>Use the calendar board to review events and add new ones from the right panel.</p>
      </section>
    </aside>

    <section class="CalendarWorkspace">
      <header class="CalendarWorkspace__topbar">
        <div>
          <span class="CalendarWorkspace__eyebrow">Weekly calendar</span>
          <h1>{{ currentMonthLabel }}</h1>
        </div>

        <div class="CalendarWorkspace__actions">
          <div class="CalendarWorkspace__user">
            <span class="CalendarWorkspace__userMeta">{{ currentUserName }}</span>
            <span class="CalendarWorkspace__userAvatar">{{ initials }}</span>
          </div>
          <button class="CalendarWorkspace__logout" type="button" @click="handleLogout">Log out</button>
        </div>
      </header>

      <section class="CalendarBoard">
        <div class="CalendarBoard__header">
          <div>
            <p class="CalendarBoard__title">Year timeline</p>
            <span>{{ eventsThisYearCount }} events scheduled</span>
          </div>

          <div class="CalendarBoard__controls">
            <label class="CalendarFilter">
              <select v-model="filters.field" aria-label="Filter field">
                <option v-for="option in filterOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <input v-model="filters.value" type="text" :placeholder="`Filter by ${filters.field}`" />
              <button v-if="isFilterActive" type="button" class="CalendarFilter__clear" @click="clearFilters">Clear</button>
            </label>
            <button type="button" @click="goToCurrentWeek">Today</button>
          </div>
        </div>

        <p v-if="pageError" class="CalendarBoard__message CalendarBoard__message--error">{{ pageError }}</p>
        <p v-else-if="isLoading" class="CalendarBoard__message">Loading events...</p>

        <div class="CalendarBoard__layout">
          <div class="CalendarGridShell">
            <div class="CalendarHeaderShell">
              <div ref="headerViewport" class="CalendarHeaderViewport">
                <div class="CalendarHeaderTrack" :style="{ gridTemplateColumns: `64px repeat(${visibleDays.length}, ${dayColumnWidth}px)` }">
                  <div class="CalendarAxis__corner"></div>
                  <div v-for="day in visibleDays" :key="day.key" class="CalendarGrid__dayHeader">
                    <span>{{ day.short }}</span>
                    <p>{{ day.label }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="CalendarBodyShell">
              <div ref="bodyViewport" class="CalendarGridViewport" @scroll="handleBodyScroll">
                <div class="CalendarGrid CalendarGrid--week" :style="calendarGridStyle">
                  <div class="CalendarAxisInline">
                    <div v-for="hour in timeSlots" :key="hour" class="CalendarAxis__time">
                      {{ formatHour(hour) }}
                    </div>
                  </div>
                  <template v-for="hour in timeSlots" :key="hour">
                    <div
                      v-for="(day, dayIdx) in visibleDays"
                      :key="`${day.key}-${hour}`"
                      class="CalendarGrid__slot"
                      :style="{ gridColumn: dayIdx + 2 }"
                    ></div>
                  </template>

                  <div class="CalendarEventsLayer" :style="calendarEventsLayerStyle">
                    <article
                      v-for="event in calendarEvents"
                      :key="event.id"
                      class="CalendarEvent"
                      :class="{ 'CalendarEvent--active': selectedEventId === event.id }"
                      :style="{
                        gridColumn: event.dayIndex + 2,
                        top: `${event.top}px`,
                        height: `${event.height}px`,
                        '--event-accent': event.color ?? '#cfdcff',
                      }"
                      @click="selectedEventId = event.id ?? null; isEditing = false"
                    >
                      <p class="CalendarEvent__title">{{ event.title }}</p>
                      <span>{{ event.startTime }} - {{ event.endTime }}</span>
                    </article>
                  </div>

                  <div
                    v-if="currentTimeIndicator"
                    class="CalendarNowLine"
                    :style="{ top: `${currentTimeIndicator.top}px` }"
                  >
                    <i></i>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="currentTimeBadgeTop !== null" class="CalendarNowBadge" :style="{ top: `${currentTimeBadgeTop}px` }">
              {{ currentTimeIndicator?.label }}
            </div>
          </div>

          <aside class="CalendarDetails CalendarDetails--panel">
            <form class="EventComposer EventComposer--panel" @submit.prevent="submitEvent">
              <div class="EventComposer__header">
                <span>Add schedule</span>
                <p>Create a new event for the selected week.</p>
              </div>

              <label class="EventComposer__field">
                <input v-model="eventForm.title" type="text" placeholder="New event title" />
              </label>

              <label class="EventComposer__field">
                <input v-model="eventForm.date" type="date" />
              </label>

              <div class="EventComposer__row">
                <label class="EventComposer__field">
                  <input v-model="eventForm.startTime" type="time" />
                </label>

                <label class="EventComposer__field">
                  <input v-model="eventForm.endTime" type="time" />
                </label>
              </div>

              <div class="EventComposer__row">
                <label class="EventComposer__field">
                  <select v-model="eventForm.category">
                    <option v-for="option in categoryOptions" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>

                <label class="EventComposer__field EventComposer__field--color">
                  <span class="EventComposer__colorLabel">Event color</span>
                  <div class="ColorPicker">
                    <button
                      v-for="opt in colorOptions"
                      :key="opt.value"
                      type="button"
                      class="ColorPicker__swatch"
                      :class="{ 'ColorPicker__swatch--active': eventForm.color === opt.value }"
                      :style="{ '--swatch': opt.value }"
                      :title="opt.label"
                      @click="eventForm.color = opt.value"
                    ></button>
                  </div>
                </label>
              </div>

              <label class="EventComposer__field">
                <textarea v-model="eventForm.description" rows="3" placeholder="Add description"></textarea>
              </label>

              <button class="EventComposer__submit" type="submit" :disabled="isSaving">
                {{ isSaving ? 'Saving...' : 'Save' }}
              </button>
            </form>

            <div class="CalendarDetails__section">
              <template v-if="selectedEvent">
                <span class="CalendarDetails__eyebrow">Selected event</span>

                <!-- View mode -->
                <template v-if="!isEditing">
                  <h2>{{ selectedEvent.title }}</h2>
                  <p>{{ formatEventDate(selectedEvent.date) }}</p>
                  <dl class="CalendarDetails__meta">
                    <div>
                      <dt>Time</dt>
                      <dd>{{ selectedEvent.startTime || '09:00' }} - {{ selectedEvent.endTime || '10:00' }}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{{ selectedEvent.category || 'General' }}</dd>
                    </div>
                    <div>
                      <dt>Owner</dt>
                      <dd>{{ currentUserName }}</dd>
                    </div>
                  </dl>
                  <dl class="CalendarDetails__meta">
                    <div>
                      <dt>Description</dt>
                      <dd class="CalendarDetails__description">
                        {{ selectedEvent.description || 'No description added for this event yet.' }}
                      </dd>
                    </div>
                  </dl>
                  <div class="CalendarDetails__actions">
                    <button class="CalendarDetails__editBtn" type="button" @click="startEditing">Edit</button>
                    <button class="CalendarDetails__deleteBtn" type="button" @click="deleteEvent">Delete</button>
                  </div>
                </template>

                <!-- Edit mode -->
                <template v-else>
                  <label class="EventComposer__field">
                    <input v-model="editForm.title" type="text" placeholder="Event title" />
                  </label>
                  <label class="EventComposer__field">
                    <input v-model="editForm.date" type="date" />
                  </label>
                  <div class="EventComposer__row">
                    <label class="EventComposer__field">
                      <input v-model="editForm.startTime" type="time" />
                    </label>
                    <label class="EventComposer__field">
                      <input v-model="editForm.endTime" type="time" />
                    </label>
                  </div>
                  <div class="EventComposer__row">
                    <label class="EventComposer__field">
                      <select v-model="editForm.category">
                        <option v-for="opt in categoryOptions" :key="opt" :value="opt">{{ opt }}</option>
                      </select>
                    </label>
                    <label class="EventComposer__field EventComposer__field--color">
                      <span class="EventComposer__colorLabel">Event color</span>
                      <div class="ColorPicker">
                        <button
                          v-for="opt in colorOptions"
                          :key="opt.value"
                          type="button"
                          class="ColorPicker__swatch"
                          :class="{ 'ColorPicker__swatch--active': editForm.color === opt.value }"
                          :style="{ '--swatch': opt.value }"
                          :title="opt.label"
                          @click="editForm.color = opt.value"
                        ></button>
                      </div>
                    </label>
                  </div>
                  <label class="EventComposer__field">
                    <textarea v-model="editForm.description" rows="2" placeholder="Description"></textarea>
                  </label>
                  <div class="CalendarDetails__actions">
                    <button class="CalendarDetails__editBtn" type="button" :disabled="isSaving" @click="saveEdit">
                      {{ isSaving ? 'Saving…' : 'Save' }}
                    </button>
                    <button class="CalendarDetails__deleteBtn" type="button" @click="isEditing = false">Cancel</button>
                  </div>
                </template>
              </template>

              <template v-else>
                <span class="CalendarDetails__eyebrow">Nothing selected</span>
                <h2>Pick an event</h2>
                <p>Click any event block on the calendar to inspect its details here.</p>
              </template>
            </div>
          </aside>
        </div>
      </section>
    </section>
  </main>
</template>
