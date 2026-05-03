<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { useAuth } from '../auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
const { user } = useAuth()

type NoteTone = 'charcoal' | 'amber' | 'mint' | 'violet'

type NoteCard = {
  _id?: string
  id?: string
  title: string
  content: string
  tone?: NoteTone
  owner: string
  createdAt?: string
  updatedAt?: string
}

const notes = ref<NoteCard[]>([])
const selectedNoteId = ref<string | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const pageError = ref('')

const search = ref('')

const noteForm = reactive({
  title: '',
  content: '',
  tone: 'charcoal' as NoteTone,
})

const editForm = reactive({
  title: '',
  content: '',
  tone: 'charcoal' as NoteTone,
})

const toneOptions: Array<{ label: string; value: NoteTone }> = [
  { label: 'Graphite', value: 'charcoal' },
  { label: 'Amber', value: 'amber' },
  { label: 'Mint', value: 'mint' },
  { label: 'Violet', value: 'violet' },
]

function normalizeNote(note: NoteCard) {
  return {
    ...note,
    id: note.id ?? note._id ?? crypto.randomUUID(),
  }
}

const filteredNotes = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return notes.value

  return notes.value.filter((note) =>
    `${note.title} ${note.content}`.toLowerCase().includes(query),
  )
})

const selectedNote = computed(
  () => notes.value.find((note) => note.id === selectedNoteId.value || note._id === selectedNoteId.value) ?? null,
)

function formatTimestamp(value?: string) {
  if (!value) return 'No date'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function syncEditForm(note: NoteCard) {
  editForm.title = note.title
  editForm.content = note.content
  editForm.tone = note.tone ?? 'charcoal'
}

function selectNote(note: NoteCard) {
  selectedNoteId.value = note.id ?? null
  syncEditForm(note)
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

async function loadNotes() {
  if (!user.value?.id) return

  isLoading.value = true
  pageError.value = ''

  try {
    const params = new URLSearchParams({ owner: user.value.id })
    if (search.value.trim()) {
      params.set('q', search.value.trim())
    }

    const response = await fetch(`${API_BASE_URL}/notes?${params.toString()}`)
    if (!response.ok) throw new Error('Unable to load notes.')

    const payload = (await response.json()) as NoteCard[]
    notes.value = payload.map(normalizeNote)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to load notes.'
    notes.value = []
  } finally {
    isLoading.value = false
  }
}

async function submitNote() {
  if (!user.value?.id || !user.value.token) {
    pageError.value = 'You must be logged in to create notes.'
    return
  }

  if (!noteForm.title.trim() || !noteForm.content.trim()) {
    pageError.value = 'Note title and content are required.'
    return
  }

  isSaving.value = true
  pageError.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.value.token}`,
      },
      body: JSON.stringify({
        title: noteForm.title.trim(),
        content: noteForm.content.trim(),
        tone: noteForm.tone,
        owner: user.value.id,
      }),
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response, 'Unable to create note.'))
    }

    const created = normalizeNote((await response.json()) as NoteCard)
    notes.value = [created, ...notes.value]
    noteForm.title = ''
    noteForm.content = ''
    noteForm.tone = 'charcoal'
    selectNote(created)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to create note.'
  } finally {
    isSaving.value = false
  }
}

async function saveNote(note: NoteCard, updates: Partial<NoteCard>) {
  if (!user.value?.token) {
    pageError.value = 'You must be logged in to update notes.'
    return null
  }

  const id = note.id ?? note._id
  if (!id) return null

  const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.value.token}`,
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error(await parseResponseError(response, 'Unable to update note.'))
  }

  return normalizeNote((await response.json()) as NoteCard)
}

async function updateSelectedNote() {
  if (!selectedNote.value) return

  if (!editForm.title.trim() || !editForm.content.trim()) {
    pageError.value = 'Note title and content are required.'
    return
  }

  isSaving.value = true
  pageError.value = ''

  try {
    const updated = await saveNote(selectedNote.value, {
      title: editForm.title.trim(),
      content: editForm.content.trim(),
      tone: editForm.tone,
    })

    if (!updated) return

    notes.value = notes.value.map((note) => (note.id === updated.id ? updated : note))
    selectNote(updated)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to save note.'
  } finally {
    isSaving.value = false
  }
}

async function removeSelectedNote() {
  if (!selectedNote.value || !user.value?.token) return

  const id = selectedNote.value.id ?? selectedNote.value._id
  if (!id) return

  isSaving.value = true
  pageError.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user.value.token}`,
      },
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response, 'Unable to delete note.'))
    }

    notes.value = notes.value.filter((note) => note.id !== id)
    selectedNoteId.value = null
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to delete note.'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  void loadNotes()
})
</script>

<template>
  <AppShell active-section="notes" eyebrow="Notes space" title="Workspace notes">
    <template #sidebar>
      <section class="CalendarSidebar__summary WorkspaceSummaryCard">
        <span>Notes</span>
        <p>{{ notes.length }} notes in your workspace</p>
        <p>Keep meeting notes, ideas, and exam prep in the same authenticated product.</p>
      </section>
    </template>

    <section class="NotesPage">
      <div class="FeatureIntro">
        <div>
          <p class="FeatureIntro__title">Personal notes</p>
          <span>A softer writing space for ideas, summaries, and reminders.</span>
        </div>

        <label class="CalendarFilter NotesSearch">
          <input v-model="search" type="text" placeholder="Search notes" @input="loadNotes" />
        </label>
      </div>

      <p v-if="pageError" class="CalendarBoard__message CalendarBoard__message--error">{{ pageError }}</p>
      <p v-else-if="isLoading" class="CalendarBoard__message">Loading notes...</p>

      <div class="NotesLayout">
        <div class="NotesGrid">
          <button
            v-for="note in filteredNotes"
            :key="note.id"
            class="NoteCard"
            :class="[`NoteCard--${note.tone ?? 'charcoal'}`, { 'NoteCard--active': selectedNoteId === note.id }]"
            type="button"
            @click="selectNote(note)"
          >
            <span class="NoteCard__eyebrow">Note</span>
            <h2>{{ note.title }}</h2>
            <p>{{ note.content }}</p>
            <small class="NoteCard__date">Updated {{ formatTimestamp(note.updatedAt) }}</small>
          </button>

          <div v-if="filteredNotes.length === 0 && !isLoading" class="BoardColumn__empty">
            No notes yet
          </div>
        </div>

        <aside class="CalendarDetails CalendarDetails--panel">
          <form class="EventComposer EventComposer--panel" @submit.prevent="submitNote">
            <div class="EventComposer__header">
              <span>New note</span>
              <p>Capture ideas, summaries, and quick reminders.</p>
            </div>

            <label class="EventComposer__field">
              <input v-model="noteForm.title" type="text" placeholder="Note title" />
            </label>

            <label class="EventComposer__field">
              <select v-model="noteForm.tone">
                <option v-for="tone in toneOptions" :key="tone.value" :value="tone.value">{{ tone.label }}</option>
              </select>
            </label>

            <label class="EventComposer__field">
              <textarea v-model="noteForm.content" rows="6" placeholder="Write your note"></textarea>
            </label>

            <button class="EventComposer__submit" type="submit" :disabled="isSaving">
              {{ isSaving ? 'Saving...' : 'Save note' }}
            </button>
          </form>

          <div class="CalendarDetails__section">
            <template v-if="selectedNote">
              <span class="CalendarDetails__eyebrow">Selected note</span>
              <h2>Edit note</h2>
              <p>Refine your writing and keep the workspace updated.</p>

              <label class="EventComposer__field">
                <input v-model="editForm.title" type="text" placeholder="Note title" />
              </label>

              <label class="EventComposer__field">
                <select v-model="editForm.tone">
                  <option v-for="tone in toneOptions" :key="tone.value" :value="tone.value">{{ tone.label }}</option>
                </select>
              </label>

              <label class="EventComposer__field">
                <textarea v-model="editForm.content" rows="8" placeholder="Write your note"></textarea>
              </label>

              <div class="CalendarDetails__actions">
                <button class="CalendarDetails__editBtn" type="button" :disabled="isSaving" @click="updateSelectedNote">
                  {{ isSaving ? 'Saving…' : 'Save' }}
                </button>
                <button class="CalendarDetails__deleteBtn" type="button" :disabled="isSaving" @click="removeSelectedNote">
                  Delete
                </button>
              </div>
            </template>

            <template v-else>
              <span class="CalendarDetails__eyebrow">Nothing selected</span>
              <h2>Pick a note</h2>
              <p>Select any note card to edit it here.</p>
            </template>
          </div>
        </aside>
      </div>
    </section>
  </AppShell>
</template>
