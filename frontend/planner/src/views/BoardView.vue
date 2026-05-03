<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { useAuth } from '../auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
const { user } = useAuth()

type TaskStatus = 'todo' | 'in-progress' | 'done'
type TaskPriority = 'low' | 'medium' | 'high'

type TaskCard = {
  _id?: string
  id?: string
  title: string
  description?: string
  status: TaskStatus
  priority?: TaskPriority
  owner: string
  createdAt?: string
  updatedAt?: string
}

const columns: Array<{ key: TaskStatus; title: string; caption: string }> = [
  { key: 'todo', title: 'To Do', caption: 'Capture what needs attention next.' },
  { key: 'in-progress', title: 'In Progress', caption: 'Keep current work visible.' },
  { key: 'done', title: 'Done', caption: 'Track what is already finished.' },
]

const tasks = ref<TaskCard[]>([])
const draggedTaskId = ref<string | null>(null)
const selectedTaskId = ref<string | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const pageError = ref('')

const taskForm = reactive({
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
})

const editForm = reactive({
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
  status: 'todo' as TaskStatus,
})

function normalizeTask(task: TaskCard) {
  return {
    ...task,
    id: task.id ?? task._id ?? crypto.randomUUID(),
  }
}

const tasksByStatus = computed(() =>
  columns.map((column) => ({
    ...column,
    tasks: tasks.value.filter((task) => task.status === column.key),
  })),
)

const selectedTask = computed(
  () => tasks.value.find((task) => task.id === selectedTaskId.value || task._id === selectedTaskId.value) ?? null,
)

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

async function loadTasks() {
  if (!user.value?.id) return

  isLoading.value = true
  pageError.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/tasks?owner=${encodeURIComponent(user.value.id)}`)
    if (!response.ok) throw new Error('Unable to load tasks.')

    const payload = (await response.json()) as TaskCard[]
    tasks.value = payload.map(normalizeTask)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to load tasks.'
    tasks.value = []
  } finally {
    isLoading.value = false
  }
}

async function submitTask() {
  if (!user.value?.id || !user.value.token) {
    pageError.value = 'You must be logged in to create tasks.'
    return
  }

  if (!taskForm.title.trim()) {
    pageError.value = 'Task title is required.'
    return
  }

  isSaving.value = true
  pageError.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.value.token}`,
      },
      body: JSON.stringify({
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        priority: taskForm.priority,
        status: 'todo',
        owner: user.value.id,
      }),
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response, 'Unable to create task.'))
    }

    const created = normalizeTask((await response.json()) as TaskCard)
    tasks.value = [created, ...tasks.value]
    selectedTaskId.value = created.id
    taskForm.title = ''
    taskForm.description = ''
    taskForm.priority = 'medium'
    syncEditForm(created)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to create task.'
  } finally {
    isSaving.value = false
  }
}

function syncEditForm(task: TaskCard) {
  editForm.title = task.title
  editForm.description = task.description ?? ''
  editForm.priority = task.priority ?? 'medium'
  editForm.status = task.status
}

function selectTask(task: TaskCard) {
  selectedTaskId.value = task.id ?? null
  syncEditForm(task)
}

async function saveTask(task: TaskCard, updates: Partial<TaskCard>) {
  if (!user.value?.token) {
    pageError.value = 'You must be logged in to update tasks.'
    return null
  }

  const id = task.id ?? task._id
  if (!id) return null

  const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.value.token}`,
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error(await parseResponseError(response, 'Unable to update task.'))
  }

  return normalizeTask((await response.json()) as TaskCard)
}

async function updateSelectedTask() {
  if (!selectedTask.value) return

  isSaving.value = true
  pageError.value = ''

  try {
    const updated = await saveTask(selectedTask.value, {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      priority: editForm.priority,
      status: editForm.status,
    })

    if (!updated) return

    tasks.value = tasks.value.map((task) => (task.id === updated.id ? updated : task))
    selectTask(updated)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to save task.'
  } finally {
    isSaving.value = false
  }
}

async function removeSelectedTask() {
  if (!selectedTask.value || !user.value?.token) return

  const id = selectedTask.value.id ?? selectedTask.value._id
  if (!id) return

  isSaving.value = true
  pageError.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user.value.token}`,
      },
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response, 'Unable to delete task.'))
    }

    tasks.value = tasks.value.filter((task) => task.id !== id)
    selectedTaskId.value = null
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to delete task.'
  } finally {
    isSaving.value = false
  }
}

function handleDragStart(task: TaskCard) {
  draggedTaskId.value = task.id ?? task._id ?? null
}

function handleDragEnd() {
  draggedTaskId.value = null
}

async function moveTaskToStatus(status: TaskStatus) {
  const draggedTask = tasks.value.find(
    (task) => task.id === draggedTaskId.value || task._id === draggedTaskId.value,
  )

  if (!draggedTask || draggedTask.status === status) return

  const previousStatus = draggedTask.status
  draggedTask.status = status

  try {
    const updated = await saveTask(draggedTask, { status })
    if (!updated) return

    tasks.value = tasks.value.map((task) => (task.id === updated.id ? updated : task))
    if (selectedTaskId.value === updated.id) {
      selectTask(updated)
    }
  } catch (error) {
    draggedTask.status = previousStatus
    pageError.value = error instanceof Error ? error.message : 'Unable to move task.'
  } finally {
    draggedTaskId.value = null
  }
}

onMounted(() => {
  void loadTasks()
})
</script>

<template>
  <AppShell active-section="board" eyebrow="Kanban board" title="Task flow">
    <template #sidebar>
      <section class="CalendarSidebar__summary WorkspaceSummaryCard">
        <span>Workflow</span>
        <p>{{ tasks.length }} tasks across three stages</p>
        <p>Drag cards between columns to keep your exam work moving from idea to done.</p>
      </section>
    </template>

    <section class="BoardPage">
      <div class="BoardHero">
        <div>
          <p class="BoardHero__title">Project delivery board</p>
          <span>Organize tasks the same way you would in Notion, but inside Planix.</span>
        </div>
      </div>

      <p v-if="pageError" class="CalendarBoard__message CalendarBoard__message--error">{{ pageError }}</p>
      <p v-else-if="isLoading" class="CalendarBoard__message">Loading tasks...</p>

      <div class="BoardLayout">
        <div class="BoardColumns">
          <section
            v-for="column in tasksByStatus"
            :key="column.key"
            class="BoardColumn"
            @dragover.prevent
            @drop="moveTaskToStatus(column.key)"
          >
            <header class="BoardColumn__header">
              <div>
                <h2>{{ column.title }}</h2>
                <p>{{ column.caption }}</p>
              </div>
              <span>{{ column.tasks.length }}</span>
            </header>

            <div class="BoardColumn__cards">
              <button
                v-for="task in column.tasks"
                :key="task.id"
                class="BoardCard"
                :class="{ 'BoardCard--active': selectedTaskId === task.id }"
                draggable="true"
                type="button"
                @click="selectTask(task)"
                @dragstart="handleDragStart(task)"
                @dragend="handleDragEnd"
              >
                <div class="BoardCard__meta">
                  <span class="BoardCard__priority" :data-priority="task.priority ?? 'medium'">
                    {{ task.priority ?? 'medium' }}
                  </span>
                  <span>{{ column.title }}</span>
                </div>
                <h3>{{ task.title }}</h3>
                <p>{{ task.description || 'No description yet.' }}</p>
              </button>

              <div v-if="column.tasks.length === 0" class="BoardColumn__empty">
                Drop a task here
              </div>
            </div>
          </section>
        </div>

        <aside class="CalendarDetails CalendarDetails--panel">
          <form class="EventComposer EventComposer--panel" @submit.prevent="submitTask">
            <div class="EventComposer__header">
              <span>Add task</span>
              <p>Create a new kanban card for your workspace.</p>
            </div>

            <label class="EventComposer__field">
              <input v-model="taskForm.title" type="text" placeholder="New task title" />
            </label>

            <label class="EventComposer__field">
              <select v-model="taskForm.priority">
                <option value="low">Low priority</option>
                <option value="medium">Medium priority</option>
                <option value="high">High priority</option>
              </select>
            </label>

            <label class="EventComposer__field">
              <textarea v-model="taskForm.description" rows="4" placeholder="Describe the task"></textarea>
            </label>

            <button class="EventComposer__submit" type="submit" :disabled="isSaving">
              {{ isSaving ? 'Saving...' : 'Save task' }}
            </button>
          </form>

          <div class="CalendarDetails__section">
            <template v-if="selectedTask">
              <span class="CalendarDetails__eyebrow">Selected task</span>
              <h2>Edit card</h2>
              <p>Update details or move this task to a different stage.</p>

              <label class="EventComposer__field">
                <input v-model="editForm.title" type="text" placeholder="Task title" />
              </label>

              <label class="EventComposer__field">
                <select v-model="editForm.status">
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </label>

              <label class="EventComposer__field">
                <select v-model="editForm.priority">
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                </select>
              </label>

              <label class="EventComposer__field">
                <textarea v-model="editForm.description" rows="5" placeholder="Task description"></textarea>
              </label>

              <div class="CalendarDetails__actions">
                <button class="CalendarDetails__editBtn" type="button" :disabled="isSaving" @click="updateSelectedTask">
                  {{ isSaving ? 'Saving…' : 'Save' }}
                </button>
                <button class="CalendarDetails__deleteBtn" type="button" :disabled="isSaving" @click="removeSelectedTask">
                  Delete
                </button>
              </div>
            </template>

            <template v-else>
              <span class="CalendarDetails__eyebrow">Nothing selected</span>
              <h2>Pick a task</h2>
              <p>Select any card to edit it, or drag it into another column.</p>
            </template>
          </div>
        </aside>
      </div>
    </section>
  </AppShell>
</template>
