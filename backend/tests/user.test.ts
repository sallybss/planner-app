import { test, expect } from '@playwright/test'

export default function userTestCollection() {
  test('Valid user registration info', async ({ request }) => {
    test.setTimeout(10_000)

    const user = {
      name: 'Sali Bseso',
      email: `sali.${Date.now()}@example.com`,
      password: '123456',
    }

    const response = await request.post('/api/auth/register', { data: user })
    const json = await response.json()

    expect(response.status()).toBe(201)
    expect(json.error).toEqual(null)
  })

  test('Invalid user registration info', async ({ request }) => {
    test.setTimeout(10_000)

    const user = {
      name: 'Sali Bseso',
      email: `sali.invalid.${Date.now()}@example.com`,
      password: '1234',
    }

    const response = await request.post('/api/auth/register', { data: user })
    const json = await response.json()

    expect(response.status()).toBe(400)
    expect(json.error).toEqual('"password" length must be at least 6 characters long')
  })

  test('Valid user login info', async ({ request }) => {
    test.setTimeout(10_000)

    const user = {
      name: 'Sali Bseso',
      email: `sali.login.${Date.now()}@example.com`,
      password: '123456',
    }

    const registerResponse = await request.post('/api/auth/register', { data: user })
    expect(registerResponse.status()).toBe(201)

    const response = await request.post('/api/auth/login', {
      data: {
        email: user.email,
        password: user.password,
      },
    })
    const json = await response.json()

    expect(response.status()).toBe(200)
    expect(json.error).toEqual(null)
    expect(json.data.token).toBeTruthy()
    expect(json.data.userId).toBeTruthy()
  })
}
