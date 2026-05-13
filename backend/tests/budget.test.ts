import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers'

export default function budgetTestCollection() {
  test('authenticated user can create, update, list, and delete budget rows and entries', async ({ request }) => {
    test.setTimeout(30_000)

    const { token, userId } = await registerAndLogin(request, 'sali.budget')

    const rowPayload = {
      label: 'Exam materials',
      type: 'variable',
      owner: userId,
    }

    const createRowResponse = await request.post('/api/budget-row-defs', {
      data: rowPayload,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(createRowResponse.status()).toBe(201)

    const createdRow = await createRowResponse.json()
    expect(createdRow._id).toBeTruthy()

    const rowListResponse = await request.get(`/api/budget-row-defs?owner=${encodeURIComponent(userId)}`)
    expect(rowListResponse.status()).toBe(200)
    const rowDefs = await rowListResponse.json()
    expect(rowDefs.some((row: { _id?: string }) => row._id === createdRow._id)).toBe(true)

    const entryPayload = {
      month: '2026-05',
      type: 'variable',
      category: 'variable',
      label: 'Exam materials',
      amount: 450,
      owner: userId,
    }

    const createEntryResponse = await request.post('/api/budget-entries', {
      data: entryPayload,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(createEntryResponse.status()).toBe(201)

    const createdEntry = await createEntryResponse.json()
    expect(createdEntry._id).toBeTruthy()

    const updateEntryResponse = await request.put(`/api/budget-entries/${createdEntry._id}`, {
      data: {
        amount: 575,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(updateEntryResponse.status()).toBe(200)

    const updatedEntry = await updateEntryResponse.json()
    expect(updatedEntry.amount).toBe(575)

    const entryListResponse = await request.get(
      `/api/budget-entries?owner=${encodeURIComponent(userId)}&month=2026-05&type=variable`,
    )
    expect(entryListResponse.status()).toBe(200)
    const entries = await entryListResponse.json()
    expect(entries.some((entry: { _id?: string; amount?: number }) => entry._id === createdEntry._id && entry.amount === 575)).toBe(true)

    const deleteEntryResponse = await request.delete(`/api/budget-entries/${createdEntry._id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(deleteEntryResponse.status()).toBe(200)

    const deleteRowResponse = await request.delete(`/api/budget-row-defs/${createdRow._id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(deleteRowResponse.status()).toBe(200)
  })
}
