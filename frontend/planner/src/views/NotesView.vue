<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
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
const editingNoteId = ref<string | null>(null)
const isAddingNote = ref(false)
const isLoading = ref(false)
const isSaving = ref(false)
const pageError = ref('')

const search = ref('')

const noteForm = reactive({
  title: '',
  content: '',
  tone: 'charcoal' as NoteTone,
})

const inlineEditForm = reactive({
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

function formatDate(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function syncInlineEditForm(note: NoteCard) {
  inlineEditForm.title = note.title
  inlineEditForm.content = note.content
  inlineEditForm.tone = note.tone ?? 'charcoal'
}

function isEditingNote(note: NoteCard) {
  const noteId = note.id ?? note._id ?? null
  return editingNoteId.value === noteId
}

function startEditNote(note: NoteCard, focus: 'title' | 'content' = 'title') {
  const noteId = note.id ?? note._id ?? null
  editingNoteId.value = noteId
  syncInlineEditForm(note)
  nextTick(() => {
    const baseSelector = `.NoteCard[data-note-id="${noteId}"]`

    if (focus === 'content') {
      const contentInput = document.querySelector<HTMLTextAreaElement>(`${baseSelector} .NoteCard__contentInput`)
      contentInput?.focus()
      return
    }

    const titleInput = document.querySelector<HTMLInputElement>(`${baseSelector} .NoteCard__titleInput`)
    titleInput?.focus()
    titleInput?.select()
  })
}

function cancelInlineEdit() {
  editingNoteId.value = null
}

function startAddNote() {
  isAddingNote.value = true
  noteForm.title = ''
  noteForm.content = ''
  noteForm.tone = 'charcoal'
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('.NoteCreateCard__titleInput')
    input?.focus()
  })
}

function cancelAddNote() {
  isAddingNote.value = false
  noteForm.title = ''
  noteForm.content = ''
  noteForm.tone = 'charcoal'
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
    cancelAddNote()
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

async function saveInlineNote(note: NoteCard) {
  if (!inlineEditForm.title.trim() || !inlineEditForm.content.trim()) {
    pageError.value = 'Note title and content are required.'
    return
  }

  const noteId = note.id ?? note._id ?? null
  if (!noteId) return

  isSaving.value = true
  pageError.value = ''

  try {
    const updated = await saveNote(note, {
      title: inlineEditForm.title.trim(),
      content: inlineEditForm.content.trim(),
      tone: inlineEditForm.tone,
    })

    if (!updated) return

    notes.value = notes.value.map((note) => (note.id === updated.id ? updated : note))
    editingNoteId.value = null
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Unable to save note.'
  } finally {
    isSaving.value = false
  }
}

async function removeNote(note: NoteCard) {
  if (!user.value?.token) return

  const id = note.id ?? note._id
  if (!id) return
  if (!confirm(`Delete note "${note.title}"?`)) return

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
    if (editingNoteId.value === id) {
      editingNoteId.value = null
    }
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
          <span class="NotesSearch__icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="4.75" stroke="currentColor" stroke-width="1.4" />
              <path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
          </span>
          <input v-model="search" type="text" placeholder="Search notes" @input="loadNotes" />
        </label>
      </div>

      <p v-if="pageError" class="CalendarBoard__message CalendarBoard__message--error">{{ pageError }}</p>
      <p v-else-if="isLoading" class="CalendarBoard__message">Loading notes...</p>

      <div class="NotesGrid">
          <template v-if="isAddingNote">
            <form class="NoteCreateCard" @submit.prevent="submitNote">
              <div class="NoteCreateCard__header">
                <span class="NoteCreateCard__eyebrow">New note</span>
                <label class="NoteCreateCard__toneField">
                  <select v-model="noteForm.tone" class="NoteCreateCard__toneSelect">
                    <option v-for="tone in toneOptions" :key="tone.value" :value="tone.value">{{ tone.label }}</option>
                  </select>
                </label>
              </div>

              <input
                v-model="noteForm.title"
                class="NoteCreateCard__titleInput"
                type="text"
                placeholder="Note title"
                @keydown.esc="cancelAddNote"
              />

              <textarea
                v-model="noteForm.content"
                class="NoteCreateCard__contentInput"
                rows="6"
                placeholder="Write your note"
                @keydown.esc="cancelAddNote"
              />

              <div class="NoteCreateCard__footer">
                <button class="NoteCreateCard__btn" type="submit" :disabled="isSaving">
                  {{ isSaving ? 'Saving...' : 'Save' }}
                </button>
                <button class="NoteCreateCard__btn NoteCreateCard__btn--ghost" type="button" :disabled="isSaving" @click="cancelAddNote">
                  Cancel
                </button>
              </div>
            </form>
          </template>

          <button v-else class="NoteAddTile" type="button" @click="startAddNote" aria-label="Add new note">
            <span class="NoteAddTile__plus">+</span>
          </button>

          <article
            v-for="note in filteredNotes"
            :key="note.id"
            class="NoteCard"
            :data-note-id="note.id"
            :class="[`NoteCard--${note.tone ?? 'charcoal'}`, { 'NoteCard--active': isEditingNote(note) }]"
          >
            <template v-if="isEditingNote(note)">
              <div class="NoteCard__surface NoteCard__surface--editing">
                <div class="NoteCard__editingTop">
                  <span class="NoteCard__date">{{ formatDate(note.updatedAt) }}</span>
                  <label class="NoteCard__toneField">
                    <select v-model="inlineEditForm.tone" class="NoteCard__toneSelect">
                      <option v-for="tone in toneOptions" :key="tone.value" :value="tone.value">{{ tone.label }}</option>
                    </select>
                  </label>
                </div>

                <input
                  v-model="inlineEditForm.title"
                  class="NoteCard__titleInput"
                  type="text"
                  placeholder="Note title"
                  @keydown.enter.prevent="saveInlineNote(note)"
                  @keydown.esc="cancelInlineEdit"
                />

                <textarea
                  v-model="inlineEditForm.content"
                  class="NoteCard__contentInput"
                  rows="6"
                  placeholder="Write your note"
                  @keydown.esc="cancelInlineEdit"
                />

                <div class="NoteCard__footer">
                  <div class="NoteCard__timestamp">
                    <svg class="NoteCard__clock" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/>
                      <path d="M8 5v3.5l2 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                    <span>{{ formatTime(note.updatedAt) }}</span>
                  </div>

                  <div class="NoteCard__actions NoteCard__actions--editing">
                    <button class="NoteCard__actionBtn" type="button" :disabled="isSaving" @click="saveInlineNote(note)">
                      {{ isSaving ? 'Saving...' : 'Save' }}
                    </button>
                    <button class="NoteCard__actionBtn" type="button" :disabled="isSaving" @click="cancelInlineEdit">Cancel</button>
                    <button class="NoteCard__actionBtn NoteCard__actionBtn--delete" type="button" :disabled="isSaving" @click="removeNote(note)">Delete</button>
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="NoteCard__actions">
                <button class="NoteCard__actionBtn" type="button" @click.stop="startEditNote(note)">Edit</button>
                <button class="NoteCard__actionBtn NoteCard__actionBtn--delete" type="button" @click.stop="removeNote(note)">Delete</button>
              </div>

              <div class="NoteCard__surface">
                <span class="NoteCard__date">{{ formatDate(note.updatedAt) }}</span>
                <button class="NoteCard__titleButton" type="button" @click="startEditNote(note, 'title')">{{ note.title }}</button>
                <button class="NoteCard__contentButton" type="button" @click="startEditNote(note, 'content')">{{ note.content }}</button>
                <div class="NoteCard__footer">
                  <svg class="NoteCard__clock" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/>
                    <path d="M8 5v3.5l2 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                  <span>{{ formatTime(note.updatedAt) }}</span>
                </div>
              </div>
            </template>
          </article>

          <div v-if="filteredNotes.length === 0 && !isLoading" class="BoardColumn__empty">
            No notes yet
          </div>
      </div>
    </section>
  </AppShell>
</template>
