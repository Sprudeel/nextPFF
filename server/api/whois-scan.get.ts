import { useStorage } from '#imports'

export default defineEventHandler(async () => {
    const storage = useStorage('data')
    return (await storage.getItem('whois-scan.json')) || { scannedAt: '', domains: [] }
})