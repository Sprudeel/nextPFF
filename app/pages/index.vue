<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watchEffect } from 'vue'
import { useHead, useRuntimeConfig, useFetch } from '#imports'
import { useTheme } from '~/composables/useTheme'
import { Sun, Moon, History, Github, GitCommit, CheckCircle, XCircle, Globe, AlertCircle } from 'lucide-vue-next'

type Lang = 'en' | 'de' | 'fr'

type WhoisScanEntry = {
  domain: string
  registered: boolean
  website: {
    present: boolean
    url?: string
  }
  checkedAt: string
}

type WhoisScanFile = {
  scannedAt: string
  domains: WhoisScanEntry[]
}

const { isDark, toggleTheme } = useTheme()

const dict = {
  en: {
    siteTitle: 'Is there a PFF in 20XX?',
    siteTagline: 'Live overview of which PFF domains are registered and whether a website is available.',
    registered: 'Registered',
    notRegistered: 'Available',
    websitePresent: 'Website Online',
    websiteAbsent: 'No Website',
    lastChecked: 'Last checked',
    noResults: 'No domains found.',
    footerBy: 'by',
    repo: 'Repository',
    viewHistory: 'History',
    legend: 'Status Legend',
  },
  de: {
    siteTitle: 'Gits im 20XX es PFF?',
    siteTagline: 'Aktuelle Übersicht welche PFF Domains registriert sind und ob eine Website vorhanden ist.',
    registered: 'Registriert',
    notRegistered: 'Verfügbar',
    websitePresent: 'Website Online',
    websiteAbsent: 'Keine Website',
    lastChecked: 'Zuletzt geprüft',
    noResults: 'Keine Domains gefunden.',
    footerBy: 'von',
    repo: 'Repository',
    viewHistory: 'Historie',
    legend: 'Status Legende',
  },
  fr: {
    siteTitle: 'Y a-t-il un PFF en 20XX ?',
    siteTagline: "Aperçu en direct des domaines PFF enregistrés et de la présence éventuelle d'un site web.",
    registered: 'Enregistré',
    notRegistered: 'Disponible',
    websitePresent: 'Site en ligne',
    websiteAbsent: 'Pas de site',
    lastChecked: 'Dernière vérification',
    noResults: 'Aucun domaine.',
    footerBy: 'par',
    repo: 'Repository',
    viewHistory: 'Historique',
    legend: 'Légende des statuts',
  },
} as const

const lang = ref<Lang>('de')
const t = computed(() => dict[lang.value])

useHead(() => ({
  title: t.value.siteTitle,
  meta: [{ name: 'description', content: 'Live overview of which PFF domains are registered.' }]
}))

const { data, refresh, pending, error } = useFetch<WhoisScanFile>('/whois.json', {
  server: false,
  immediate: true,
  default: () => ({ scannedAt: '', domains: [] })
})

const domains = computed(() => data.value?.domains ?? [])

watchEffect(() => {
  if (!pending.value && (data.value?.domains?.length ?? 0) === 0) {
    refresh()
  }
})

const cfg = useRuntimeConfig()
const gitSha = computed(() => cfg.public.gitSha || 'dev')
const author = computed(() => cfg.public.authorName || 'Sprudel')

let interval: any
onMounted(() => { interval = setInterval(() => refresh(), 60000) })
onUnmounted(() => clearInterval(interval))
</script>

<template>
  <div class="page" :class="{ 'page--light': !isDark }">
    <!-- Nav -->
    <nav class="nav">
      <div class="nav__left">
        <div class="lang-group">
          <button
            v-for="l in ['en', 'de', 'fr']"
            :key="l"
            class="lang-btn"
            :class="{ 'lang-btn--active': lang === l }"
            @click="lang = l as Lang"
          >{{ l.toUpperCase() }}</button>
        </div>
      </div>
      <div class="nav__right">
        <NuxtLink to="/history" class="icon-btn" :title="t.viewHistory">
          <History :size="20" />
        </NuxtLink>
        <button class="icon-btn" @click="toggleTheme" :title="isDark ? 'Light mode' : 'Dark mode'">
          <Transition name="fade" mode="out-in">
            <Sun v-if="isDark" :size="20" />
            <Moon v-else :size="20" />
          </Transition>
        </button>
      </div>
    </nav>

    <!-- Hero -->
    <header class="hero">
      <h1 class="hero__title">{{ t.siteTitle }}</h1>
      <p class="hero__tagline">{{ t.siteTagline }}</p>
    </header>

    <!-- Legend -->
    <div class="legend">
      <h3 class="legend__title">{{ t.legend }}</h3>
      <div class="legend__items">
        <div class="legend__item" :title="t.registered">
          <CheckCircle :size="16" class="icon--success" />
          <span>{{ t.registered }}</span>
        </div>
        <div class="legend__item" :title="t.notRegistered">
          <XCircle :size="16" class="icon--danger" />
          <span>{{ t.notRegistered }}</span>
        </div>
        <div class="legend__item" :title="t.websitePresent">
          <Globe :size="16" class="icon--info" />
          <span>{{ t.websitePresent }}</span>
        </div>
      </div>
    </div>

    <!-- Loading/Error -->
    <div v-if="pending" class="status status--loading">Loading…</div>
    <div v-else-if="error" class="status status--error">
      <AlertCircle :size="20" />
      <span>{{ (error as any)?.message || error }}</span>
    </div>

    <!-- Domain Grid -->
    <section class="grid">
      <article v-for="d in domains" :key="d.domain" class="card" :class="{ 'card--active': d.registered }">
        <div class="card__header">
          <h2 class="card__domain">
            <a v-if="d.website.present && d.website.url" :href="d.website.url" class="card__link" target="_blank">
              {{ d.domain }}
            </a>
            <span v-else>{{ d.domain }}</span>
          </h2>
          <div class="card__status">
            <div class="status-icon" :title="d.registered ? t.registered : t.notRegistered">
              <CheckCircle v-if="d.registered" :size="18" class="icon--success" />
              <XCircle v-else :size="18" class="icon--danger" />
            </div>
            <div class="status-icon" :title="d.website.present ? t.websitePresent : t.websiteAbsent">
              <Globe :size="18" :class="d.website.present ? 'icon--info' : 'icon--muted'" />
            </div>
          </div>
        </div>
        <time class="card__time" :datetime="d.checkedAt">Checked: {{ new Date(d.checkedAt).toLocaleDateString() }}</time>
      </article>
    </section>

    <p v-if="!pending && !domains.length" class="empty">{{ t.noResults }}</p>

    <!-- Footer -->
    <footer class="footer">
      <a class="footer__link" href="https://github.com/Sprudeel/nextpff" target="_blank">
        <Github :size="16" />
        <span>{{ t.repo }}</span>
      </a>
      <span class="footer__sep">·</span>
      <span>{{ t.footerBy }} {{ author }}</span>
      <span class="footer__sep">·</span>
      <div class="footer__meta" title="Build SHA">
        <GitCommit :size="14" />
        <code class="footer__sha">{{ gitSha.slice(0, 7) }}</code>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Modern Palette */
.page {
  --bg: #0f172a;
  --bg-card: #1e293b;
  --bg-hover: #334155;
  --text: #f8fafc;
  --text-muted: #94a3b8;
  --border: #334155;
  --primary: #38bdf8;
  --success: #4ade80;
  --danger: #f87171;
}

.page--light {
  --bg: #ffffff;
  --bg-card: #f8fafc;
  --bg-hover: #f1f5f9;
  --text: #0f172a;
  --text-muted: #64748b;
  --border: #e2e8f0;
  --primary: #0ea5e9;
  --success: #22c55e;
  --danger: #ef4444;
}

.page {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  padding: 24px;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Nav */
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1000px;
  margin: 0 auto 48px;
}

.nav__left, .nav__right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.lang-group {
  display: flex;
  background: var(--bg-card);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.lang-btn {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.lang-btn:hover {
  color: var(--text);
}

.lang-btn--active {
  background: var(--bg-hover);
  color: var(--primary);
}

.icon-btn {
  padding: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-1px);
}

/* Hero */
.hero {
  text-align: center;
  margin-bottom: 48px;
}

.hero__title {
  font-size: 42px;
  font-weight: 800;
  margin: 0 0 16px;
  background: linear-gradient(to right, var(--primary), var(--success));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -1px;
}

.hero__tagline {
  font-size: 18px;
  color: var(--text-muted);
  max-width: 500px;
  margin: 0 auto;
  line-height: 1.6;
}

/* Legend */
.legend {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
}

.legend__title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin: 0;
}

.legend__items {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
}

.legend__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

/* Card */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.2);
}

.card--active {
  border-left: 3px solid var(--success);
}

.card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card__domain {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
}

.card__link {
  color: var(--text);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s;
}

.card__link:hover {
  color: var(--primary);
}

.card__status {
  display: flex;
  gap: 8px;
}

.status-icon {
  display: flex;
  align-items: center;
}

.icon--success { color: var(--success); }
.icon--danger { color: var(--danger); }
.icon--info { color: var(--primary); }
.icon--muted { color: var(--text-muted); opacity: 0.3; }

.card__time {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
}

/* Footer */
.footer {
  margin-top: 64px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 13px;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
}

.footer__link {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.footer__link:hover {
  color: var(--primary);
}

.footer__meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer__sha {
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

/* Status Messages */
.status {
  text-align: center;
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
}
.status--error {
  color: var(--danger);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
