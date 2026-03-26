import { test, expect } from '@playwright/test'

export default function eventTestCollection() {
  test('Event creation fails without auth token', async ({ request }) => {
    test.setTimeout(10_000)

    const eventPayload = {
      title: 'Unauthorized event',
      description: 'This request should be rejected',
      date: '2026-03-25T00:00:00.000Z',
      startTime: '14:00',
      endTime: '15:30',
      color: '#f2c7dc',
      category: 'Meeting',
      owner: 'fake-user-id',
    }

    const response = await request.post('/api/events', {
      data: eventPayload,
    })
    const json = await response.json()

    expect(response.status()).toBe(401)
    expect(json.error).toBe('Access Denied. Missing token.')
  })

  test('event created by an authenticated user can be fetched from that user list', async ({ request }) => {
    test.setTimeout(30_000)

    const stamp = Date.now()
    const credentials = {
      name: 'Sali Bseso',
      email: `sali.${stamp}@example.com`,
      password: '123456',
    }

    const registerResponse = await request.post('/api/auth/register', { data: credentials })
    expect(registerResponse.status()).toBe(201)

    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: credentials.email,
        password: credentials.password,
      },
    })
    expect(loginResponse.status()).toBe(200)

    const loginJson = await loginResponse.json()
    const token = loginJson.data.token
    const userId = loginJson.data.userId

    const eventPayload = {
      title: 'Design review',
      description: 'Check planner calendar interactions',
      date: '2026-03-25T00:00:00.000Z',
      startTime: '14:00',
      endTime: '15:30',
      color: '#f2c7dc',
      category: 'Meeting',
      owner: userId,
    }

    const createResponse = await request.post('/api/events', {
      data: eventPayload,
      headers: {
        'auth-token': token,
      },
    })
    expect(createResponse.status()).toBe(201)

    const createdEvent = await createResponse.json()
    expect(createdEvent._id).toBeTruthy()

    const listResponse = await request.get(`/api/events?owner=${encodeURIComponent(userId)}`)
    expect(listResponse.status()).toBe(200)

    const events = await listResponse.json()
    expect(events).toHaveLength(1)

    const storedEvent = events.find((event: { _id?: string }) => event._id === createdEvent._id)
    expect(storedEvent).toBeTruthy()
    expect(storedEvent.title).toBe(eventPayload.title)
    expect(storedEvent.description).toBe(eventPayload.description)
    expect(storedEvent.startTime).toBe(eventPayload.startTime)
    expect(storedEvent.endTime).toBe(eventPayload.endTime)
    expect(storedEvent.color).toBe(eventPayload.color)
    expect(storedEvent.category).toBe(eventPayload.category)
    expect(storedEvent.owner).toBe(userId)
  })
}
