<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watchEffect } from 'vue'
import { useHead, useRuntimeConfig, useFetch } from '#imports'

type Lang = 'en' | 'de' | 'fr'

type WhoisScanEntry = {
  domain: string
  tld: string
  registered: boolean
  website: {
    present: boolean
    protocol?: 'https' | 'http'
    status?: number
    urlTried?: string
    error?: string
  }
  checkedAt: string
}

type WhoisScanFile = {
  scannedAt: string
  domains: WhoisScanEntry[]
}

const dict = {
  en: {
    siteTitle: 'Is there a PFF in 20XX?',
    siteTagline:
        'Live overview of which PFF domains are registered and whether a website is available.',
    registered: 'Registered',
    notRegistered: 'Not registered',
    websitePresent: 'Website present',
    websiteAbsent: 'No website',
    protocol: 'Protocol',
    status: 'Status',
    lastChecked: 'Last checked',
    lastScan: 'Last scan',
    noResults: 'No domains found.',
    tableDomain: 'Domain',
    tableReg: 'Reg.',
    tableWeb: 'Website',
    tableProto: 'Proto',
    tableCode: 'Code',
    tableChecked: 'Checked',
    footerBy: 'by',
    repo: 'Repository'
  },
  de: {
    siteTitle: 'Gits im 20XX es PFF?',
    siteTagline:
        'Aktuelle Übersicht welche PFF Domains registriert sind und ob eine Website vorhanden ist.',
    registered: 'Registriert',
    notRegistered: 'Nicht registriert',
    websitePresent: 'Website vorhanden',
    websiteAbsent: 'Keine Website',
    protocol: 'Protokoll',
    status: 'Status',
    lastChecked: 'Zuletzt geprüft',
    lastScan: 'Letzter Scan',
    noResults: 'Keine Domains gefunden.',
    tableDomain: 'Domain',
    tableReg: 'Reg.',
    tableWeb: 'Website',
    tableProto: 'Proto',
    tableCode: 'Code',
    tableChecked: 'Geprüft',
    footerBy: 'von',
    repo: 'Repository'
  },
  fr: {
    siteTitle: 'Y a-t-il un PFF en 20XX ?',
    siteTagline:
        'Aperçu en direct des domaines PFF enregistrés et de la présence éventuelle d’un site web.',
    registered: 'Enregistré',
    notRegistered: 'Non enregistré',
    websitePresent: 'Site web présent',
    websiteAbsent: 'Pas de site web',
    protocol: 'Protocole',
    status: 'Statut',
    lastChecked: 'Dernière vérification',
    lastScan: 'Dernier scan',
    noResults: 'Aucun domaine.',
    tableDomain: 'Domaine',
    tableReg: 'Enr.',
    tableWeb: 'Site web',
    tableProto: 'Proto',
    tableCode: 'Code',
    tableChecked: 'Vérifié',
    footerBy: 'par',
    repo: 'Repository'
  },
} as const

const lang = ref<Lang>('de')
const t = computed(() => dict[lang.value])

useHead(() => ({
  title: t.value.siteTitle,
  meta: [
    {
      name: 'description',
      content:
          'Live overview of which PFF domains are registered and whether a website is available.'
    }
  ]
}))

const base = '/'
const jsonPath = base + 'whois.json'

const { data, refresh, pending, error } = useFetch<WhoisScanFile>(jsonPath, {
  server: false,
  immediate: true,
  default: () => ({ scannedAt: '', domains: [] })
})

const domains = computed(() => data.value?.domains ?? [])
const scannedAt = computed(() => data.value?.scannedAt ?? null)

watchEffect(() => {
  if (!pending.value && (data.value?.domains?.length ?? 0) === 0) {
    refresh()
  }
})

function badgeClass(ok: boolean) {
  return ok ? 'badge badge--ok' : 'badge badge--no'
}

function protoChip(p?: 'https' | 'http') {
  if (!p) return '—'
  return p === 'https' ? 'https' : 'http'
}

function statusText(s?: number) {
  return s ? String(s) : '—'
}

const cfg = useRuntimeConfig()
const gitSha = computed(() => cfg.public.gitSha || 'unknown')
const author = computed(() => cfg.public.authorName || 'Sprudel')
const repoUrl = computed(() => cfg.public.repoUrl || `https://github.com/${process.env.GITHUB_REPOSITORY || ''}`)

let interval: any
onMounted(() => {
  interval = setInterval(() => refresh(), 60000)
})
onUnmounted(() => clearInterval(interval))

</script>

<template>
  <div class="container">
    <div class="shell">
    <header class="hero">
      <div class="hero__top">
        <h1 class="hero__title">{{ t.siteTitle }}</h1>
        <div class="lang">
          <button
              v-for="l in ['en','de','fr']"
              :key="l"
              class="lang__btn"
              :class="{ 'lang__btn--active': lang === l }"
              @click="lang = l as Lang"
          >
            {{ l.toUpperCase() }}
          </button>
        </div>
      </div>
      <p class="hero__tagline">
        {{ t.siteTagline }}
      </p>
    </header>

      <div v-if="pending" class="pending">Loading…</div>
      <div v-else-if="error" class="error">{{ (error as any)?.message || error }}</div>
    <!-- Content -->
    <section class="grid">
      <article v-for="d in domains" :key="d.domain" class="card">
        <header class="card__header">
          <h2 v-if="d.website.present" class="card__title"> <a class="link" :href="d.website.urlTried">{{ d.domain }}</a> </h2>
          <h2 v-else class="card__title"> {{ d.domain }} </h2>
          <div class="chips">
            <span :class="['badge', d.registered ? 'badge--ok' : 'badge--no']">
              {{ d.registered ? t.registered : t.notRegistered }}
            </span>
            <span :class="['badge', d.website?.present ? 'badge--blue' : 'badge--gray']">
              {{ d.website?.present ? t.websitePresent : t.websiteAbsent }}
            </span>
          </div>
        </header>

        <div class="card__meta">
          <div class="meta__row">
            <span class="meta__label">{{ t.lastChecked + ": " }}</span>
            <span class="meta__value">
              <time :datetime="d.checkedAt">{{ new Date(d.checkedAt).toLocaleString() }}</time>
            </span>
          </div>
        </div>


      </article>
    </section>

    <p v-if="!domains.length" class="empty">{{ t.noResults }}</p>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer__left">
        <a class="link gh-link" href="https://github.com/Sprudeel/nextpff" target="_blank" rel="noopener noreferrer">
          <svg xmlns="http://www.w3.org/2000/svg" class="gh-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2.1c-3.2.7-3.9-1.5-3.9-1.5-.6-1.4-1.5-1.7-1.5-1.7-1.2-.8.1-.8.1-.8 1.3.1 2 1.4 2 1.4 1.2 2 3.2 1.4 3.9 1.1.1-.9.5-1.4.9-1.8-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.2 11.2 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 3 .1 3.3.7.9 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4 1 1.2 1 2.5v3.6c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.65 18.35.5 12 .5Z"/>
          </svg>
          <span>{{ t.repo }}: NextPFF</span>
        </a>
        <span>•</span>
        <span>
          Build:
          <a
              class="link"
              :href="'https://github.com/Sprudeel/nextPFF/commit/' + gitSha"
              target="_blank"
              rel="noopener noreferrer"
          >
            <code>{{ gitSha.slice(0, 8) }}</code>
          </a>
        </span>
      </div>
      <div class="footer__right">
        <span>{{ t.footerBy }} {{ author }}</span>
      </div>
    </footer>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');

:root {
  --bg: #0f1223;
  --card: #141838;
  --muted: #9aa0bd;
  --txt: #f5f7ff;
  --ok: #22c55e;
  --no: #ef4444;
  --blue: #38bdf8;
  --gray: #64748b;
  --line: rgba(255,255,255,0.08);
  --btn: #2a2f57;
  --btnHover: #343a6a;
  --chip: #1a2043;
}

.shell {
  max-width: 1100px;
  margin: 0 auto;
}

.container {
  padding: 40px 24px 80px;
  line-height: 1.6;
}

.hero {
  text-align: center;
  margin-bottom: 24px;
}
.hero__top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 22px;
  align-items: stretch;
}

.card {
  padding: 18px;
}

.card__meta {
  font-size: 14px;
  margin-top: 12px;
}


.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.container {
  min-height: 100svh;
  padding: 24px 18px 64px;
  background: radial-gradient(1000px 500px at 20% -10%, #1a1f46, transparent 60%),
  radial-gradient(1000px 500px at 80% -10%, #122447, transparent 60%),
  var(--bg);
  color: var(--txt);
  font-family: 'JetBrains Mono', monospace;
}

.hero__title { font-size: 28px; font-weight: 600; }
.hero__tagline { margin-top: 8px; color: var(--muted); }

.lang__btn {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--chip);
  color: var(--txt);
  cursor: pointer;
}
.lang__btn--active {
  border-color: var(--blue);
  color: var(--blue);
}


.card {
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 14px;
  transition: transform 0.15s ease;
}
.card:hover {
  transform: translateY(-2px);
  border-color: var(--blue);
}

.badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--line);
}
.badge--ok { background: rgba(34,197,94,0.1); color: var(--ok); border-color: var(--ok); }
.badge--no { background: rgba(239,68,68,0.1); color: var(--no); border-color: var(--no); }
.badge--blue { background: rgba(56,189,248,0.1); color: var(--blue); border-color: var(--blue); }
.badge--gray { background: rgba(100,116,139,0.1); color: var(--gray); border-color: var(--gray); }

.link { color: var(--blue); }
.link:hover { text-decoration: underline; }

.gh-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.gh-icon {
  flex-shrink: 0;
}

.footer {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 13px;
}
.footer code { color: var(--blue); }

.footer__left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pending { color: var(--blue); text-align: center; margin: 8px 0 16px; }
.error { color: var(--no); text-align: center; margin: 8px 0 16px; }
</style>
