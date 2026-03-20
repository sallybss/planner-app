<script setup lang="ts">
const logoWhite = new URL('../../images/logo-white.svg', import.meta.url).href

const milestones = [
  'Sign in to your workspace',
  'Review this week at a glance',
  'Keep projects and events aligned',
]
</script>

<template>
  <section class="AuthHero">
    <div class="AuthHero__glow AuthHero__glow--top"></div>
    <div class="AuthHero__glow AuthHero__glow--bottom"></div>
    <div class="AuthHero__content">
      <div class="AuthHero__brand">
        <img class="AuthHero__brandLogo" :src="logoWhite" alt="Planix logo" />
        <strong>Planix</strong>
      </div>
      <h1>Plan the week with more clarity and less friction.</h1>
      <p>
        A calmer scheduling space for deadlines, meetings, and the next thing that actually matters.
      </p>
      <ul class="AuthHero__steps">
        <li v-for="(milestone, index) in milestones" :key="milestone">
          <span>{{ index + 1 }}</span>
          <p>{{ milestone }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
