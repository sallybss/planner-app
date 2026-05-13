import { expect, type APIRequestContext } from '@playwright/test'

export async function registerAndLogin(request: APIRequestContext, prefix: string) {
  const stamp = Date.now()
  const credentials = {
    name: 'Sali Bseso',
    email: `${prefix}.${stamp}@example.com`,
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

  return {
    token: loginJson.data.token as string,
    userId: loginJson.data.userId as string,
    credentials,
  }
}
