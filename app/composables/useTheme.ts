import { ref, watch, onMounted, computed } from 'vue'

type Theme = 'dark' | 'light'

const theme = ref<Theme>('dark')

export function useTheme() {
    const isDark = computed(() => theme.value === 'dark')

    function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark'
    }

    function setTheme(newTheme: Theme) {
        theme.value = newTheme
    }

    // Persist to localStorage and apply to document
    watch(theme, (newTheme) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('theme', newTheme)
            document.documentElement.setAttribute('data-theme', newTheme)
        }
    }, { immediate: true })

    // Initialize from localStorage on mount
    onMounted(() => {
        const saved = localStorage.getItem('theme') as Theme | null
        if (saved) {
            theme.value = saved
        } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            theme.value = 'light'
        }
        document.documentElement.setAttribute('data-theme', theme.value)
    })

    return {
        theme,
        isDark,
        toggleTheme,
        setTheme
    }
}
