import { computed, reactive } from 'vue'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api'
const storageKey = 'planix-auth-session'

type StoredSession = {
  id: string
  email: string
  name: string
  token: string
}

type LoginResponse = {
  error: string | null
  data?: {
    userId: string
    token: string
  }
}

const savedSession = (() => {
  const raw = localStorage.getItem(storageKey)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    localStorage.removeItem(storageKey)
    return null
  }
})()

const state = reactive<{
  session: StoredSession | null
}>({
  session: savedSession,
})

function persistSession(session: StoredSession | null) {
  if (!session) {
    localStorage.removeItem(storageKey)
    return
  }

  localStorage.setItem(storageKey, JSON.stringify(session))
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

async function fetchLogin(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const payload = await parseJson<LoginResponse>(response)

  if (!response.ok || !payload?.data?.token || !payload.data.userId) {
    throw new Error(payload?.error ?? 'Unable to log in.')
  }

  return {
    userId: payload.data.userId,
    token: payload.data.token,
  }
}

export function useAuth() {
  const user = computed(() => state.session)
  const isAuthenticated = computed(() => state.session !== null)
  const initials = computed(() => {
    if (!state.session) {
      return ''
    }

    return state.session.name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase()
  })

  async function login(email: string, password: string) {
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedPassword) {
      throw new Error('Email and password are required.')
    }

    const { userId, token } = await fetchLogin(trimmedEmail, trimmedPassword)
    const inferredName = trimmedEmail.split('@')[0] ?? 'Planix User'

    const session = {
      id: userId,
      email: trimmedEmail,
      name: inferredName
        .split(/[._-]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      token,
    }

    state.session = session
    persistSession(session)
  }

  async function register(name: string, email: string, password: string) {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      throw new Error('Username, email, and password are required.')
    }

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
      }),
    })

    const payload = await parseJson<{ error?: string }>(response)

    if (!response.ok) {
      throw new Error(payload?.error ?? 'Unable to register.')
    }

    await login(trimmedEmail, trimmedPassword)
  }

  function logout() {
    state.session = null
    persistSession(null)
  }

  return {
    user,
    isAuthenticated,
    initials,
    login,
    register,
    logout,
  }
}
