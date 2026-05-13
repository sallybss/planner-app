import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers'

export default function noteTestCollection() {
  test('authenticated user can create, search, update, and delete a note', async ({ request }) => {
    test.setTimeout(30_000)

    const { token, userId } = await registerAndLogin(request, 'sali.note')

    const notePayload = {
      title: 'Exam outline',
      content: 'Talk about frameworks and CI/CD in the presentation.',
      tone: 'mint',
      owner: userId,
    }

    const createResponse = await request.post('/api/notes', {
      data: notePayload,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(createResponse.status()).toBe(201)

    const createdNote = await createResponse.json()
    expect(createdNote._id).toBeTruthy()

    const searchResponse = await request.get(
      `/api/notes?owner=${encodeURIComponent(userId)}&q=${encodeURIComponent('frameworks')}`,
    )
    expect(searchResponse.status()).toBe(200)
    const foundNotes = await searchResponse.json()
    expect(foundNotes.some((note: { _id?: string }) => note._id === createdNote._id)).toBe(true)

    const updateResponse = await request.put(`/api/notes/${createdNote._id}`, {
      data: {
        content: 'Talk about frameworks, CI/CD, and deployment in the presentation.',
        tone: 'violet',
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(updateResponse.status()).toBe(200)

    const updatedNote = await updateResponse.json()
    expect(updatedNote.tone).toBe('violet')
    expect(updatedNote.content).toContain('deployment')

    const deleteResponse = await request.delete(`/api/notes/${createdNote._id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(deleteResponse.status()).toBe(200)

    const listResponse = await request.get(`/api/notes?owner=${encodeURIComponent(userId)}`)
    expect(listResponse.status()).toBe(200)
    const notes = await listResponse.json()
    expect(notes.find((note: { _id?: string }) => note._id === createdNote._id)).toBeFalsy()
  })
}
