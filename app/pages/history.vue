<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useHead, useFetch, useRuntimeConfig } from '#imports'
import { useTheme } from '~/composables/useTheme'
import { Chart, registerables } from 'chart.js'
import { ArrowLeft, Sun, Moon, Github, GitCommit, AlertCircle } from 'lucide-vue-next'

Chart.register(...registerables)

type Lang = 'en' | 'de' | 'fr'
type TimeRange = '7d' | '30d' | '90d' | 'all'

type HistoryEvent = {
  date: string
  domain: string
  status: 'available' | 'registered' | 'website'
}

type ChartPoint = {
  x: number
  y: number
  status: HistoryEvent['status']
}

type HistoryFile = {
  events: HistoryEvent[]
  lastState: Record<string, { status: string }>
}

const { isDark, toggleTheme } = useTheme()

const dict = {
  en: {
    siteTitle: 'PFF Domain History',
    siteTagline: 'Timeline of domain registration and website status changes.',
    backToHome: 'Back',
    noHistory: 'No history events yet. Run a scan to start tracking changes.',
    registered: 'Registered',
    available: 'Available',
    website: 'Website Online',
    events: 'events',
    footerBy: 'by',
    repo: 'Repository',
    all: 'All',
  },
  de: {
    siteTitle: 'PFF Domain Historie',
    siteTagline: 'Zeitverlauf der Domain-Registrierungen und Website-Status-Änderungen.',
    backToHome: 'Zurück',
    noHistory: 'Noch keine Ereignisse. Führe einen Scan durch um Änderungen zu tracken.',
    registered: 'Registriert',
    available: 'Verfügbar',
    website: 'Website Online',
    events: 'Ereignisse',
    footerBy: 'von',
    repo: 'Repository',
    all: 'Alle',
  },
  fr: {
    siteTitle: 'Historique des Domaines PFF',
    siteTagline: 'Chronologie des changements de statut des domaines.',
    backToHome: 'Retour',
    noHistory: 'Aucun événement. Lancez un scan pour commencer le suivi.',
    registered: 'Enregistré',
    available: 'Disponible',
    website: 'Site en ligne',
    events: 'événements',
    footerBy: 'par',
    repo: 'Repository',
    all: 'Tous',
  },
} as const

const lang = ref<Lang>('de')
const range = ref<TimeRange>('all')
const t = computed(() => dict[lang.value])

useHead(() => ({
  title: t.value.siteTitle,
  meta: [{ name: 'description', content: 'Timeline of PFF domain changes.' }]
}))

const cfg = useRuntimeConfig()
const gitSha = computed(() => cfg.public.gitSha || 'dev')
const author = computed(() => cfg.public.authorName || 'Sprudel')

const { data, pending, error } = useFetch<HistoryFile>('/history.json', {
  server: false,
  key: 'history-data',
  default: () => ({ events: [], lastState: {} })
})

onMounted(async () => {
  // Manual fallback fetch to ensure we get data
  if (!data.value?.events?.length) {
    console.log('Fetching manually...')
    try {
      const res = await $fetch<HistoryFile>('/history.json', { 
        query: { t: Date.now() } 
      })
      data.value = res
    } catch (e) {
      console.error('Manual fetch failed', e)
    }
  }
})

const allEvents = computed(() => data.value?.events ?? [])

// Clean color palette for statuses
const statusColors = {
  available: '#94a3b8',   // gray
  registered: '#4ade80',  // green
  website: '#38bdf8'      // blue
}

const statusLabels = computed(() => ({
  available: t.value.available,
  registered: t.value.registered,
  website: t.value.website
}))

// Get unique domains for chart
const domains = computed(() => {
  const set = new Set(allEvents.value.map(e => e.domain))
  return Array.from(set).sort()
})

// Chart
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

function buildChart() {
  if (!chartCanvas.value) return
  if (chartInstance) chartInstance.destroy()

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return
  if (allEvents.value.length === 0) return

  const now = new Date()
  
  // Calculate cutoff based on range
  let cutoff = new Date(0) // Default to 1970 for initialization
  
  if (range.value === 'all') {
    if (allEvents.value.length > 0) {
      // Find the earliest date across all events
      const minTime = Math.min(...allEvents.value.map(e => new Date(e.date).getTime()))
      cutoff = new Date(minTime)
    } else {
       // If no events, default to 24h ago so graph isn't empty/broken
       cutoff = new Date()
       cutoff.setDate(cutoff.getDate() - 1)
    }
  } else {
    cutoff = new Date()
    if (range.value === '7d') cutoff.setDate(now.getDate() - 7)
    if (range.value === '30d') cutoff.setDate(now.getDate() - 30)
    if (range.value === '90d') cutoff.setDate(now.getDate() - 90)
  }

  // Prepare datasets
  const datasets = domains.value.map((domain, idx) => {
    // Get all events for this domain
    const domainEvents = allEvents.value
      .filter(e => e.domain === domain)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (domainEvents.length === 0) return null



    // Create points
    const points: ChartPoint[] = []
    
    // 1. Map real events
    domainEvents.forEach(e => {
        points.push({
            x: new Date(e.date).getTime(),
            y: domain as any, // Use domain name for Category axis
            status: e.status
        })
    })

    // 2. Add "Today" point to extend the line
    if (points.length > 0) {
        const last = points[points.length - 1]
        points.push({
            x: now.getTime(),
            y: domain as any,
            status: last!.status
        })
    }

    // Filter points by cutoff
    const visiblePoints = points.filter(p => p.x >= cutoff.getTime())
    const prePoint = points.filter(p => p.x < cutoff.getTime()).pop()
    if (prePoint) {
        // Add a point exactly at cutoff with pre-status
        visiblePoints.unshift({
            x: cutoff.getTime(),
            y: domain as any,
            status: prePoint.status
        })
    }

    return {
      label: domain,
      data: visiblePoints,
      borderColor: '#94a3b8', 
      segment: {
        borderColor: (ctx: any) => {
             const status = ctx.p0.raw.status
             return statusColors[status as keyof typeof statusColors] || '#ccc'
        }
      },
      pointBackgroundColor: (ctx: any) => {
          const status = ctx.raw.status
          return statusColors[status as keyof typeof statusColors] || '#ccc'
      },
      pointRadius: 4,
      pointHoverRadius: 4, // Disable hover scaling
      borderWidth: 3,
      stepped: true,
      fill: false
    }
  }).filter(Boolean) as any[]

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { 
      // Ensure all domains are registered as labels so Y-axis knows the order
      labels: domains.value,
      datasets 
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'nearest',
        axis: 'x'
      },
      // Disable hover effects (handled by pointHoverRadius)
      hover: { },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false } // Keep tooltips for date info, unless user meant disable this too. Keeping for now as "info".
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          min: cutoff.getTime(),
          max: now.getTime(),
          offset: false,
          ticks: {
            callback: (value) => new Date(value as number).toLocaleDateString(),
            color: isDark.value ? '#94a3b8' : '#64748b',
            font: { family: "'Inter', sans-serif", size: 11 },
            maxRotation: 0,
            autoSkip: true
          },
          grid: {
            color: isDark.value ? '#334155' : '#e2e8f0',
          }
        },
        y: {
          type: 'category', // Key Change: Category Axis
          labels: domains.value,
          ticks: {
            color: isDark.value ? '#f8fafc' : '#0f172a',
            font: { family: "'JetBrains Mono', monospace", size: 12 }
          },
          grid: {
            color: isDark.value ? '#334155' : '#e2e8f0',
          }
        }
      }
    }
  })
}

watch([allEvents, isDark, range], () => {
  nextTick(() => buildChart())
}, { immediate: true })

onMounted(() => {
  nextTick(() => buildChart())
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<template>
  <div class="page" :class="{ 'page--light': !isDark }">
    <!-- Nav -->
    <nav class="nav">
      <div class="nav__left">
        <NuxtLink to="/" class="back-link">
          <ArrowLeft :size="18" />
          {{ t.backToHome }}
        </NuxtLink>
        <div class="sep"></div>
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

    <!-- Loading/Error -->
    <div v-if="pending" class="status status--loading">Loading…</div>
    <div v-else-if="error" class="status status--error">
      <AlertCircle :size="20" />
      {{ (error as any)?.message || error }}
    </div>

    <!-- Chart -->
    <section class="chart-section">
      <!-- Filters -->
      <div class="filters">
        <button 
          v-for="r in ['7d', '30d', '90d', 'all']" 
          :key="r"
          class="filter-btn"
          :class="{ 'filter-btn--active': range === r }"
          @click="range = r as TimeRange"
        >
          {{ r === 'all' ? t.all : r }}
        </button>
      </div>

      <div class="chart-container">
        <canvas ref="chartCanvas"></canvas>
        <p v-if="allEvents.length === 0" class="empty-chart">
          {{ t.noHistory }}
        </p>
      </div>
      
      <!-- Legend -->
      <div class="legend">
        <div class="legend__item">
          <span class="legend__dot" style="background: #94a3b8"></span>
          <span>{{ t.available }}</span>
        </div>
        <div class="legend__item">
          <span class="legend__dot" style="background: #4ade80"></span>
          <span>{{ t.registered }}</span>
        </div>
        <div class="legend__item">
          <span class="legend__dot" style="background: #38bdf8"></span>
          <span>{{ t.website }}</span>
        </div>
      </div>
    </section>

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
/* Page & Theme Variables */
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
  display: flex;
  flex-direction: column;
}

/* Nav */
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto 48px;
}

.nav__left, .nav__right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--primary);
}

.sep {
  width: 1px;
  height: 20px;
  background: var(--border);
}

.lang-group {
  display: flex;
  background: var(--bg-card);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.lang-btn {
  padding: 4px 10px;
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
  max-width: 600px;
  margin: 0 auto 40px;
}

.hero__title {
  font-size: 32px;
  font-weight: 800;
  margin: 0 0 12px;
  letter-spacing: -1px;
}

.hero__tagline {
  font-size: 16px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

/* Chart */
.chart-section {
  max-width: 1000px;
  width: 100%;
  margin: 0 auto 40px;
  padding: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  min-height: 60vh;
  display: flex;
  flex-direction: column;
}

.filters {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 24px;
}

.filter-btn {
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  border-color: var(--text-muted);
  color: var(--text);
}

.filter-btn--active {
  background: var(--bg-hover);
  border-color: var(--primary);
  color: var(--primary);
}

.chart-container {
  flex: 1;
  min-height: 500px;
  margin-bottom: 24px;
  position: relative;
}

.empty-chart {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-muted);
}

.legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.legend__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

/* Footer */
.footer {
  margin-top: auto;
  padding-top: 32px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 13px;
  max-width: 1000px;
  width: 100%;
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

.status {
  text-align: center;
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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
