import { readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const distDirectory = resolve("dist");
const precacheUrls = [];

async function collectFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path);
    } else if (entry.name !== "sw.js") {
      precacheUrls.push(`./${relative(distDirectory, path).split(sep).join("/")}`);
    }
  }
}

await collectFiles(distDirectory);

const worker = `const CACHE_NAME = "song-starter-shell-v1";
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};
const INDEX_URL = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith("song-starter-shell-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(request) ?? await cache.match(INDEX_URL) ?? Response.error();
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
`;

await writeFile(join(distDirectory, "sw.js"), worker);
