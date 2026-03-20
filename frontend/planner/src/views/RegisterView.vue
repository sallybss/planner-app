<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthHeroPanel from '../components/AuthHeroPanel.vue'
import { useAuth } from '../auth'

const router = useRouter()
const { register } = useAuth()

const form = reactive({
  name: '',
  email: '',
  password: '',
})

const errorMessage = ref('')
const isSubmitting = ref(false)

async function submitForm() {
  try {
    errorMessage.value = ''
    isSubmitting.value = true
    await register(form.name, form.email, form.password)
    void router.push('/calendar')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to register.'
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
          <span class="AuthCard__kicker">Create Account</span>
          <h2>Register</h2>
          <p>Set up your Planix account to enter your dashboard.</p>
        </div>

        <form class="AuthForm" @submit.prevent="submitForm">
          <label class="AuthField">
            <span>Username</span>
            <input v-model="form.name" type="text" placeholder="Choose a username" />
          </label>

          <label class="AuthField">
            <span>Email</span>
            <input v-model="form.email" type="email" placeholder="you@example.com" />
          </label>

          <label class="AuthField">
            <span>Password</span>
            <input v-model="form.password" type="password" placeholder="Create a password" />
          </label>

          <p v-if="errorMessage" class="AuthForm__error">{{ errorMessage }}</p>

          <button class="AuthForm__submit" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? 'Creating account...' : 'Create account' }}
          </button>
        </form>

        <div class="AuthCard__footer">
          <p class="AuthCard__footerLink">
            Already have an account?
            <RouterLink to="/login">Log in</RouterLink>
          </p>
        </div>
      </div>
    </section>
  </main>
</template>
