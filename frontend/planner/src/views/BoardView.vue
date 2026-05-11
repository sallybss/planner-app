<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
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
const editingTaskId = ref<string | null>(null)
const addingTaskStatus = ref<TaskStatus | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const pageError = ref('')

const quickAddForm = reactive({
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
})

const inlineEditForm = reactive({
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

async function createTask(options: {
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  reset?: () => void
}) {
  if (!user.value?.id || !user.value.token) {
    pageError.value = 'You must be logged in to create tasks.'
    return
  }

  if (!options.title.trim()) {
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
        title: options.title.trim(),
        description: options.description.trim(),
        priority: options.priority,
        status: options.status,
        owner: user.value.id,
      }),
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response, 'Unable to create task.'))
    }

    const created = normalizeTask((await response.json()) as TaskCard)
    tasks.value = [created, ...tasks.value]
    options.reset?.()
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to create task.'
  } finally {
    isSaving.value = false
  }
}

function startQuickAdd(status: TaskStatus) {
  addingTaskStatus.value = status
  quickAddForm.title = ''
  quickAddForm.description = ''
  quickAddForm.priority = 'medium'
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(`.BoardColumn[data-column-status="${status}"] .BoardQuickAdd__title`)
    input?.focus()
  })
}

function cancelQuickAdd() {
  addingTaskStatus.value = null
}

async function submitQuickAdd(status: TaskStatus) {
  await createTask({
    title: quickAddForm.title,
    description: quickAddForm.description,
    priority: quickAddForm.priority,
    status,
    reset: () => {
      quickAddForm.title = ''
      quickAddForm.description = ''
      quickAddForm.priority = 'medium'
      addingTaskStatus.value = null
    },
  })
}

function syncInlineEditForm(task: TaskCard) {
  inlineEditForm.title = task.title
  inlineEditForm.description = task.description ?? ''
  inlineEditForm.priority = task.priority ?? 'medium'
  inlineEditForm.status = task.status
}

function isEditingTask(task: TaskCard) {
  const taskId = task.id ?? task._id ?? null
  return editingTaskId.value === taskId
}

function startEditTask(task: TaskCard, focus: 'title' | 'description' = 'title') {
  const taskId = task.id ?? task._id ?? null
  editingTaskId.value = taskId
  syncInlineEditForm(task)
  nextTick(() => {
    const baseSelector = `.BoardCard[data-task-id="${taskId}"]`
    if (focus === 'description') {
      const descriptionInput = document.querySelector<HTMLTextAreaElement>(`${baseSelector} .BoardCard__descriptionInput`)
      descriptionInput?.focus()
      return
    }
    const titleInput = document.querySelector<HTMLInputElement>(`${baseSelector} .BoardCard__titleInput`)
    titleInput?.focus()
    titleInput?.select()
  })
}

function cancelInlineEdit() {
  editingTaskId.value = null
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

async function saveInlineTask(task: TaskCard) {
  if (!inlineEditForm.title.trim()) {
    pageError.value = 'Task title is required.'
    return
  }

  isSaving.value = true
  pageError.value = ''

  try {
    const updated = await saveTask(task, {
      title: inlineEditForm.title.trim(),
      description: inlineEditForm.description.trim(),
      priority: inlineEditForm.priority,
      status: inlineEditForm.status,
    })

    if (!updated) return

    tasks.value = tasks.value.map((task) => (task.id === updated.id ? updated : task))
    editingTaskId.value = null
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to save task.'
  } finally {
    isSaving.value = false
  }
}

async function removeTask(task: TaskCard) {
  if (!user.value?.token) return

  const id = task.id ?? task._id
  if (!id) return
  if (!confirm(`Delete task "${task.title}"?`)) return

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
    if (editingTaskId.value === id) {
      editingTaskId.value = null
    }
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
    if (editingTaskId.value === updated.id) {
      syncInlineEditForm(updated)
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
            :data-column-status="column.key"
            @dragover.prevent
            @drop="moveTaskToStatus(column.key)"
          >
            <header class="BoardColumn__header">
              <div>
                <h2>{{ column.title }}</h2>
                <p>{{ column.caption }}</p>
              </div>
              <div class="BoardColumn__headerActions">
                <button class="BoardColumn__addBtn" type="button" @click="startQuickAdd(column.key)">+</button>
                <span>{{ column.tasks.length }}</span>
              </div>
            </header>

            <div class="BoardColumn__cards">
              <form
                v-if="addingTaskStatus === column.key"
                class="BoardQuickAdd"
                @submit.prevent="submitQuickAdd(column.key)"
              >
                <input
                  v-model="quickAddForm.title"
                  class="BoardQuickAdd__title"
                  type="text"
                  placeholder="Task title"
                  @keydown.esc="cancelQuickAdd"
                />
                <textarea
                  v-model="quickAddForm.description"
                  class="BoardQuickAdd__description"
                  rows="3"
                  placeholder="Task description"
                  @keydown.esc="cancelQuickAdd"
                />
                <div class="BoardQuickAdd__footer">
                  <select v-model="quickAddForm.priority" class="BoardQuickAdd__select">
                    <option value="low">Low priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="high">High priority</option>
                  </select>
                  <div class="BoardQuickAdd__actions">
                    <button class="BoardQuickAdd__btn" type="submit" :disabled="isSaving">
                      {{ isSaving ? 'Saving...' : 'Add' }}
                    </button>
                    <button class="BoardQuickAdd__btn BoardQuickAdd__btn--ghost" type="button" :disabled="isSaving" @click="cancelQuickAdd">
                      Cancel
                    </button>
                  </div>
                </div>
              </form>

              <article
                v-for="task in column.tasks"
                :key="task.id"
                class="BoardCard"
                :data-task-id="task.id"
                :class="{ 'BoardCard--active': isEditingTask(task) }"
                :draggable="!isEditingTask(task)"
                @dragstart="handleDragStart(task)"
                @dragend="handleDragEnd"
              >
                <template v-if="isEditingTask(task)">
                  <div class="BoardCard__surface BoardCard__surface--editing">
                    <div class="BoardCard__editingTop">
                      <select v-model="inlineEditForm.priority" class="BoardCard__select BoardCard__select--priority">
                        <option value="low">Low priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="high">High priority</option>
                      </select>
                      <select v-model="inlineEditForm.status" class="BoardCard__select">
                        <option value="todo">To Do</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>

                    <input
                      v-model="inlineEditForm.title"
                      class="BoardCard__titleInput"
                      type="text"
                      placeholder="Task title"
                      @keydown.enter.prevent="saveInlineTask(task)"
                      @keydown.esc="cancelInlineEdit"
                    />

                    <textarea
                      v-model="inlineEditForm.description"
                      class="BoardCard__descriptionInput"
                      rows="4"
                      placeholder="Task description"
                      @keydown.esc="cancelInlineEdit"
                    />

                    <div class="BoardCard__footer">
                      <div class="BoardCard__actions BoardCard__actions--editing">
                        <button class="BoardCard__actionBtn" type="button" :disabled="isSaving" @click="saveInlineTask(task)">
                          {{ isSaving ? 'Saving...' : 'Save' }}
                        </button>
                        <button class="BoardCard__actionBtn" type="button" :disabled="isSaving" @click="cancelInlineEdit">Cancel</button>
                        <button class="BoardCard__actionBtn BoardCard__actionBtn--delete" type="button" :disabled="isSaving" @click="removeTask(task)">Delete</button>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="BoardCard__actions">
                    <button class="BoardCard__actionBtn" type="button" @click.stop="startEditTask(task)">Edit</button>
                    <button class="BoardCard__actionBtn BoardCard__actionBtn--delete" type="button" @click.stop="removeTask(task)">Delete</button>
                  </div>

                  <div class="BoardCard__surface">
                    <div class="BoardCard__meta">
                      <span class="BoardCard__priority" :data-priority="task.priority ?? 'medium'">
                        {{ task.priority ?? 'medium' }}
                      </span>
                      <span>{{ column.title }}</span>
                    </div>
                    <button class="BoardCard__titleButton" type="button" @click="startEditTask(task, 'title')">{{ task.title }}</button>
                    <button class="BoardCard__descriptionButton" type="button" @click="startEditTask(task, 'description')">
                      {{ task.description || 'No description yet.' }}
                    </button>
                  </div>
                </template>
              </article>

              <div v-if="column.tasks.length === 0" class="BoardColumn__empty">
                Drop a task here
              </div>
            </div>
          </section>
        </div>

      </div>
    </section>
  </AppShell>
</template>
