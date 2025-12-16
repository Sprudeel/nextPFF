import { readFile, writeFile, mkdir, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { resolve, dirname } from "path";
import 'dotenv/config';
import OpenAI from "openai";
const client = new OpenAI();



const DOMAINS_TXT = process.env.DOMAINS_FILE || "domains.txt";
const OUTPUT = process.env.OUTPUT_FILE || "public/whois.json";
const HISTORY_FILE = process.env.HISTORY_FILE || "public/history.json";

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
    const html = await fetch(`http://${domain}/`, { method: "GET", redirect: "manual" })
        .then((r) => r.text())
        .catch(() => null);


    const response = await client.responses.create({
        model: "gpt-5-nano",
        input: "only answer with Yes or No. Does the following HTML content indicate that the website is from a hosting company and not for the PFF (a scout organized festival) Popular Hosting Companies include: Hostpoint, Hoststar and many more? " + html,
    });
    const answer = response.output_text;

    let usesHttps = false;
    try {
        const httpsRes = await fetch(`https://${domain}/`, { method: "HEAD", redirect: "manual" });
        usesHttps = httpsRes.ok || httpsRes.status === 301 || httpsRes.status === 302;
    } catch {
        usesHttps = false;
    }

    console.log(`[check] ${domain} -> ${answer} (https: ${usesHttps})`);


    if (answer === 'Yes') {
        return { present: false };
    } else if (answer === 'No' && usesHttps) {
        return { present: true, url: `https://${domain}` };
    } else {
        return { present: false };
    }
}

async function main() {
    const domains = await loadDomains();
    const results = [];

    for (const domain of domains) {
        const checkedAt = new Date().toISOString();
        const registered = await isRegistered(domain);
        let website = { present: false };
        if (registered) website = await checkWebsite(domain);
        results.push({ domain, registered, website, checkedAt });
        await sleep(150); // throttle requests to be polite
    }

    const payload = { scannedAt: new Date().toISOString(), domains: results };

    const outAbs = resolve(process.cwd(), OUTPUT);
    await mkdir(dirname(outAbs), { recursive: true });
    await writeFile(outAbs, JSON.stringify(payload, null, 2), "utf8");
    console.log(`[scan] wrote ${results.length} entries → ${OUTPUT}`);

    // Update history.json with status change events
    const historyAbs = resolve(process.cwd(), HISTORY_FILE);
    let history = { events: [], lastState: {} };
    if (await fileExists(historyAbs)) {
        try {
            const raw = await readFile(historyAbs, "utf8");
            history = JSON.parse(raw);
            if (!Array.isArray(history.events)) history.events = [];
            if (!history.lastState || typeof history.lastState !== 'object') history.lastState = {};
        } catch {
            history = { events: [], lastState: {} };
        }
    }

    // Status Hierarchy:
    // 1. available (Not registered)
    // 2. registered (Registered, no website)
    // 3. website (Registered + Website)

    const now = new Date().toISOString();
    let newEvents = 0;

    for (const entry of results) {
        const domain = entry.domain;

        // Determine current status
        let currentStatus = 'available';
        if (entry.registered) {
            currentStatus = entry.website.present ? 'website' : 'registered';
        }

        const prevStatus = history.lastState[domain]?.status;

        // Record event if status changed or if it's the first time seeing this domain
        if (currentStatus !== prevStatus) {
            history.events.push({
                date: now,
                domain,
                status: currentStatus,
                previousStatus: prevStatus || null
            });
            newEvents++;
        }

        // Update last state
        history.lastState[domain] = { status: currentStatus };
    }

    // Keep only last 365 days of events
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    history.events = history.events.filter((event) => {
        const eventDate = new Date(event.date);
        return eventDate >= cutoff;
    });

    await writeFile(historyAbs, JSON.stringify(history, null, 2), "utf8");
    console.log(`[scan] updated history → ${HISTORY_FILE} (${newEvents} new events, ${history.events.length} total)`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});