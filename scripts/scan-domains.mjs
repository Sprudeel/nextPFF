import { readFile, writeFile, mkdir, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { resolve, dirname } from "path";

const DOMAINS_TXT = process.env.DOMAINS_FILE || "domains.txt";
const OUTPUT = process.env.OUTPUT_FILE || "public/whois.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fileExists(p) {
    try {
        await access(p, fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function loadDomains() {
    // Prefer domains.txt (one per line, allow comments with #)
    if (await fileExists(DOMAINS_TXT)) {
        const raw = await readFile(DOMAINS_TXT, "utf8");
        return raw
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#"));
    }
    if (process.env.DOMAINS) {
        return process.env.DOMAINS.split(",").map((s) => s.trim()).filter(Boolean);
    }
    // Fallback
    return ["pff25.ch"];
}

async function fetchWithTimeout(url, { method = "GET", timeoutMs = 8000 } = {}) {
    const ac = new AbortController();
    const id = setTimeout(() => ac.abort(), timeoutMs);
    try {
        return await fetch(url, { method, redirect: "follow", signal: ac.signal });
    } finally {
        clearTimeout(id);
    }
}

async function isRegistered(domain) {
    const rdap = `https://rdap.nic.ch/domain/${encodeURIComponent(domain)}`;
    try {
        let res = await fetchWithTimeout(rdap, { method: "HEAD", timeoutMs: 5000 });
        if (res.status === 429) {
            await sleep(1000);
            res = await fetchWithTimeout(rdap, { method: "HEAD", timeoutMs: 5000 });
        }
        if (res.status === 200 || res.status === 401) return true;
        if (res.status === 404) return false;
        return false;
    } catch {
        return false;
    }
}

async function checkWebsite(domain) {
    const tryOnce = async (proto) => {
        const url = `${proto}://${domain}/`;
        try {
            let res = await fetchWithTimeout(url, { method: "HEAD", timeoutMs: 6000 });
            if (res.status === 405 || res.status === 403) {
                res = await fetchWithTimeout(url, { method: "GET", timeoutMs: 8000 });
            }
            const ok = res.status >= 200 && res.status < 400;
            return {
                present: ok,
                protocol: proto,
                status: res.status,
                urlTried: url,
            };
        } catch (e) {
            return {
                present: false,
                error: String(e?.message || e),
                urlTried: url,
            };
        }
    };

    const https = await tryOnce("https");
    if (https.present) return https;
    const http = await tryOnce("http");
    if (http.present) return http;
    return https.status ? https : http;
}

async function main() {
    const domains = await loadDomains();
    const results = [];

    for (const domain of domains) {
        const tld = domain.split(".").slice(-1)[0]?.toLowerCase() || "";
        const checkedAt = new Date().toISOString();
        const registered = await isRegistered(domain);
        let website = { present: false };
        if (registered) website = await checkWebsite(domain);
        results.push({ domain, tld, registered, website, checkedAt });
        await sleep(150); // throttle requests to be polite
    }

    const payload = { scannedAt: new Date().toISOString(), domains: results };

    const outAbs = resolve(process.cwd(), OUTPUT);
    await mkdir(dirname(outAbs), { recursive: true });
    await writeFile(outAbs, JSON.stringify(payload, null, 2), "utf8");
    console.log(`[scan] wrote ${results.length} entries → ${OUTPUT}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});