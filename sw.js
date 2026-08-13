const CACHE="suh-sales-pro-full-v62";
const ASSETS=["./","index.html","styles.css","app.js","manifest.webmanifest","icon.svg","assets/suh-final-logo.png","assets/jszip.min.js","assets/suh-blue-stamp.png","assets/suh-watermark.png","product_import_template.xlsx"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match("./")))));
