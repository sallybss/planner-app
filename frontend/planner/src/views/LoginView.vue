<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthHeroPanel from '../components/AuthHeroPanel.vue'
import { useAuth } from '../auth'

const router = useRouter()
const { login } = useAuth()

const form = reactive({
  email: '',
  password: '',
})

const errorMessage = ref('')
const isSubmitting = ref(false)

async function submitForm() {
  try {
    errorMessage.value = ''
    isSubmitting.value = true
    await login(form.email, form.password)
    void router.push('/calendar')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to sign in.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="AuthPage">
    <AuthHeroPanel />

    <section class="AuthPanel">
      <div class="AuthCard">
        <div class="AuthCard__header">
          <span class="AuthCard__kicker">Account Access</span>
          <h2>Welcome back</h2>
          <p>Log in to open your planning dashboard and continue where you left off.</p>
        </div>

        <form class="AuthForm" @submit.prevent="submitForm">
          <label class="AuthField">
            <span>Email</span>
            <input v-model="form.email" type="email" placeholder="you@example.com" />
          </label>

          <label class="AuthField">
            <span>Password</span>
            <input v-model="form.password" type="password" placeholder="Enter your password" />
          </label>

          <p v-if="errorMessage" class="AuthForm__error">{{ errorMessage }}</p>

          <button class="AuthForm__submit" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? 'Logging in...' : 'Login' }}
          </button>
        </form>

        <div class="AuthCard__footer">
          <p class="AuthCard__footerLink">
            Don&apos;t have an account?
            <RouterLink to="/register">Register</RouterLink>
          </p>
        </div>
      </div>
    </section>
  </main>
</template>
