/**
 * Pre-caches MadLad NFT images locally so the frontend serves them from
 * public/images/ instead of hitting the CDN on every page load.
 *
 * Usage:  node scripts/cache-images.mjs
 *         node scripts/cache-images.mjs --force   (re-download even if present)
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'images');


const COLLECTION_SIZE = 80;
const CONCURRENCY = 6;
const FORCE = process.argv.includes('--force');

const cdnUrl = (id) =>
    `https://img-cdn.magiceden.dev/rs:fill:800:0:0/plain/` +
    `https%3A%2F%2Fmadlads.s3.us-west-2.amazonaws.com%2Fimages%2F${id}.png`;



async function fileExists(path) {
    return access(path)
        .then(() => true)
        .catch(() => false);
}

async function downloadOne(id) {
    const dest = join(OUT_DIR, `${id}.png`);

    if (!FORCE && (await fileExists(dest))) {
        process.stdout.write('.');
        return { id, status: 'skipped' };
    }

    const res = await fetch(cdnUrl(id));
    if (!res.ok) throw new Error(`HTTP ${res.status} for image ${id}`);

    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    process.stdout.write('↓');
    return { id, status: 'downloaded' };
}


async function pool(items, fn, concurrency) {
    const results = [];
    let i = 0;
    async function worker() {
        while (i < items.length) {
            const item = items[i++];
            results.push(await fn(item));
        }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
}



await mkdir(OUT_DIR, { recursive: true });

const ids = Array.from({ length: COLLECTION_SIZE }, (_, i) => i + 1);

console.log(
    `Caching ${COLLECTION_SIZE} MadLad images → public/images/\n` +
        `(↓ = downloaded, . = already cached, --force to re-download)\n`
);

const start = Date.now();
const results = await pool(ids, downloadOne, CONCURRENCY);

const downloaded = results.filter((r) => r.status === 'downloaded').length;
const skipped = results.filter((r) => r.status === 'skipped').length;
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log(
    `\n\nDone in ${elapsed}s — ${downloaded} downloaded, ${skipped} already cached.`
);
