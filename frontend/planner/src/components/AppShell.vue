<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuth } from '../auth'

type SectionKey = 'calendar' | 'board' | 'budget' | 'notes'

const props = defineProps<{
  activeSection: SectionKey
  eyebrow: string
  title: string
}>()

const router = useRouter()
const { user, initials, logout } = useAuth()

const sections: Array<{ key: SectionKey; label: string; to: string }> = [
  { key: 'calendar', label: 'Calendar', to: '/calendar' },
  { key: 'board', label: 'Board', to: '/board' },
  { key: 'budget', label: 'Budget', to: '/budget' },
  { key: 'notes', label: 'Notes', to: '/notes' },
]

const currentUserName = computed(() => user.value?.name ?? 'Planix User')

function handleLogout() {
  logout()
  void router.push('/login')
}
</script>

<template>
  <main class="DashboardPage DashboardPage--app">
    <aside class="CalendarSidebar">
      <div class="CalendarSidebar__brand">
        <p>Planix</p>
        <span>Personal workspace</span>
      </div>

      <nav class="CalendarSidebar__nav">
        <RouterLink
          v-for="section in sections"
          :key="section.key"
          class="CalendarSidebar__link"
          :class="{ 'CalendarSidebar__link--active': activeSection === section.key }"
          :to="section.to"
        >
          {{ section.label }}
        </RouterLink>
      </nav>

      <slot name="sidebar" />
    </aside>

    <section class="CalendarWorkspace">
      <header class="CalendarWorkspace__topbar">
        <div>
          <span class="CalendarWorkspace__eyebrow">{{ eyebrow }}</span>
          <h1>{{ title }}</h1>
        </div>

        <div class="CalendarWorkspace__actions">
          <slot name="topbar-actions" />
          <div class="CalendarWorkspace__user">
            <span class="CalendarWorkspace__userMeta">{{ currentUserName }}</span>
            <span class="CalendarWorkspace__userAvatar">{{ initials }}</span>
          </div>
          <button class="CalendarWorkspace__logout" type="button" @click="handleLogout">Log out</button>
        </div>
      </header>

      <slot />
    </section>
  </main>
</template>
