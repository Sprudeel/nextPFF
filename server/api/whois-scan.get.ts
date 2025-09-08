import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { H3Event } from 'h3'

type WhoisRecord = {
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
    domains: WhoisRecord[]
}

export default defineEventHandler(async (_event: H3Event) => {
    const cfg = useRuntimeConfig()
    const fileRel = (cfg as any).whois?.outputFile || 'public/whois.json'
    const fileAbs = resolve(process.cwd(), fileRel)
    try {
        const raw = await readFile(fileAbs, 'utf8')
        return JSON.parse(raw) as WhoisScanFile
    } catch (e) {
        return <WhoisScanFile>{
            scannedAt: new Date().toISOString(),
            domains: []
        }
    }
})