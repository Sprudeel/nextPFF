import { defineCronHandler } from "#nuxt/cron";
import { useRuntimeConfig } from '#imports'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

type WhoIsRecord = {
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

type WhoIsFile = {
    scannedAt: string
    domains: WhoIsRecord[]
}

const OUTPUT = 'public/whois.json'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithTimeout(
    url: string,
    opts: RequestInit & { timeoutMs?: number }
) {
    const { timeoutMs = 5000, ...init } = opts;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { redirect: 'follow', ...init, signal: controller.signal });
    } catch (error) {
        throw error;
    } finally {
        clearTimeout(id);
    }
}

async function isRegistered(domain: string): Promise<boolean> {
    const rdap = `https://rdap.nic.ch/domain/${encodeURIComponent(domain)}`;
    try {
        const res = await fetchWithTimeout(rdap, { method: 'HEAD', timeoutMs: 5000 });
        if(res.status === 200) {
            return true; // Domain is registered
        }
        if(res.status === 404) {
            return false; // Domain is available
        }
        if(res.status === 429) {
            await sleep(2000); // Wait before retrying
            const retry = await fetchWithTimeout(rdap, { method: 'HEAD', timeoutMs: 5000 });
            return retry.status == 200 || retry.status == 404; // Retry
        }

        return false
    } catch {
        return false
    }
}

async function checkWebsitePresence(domain: string): Promise<{
    present: boolean
    protocol?: 'https' | 'http'
    status?: number
    urlTried?: string
    error?: string
}> {
    const tryOnce = async (proto: 'https' | 'http') => {
        const url = `${proto}://${domain}`;
        try {
            let res = await fetchWithTimeout(url, { method: 'HEAD', timeoutMs: 5000 });

            if(res.status === 405 || res.status === 403) { // HEAD not allowed, try GET
                res = await fetchWithTimeout(url, { method: 'GET', timeoutMs: 5000 });
            }
            const ok = res.status >= 200 && res.status < 400;
            return { present: ok, protocol: proto, status: res.status, urlTried: url } as const;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return { present: false, error: 'timeout', urlTried: url } as const;
            }
            return { present: false, error: error.message, urlTried: url } as const;
        }
    }

    const httpsResult = await tryOnce('https');
    if(httpsResult.present) return httpsResult;

    const httpResult = await tryOnce('http');
    if(httpResult.present) return httpResult;

    const best = httpsResult.status ? httpsResult : httpResult;
    return best.present ? best : { present: false, error: 'not reachable' };
}

async function loadDomains(): Promise<string[]> {
    const config = useRuntimeConfig();
    const rc: any = (config as any).whois || {};
    if(Array.isArray(rc.domains) && rc.domains.length > 0) {
        return rc.domains;
    }
    if(typeof rc.domainsFile === 'string' && rc.domainsFile.length > 0) {
        const path = resolve(process.cwd(), rc.domainsFile);
        try {
            const raw = await readFile(path, 'utf8');
            const parsed = JSON.parse(raw);
            if(Array.isArray(parsed)) {
                return parsed.filter((d) => typeof d === 'string' && d.length > 0);
            }
        } catch {
            return [];
        }
    }
    return [];
}

async function writeJSONPretty(absPath: string, data: unknown) {
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, JSON.stringify(data, null, 2), 'utf8');
}

export default defineCronHandler("daily", async () => {
    const cfg = useRuntimeConfig();
    const outPathRel = (cfg as any).whois?.outputFile || OUTPUT;
    const outPath = resolve(process.cwd(), outPathRel);

    const domains = await loadDomains();
    const results: WhoIsRecord[] = [];

    for (const domain of domains) {
        const tld = domain.split('.').slice(-1)[0]?.toLowerCase() || '';
        const registered = await isRegistered(domain);
        let website = {present: false};
        if (registered) {
            website = await checkWebsitePresence(domain);
        }
        results.push({
            domain,
            tld,
            registered,
            website,
            checkedAt: (new Date()).toISOString()
        });

        await sleep(150)
    }

    const payload: WhoIsFile = {
        scannedAt: (new Date()).toISOString(),
        domains: results
    }

    await writeJSONPretty(outPath, payload);
});