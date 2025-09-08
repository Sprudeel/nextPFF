// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['nuxt-cron'],
  devtools: { enabled: false },
  cron: {
    runOnInit: true,
    timeZone: 'Europe/Zurich',
    jobsDir: 'cron'
  },
    runtimeConfig: {
        whois: {
        domains: ['pff26.ch', 'pff27.ch', 'pff28.ch', 'pff29.ch', 'pff30.ch', 'pff31.ch', 'pff32.ch', 'pff33.ch', 'pff34.ch', 'pff35.ch', 'pff36.ch'],
        },
        public: {
            gitSha: process.env.GIT_COMMIT_SHA || '',
            repoUrl: process.env.REPO_URL || 'https://github.com/Sprudeel/nextPFF',
            authorName: process.env.AUTHOR_NAME || 'Sprudel'
        }
    }
})
