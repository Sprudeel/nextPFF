// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
    nitro: { preset: 'static' },
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      gitSha: process.env.GIT_COMMIT_SHA || '',
      repoUrl: process.env.REPO_URL || `https://github.com/${process.env.GITHUB_REPOSITORY || ''}`,
      authorName: process.env.AUTHOR_NAME || 'Sprudel'
    }
  },
  app: {
    baseURL: '',
  },
})
