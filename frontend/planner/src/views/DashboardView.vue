<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api'
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

const eventForm = reactive({
  title: '',
  description: '',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  category: 'Work',
  color: '#cfdcff',
})

const weekOffset = ref(0)
const timeSlots = Array.from(
  { length: lastVisibleHour - firstVisibleHour + 1 },
  (_, index) => firstVisibleHour + index,
)

const categoryOptions = ['Work', 'Meeting', 'Personal', 'Study', 'Health']
const colorOptions = ['#cfdcff', '#d9efe4', '#f8e2c4', '#eadbff', '#ffd6cf']

function parseTimeParts(value: string) {
  const [rawHour = '9', rawMinute = '0'] = value.split(':')
  return {
    hour: Number(rawHour),
    minute: Number(rawMinute),
  }
}

function startOfWeek(date: Date) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

const currentWeekStart = computed(() => addDays(startOfWeek(new Date()), weekOffset.value * 7))

const visibleDays = computed(() =>
  Array.from({ length: 21 }, (_, index) => {
    const date = addDays(currentWeekStart.value, index)

    return {
      key: toInputDate(date),
      short: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date,
      label: date.toLocaleDateString('en-US', { day: '2-digit' }),
    }
  }),
)

const currentMonthLabel = computed(() =>
  currentWeekStart.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
)

const calendarGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${visibleDays.value.length}, ${dayColumnWidth}px)`,
  gridTemplateRows: `repeat(${timeSlots.length}, ${rowHeight}px)`,
}))

const currentTimeIndicator = computed(() => {
  const now = new Date()
  const todayKey = toInputDate(now)
  const dayIndex = visibleDays.value.findIndex((day) => day.key === todayKey)
  const firstHour = timeSlots[0] ?? firstVisibleHour
  const lastHour = timeSlots[timeSlots.length - 1] ?? 23

  if (dayIndex === -1) {
    return null
  }

  const currentHour = now.getHours()
  if (currentHour < firstHour || currentHour >= lastHour + 1) {
    return null
  }

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
  if (!currentTimeIndicator.value) {
    return null
  }

  return headerHeight + currentTimeIndicator.value.top - bodyScrollTop.value
})

const currentUserName = computed(() => user.value?.name ?? 'Planix User')

const selectedEvent = computed(() => {
  if (!selectedEventId.value) {
    return null
  }

  return events.value.find((event) => event.id === selectedEventId.value || event._id === selectedEventId.value) ?? null
})

const weeklyEvents = computed(() => {
  const start = currentWeekStart.value.getTime()
  const end = addDays(currentWeekStart.value, visibleDays.value.length).getTime()

  return events.value
    .map((event) => {
      const eventDate = new Date(event.date)
      const dayKey = toInputDate(eventDate)
      const dayIndex = visibleDays.value.findIndex((day) => day.key === dayKey)

      if (dayIndex === -1) {
        return null
      }

      const startTime = event.startTime ?? '09:00'
      const endTime = event.endTime ?? '10:00'
      const { hour: startHour, minute: startMinute } = parseTimeParts(startTime)
      const { hour: endHour, minute: endMinute } = parseTimeParts(endTime)

      const firstHour = timeSlots[0] ?? firstVisibleHour
      const startSlot = Math.max(0, startHour - firstHour)
      const roundedEndHour = endMinute > 0 ? endHour + 1 : endHour
      const endSlotRaw = Math.max(startSlot + 1, roundedEndHour - firstHour)
      const span = Math.max(1, Math.min(timeSlots.length - startSlot, endSlotRaw - startSlot))

      return {
        ...event,
        eventDate,
        dayIndex,
        startTime,
        endTime,
        span,
        gridColumn: dayIndex + 1,
        gridRow: startSlot + 1,
      }
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .sort((first, second) => {
      const firstTime = new Date(first.date).getTime()
      const secondTime = new Date(second.date).getTime()
      return firstTime - secondTime || first.startTime.localeCompare(second.startTime)
    })
    .filter((event) => {
      const timestamp = new Date(event.date).getTime()
      return timestamp >= start && timestamp < end
    })
})

const eventsTodayCount = computed(() => weeklyEvents.value.length)

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
  if (!user.value?.id) {
    return
  }

  isLoading.value = true
  pageError.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/events?owner=${encodeURIComponent(user.value.id)}`)

    if (!response.ok) {
      throw new Error('Unable to load events.')
    }

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

function goToPreviousWeek() {
  weekOffset.value -= 1
}

function goToNextWeek() {
  weekOffset.value += 1
}

function goToCurrentWeek() {
  weekOffset.value = 0
}

function syncHeaderScroll() {
  if (!headerViewport.value || !bodyViewport.value) {
    return
  }

  headerViewport.value.scrollLeft = bodyViewport.value.scrollLeft
}

function handleBodyScroll() {
  if (!bodyViewport.value) {
    return
  }

  bodyScrollTop.value = bodyViewport.value.scrollTop
  syncHeaderScroll()
}

async function focusCalendarOnToday() {
  await nextTick()

  const viewport = bodyViewport.value
  if (!viewport || !currentTimeIndicator.value) {
    return
  }

  const todayOffset = currentTimeIndicator.value.dayIndex * dayColumnWidth
  const targetLeft = Math.max(0, todayOffset - dayColumnWidth)
  const targetTop = Math.max(0, currentTimeIndicator.value.top - 220)

  viewport.scrollLeft = targetLeft
  viewport.scrollTop = targetTop
  handleBodyScroll()
}

function handleLogout() {
  logout()
  void router.push('/login')
}

onMounted(() => {
  eventForm.date = visibleDays.value[0]?.key ?? toInputDate(new Date())
  void loadEvents()
  void focusCalendarOnToday()
})
</script>

<template>
  <main class="DashboardPage DashboardPage--calendar">
    <aside class="CalendarSidebar">
      <div class="CalendarSidebar__brand">
        <strong>Planix</strong>
        <span>Calendar workspace</span>
      </div>

      <nav class="CalendarSidebar__nav">
        <button class="CalendarSidebar__link CalendarSidebar__link--active" type="button">Calendar</button>
      </nav>

      <section class="CalendarSidebar__summary">
        <span>Overview</span>
        <strong>{{ eventsTodayCount }} events this week</strong>
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
            <strong>This week</strong>
            <span>{{ eventsTodayCount }} events scheduled</span>
          </div>

          <div class="CalendarBoard__controls">
            <button type="button" @click="goToCurrentWeek">Today</button>
          </div>
        </div>

        <p v-if="pageError" class="CalendarBoard__message CalendarBoard__message--error">{{ pageError }}</p>
        <p v-else-if="isLoading" class="CalendarBoard__message">Loading events...</p>

        <div class="CalendarBoard__layout">
          <div class="CalendarGridShell">
            <div class="CalendarHeaderShell">
              <div class="CalendarAxis__corner"></div>
              <div ref="headerViewport" class="CalendarHeaderViewport">
                <div class="CalendarHeaderTrack" :style="{ gridTemplateColumns: `repeat(${visibleDays.length}, ${dayColumnWidth}px)` }">
                  <div v-for="day in visibleDays" :key="day.key" class="CalendarGrid__dayHeader">
                    <span>{{ day.short }}</span>
                    <strong>{{ day.label }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div class="CalendarBodyShell">
              <div class="CalendarAxis" :style="{ transform: `translateY(-${bodyScrollTop}px)` }">
                <div v-for="hour in timeSlots" :key="hour" class="CalendarAxis__time">
                  {{ formatHour(hour) }}
                </div>
              </div>

              <div ref="bodyViewport" class="CalendarGridViewport" @scroll="handleBodyScroll">
                <div class="CalendarGrid CalendarGrid--week" :style="calendarGridStyle">
                  <template v-for="hour in timeSlots" :key="hour">
                    <div v-for="day in visibleDays" :key="`${day.key}-${hour}`" class="CalendarGrid__slot"></div>
                  </template>

                  <article
                    v-for="event in weeklyEvents"
                    :key="event.id"
                    class="CalendarEvent"
                    :class="{ 'CalendarEvent--active': selectedEventId === event.id }"
                    :style="{
                      gridColumn: event.gridColumn,
                      gridRow: `${event.gridRow} / span ${event.span}`,
                      '--event-accent': event.color ?? '#cfdcff',
                    }"
                    @click="selectedEventId = event.id ?? null"
                  >
                    <strong>{{ event.title }}</strong>
                    <span>{{ event.startTime }} - {{ event.endTime }}</span>
                  </article>

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

                <label class="EventComposer__field">
                  <select v-model="eventForm.color">
                    <option v-for="option in colorOptions" :key="option" :value="option">{{ option }}</option>
                  </select>
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
