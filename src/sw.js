const idb = require('./idb');

const messageRecieveHandler = new class {
  constructor() {
    self.addEventListener('message', this.recieve.bind(this));
  }
  recieve(event) {
    if (!event.data) {
      registration.getNotifications()
        .then(nl => nl.forEach(n => n.close()));
    } else {
      this.showActNotice(event.data);
    }
  }
  async showActNotice(act) {
    const badge = await cacheHandler.getImg("/favicon.ico");
    const icon = await cacheHandler.getImg("/img/logo72.png");
    const startDate = new Date(act.start);
    const h = String(startDate.getHours()).padStart(2, "0");
    const m = String(startDate.getMinutes()).padStart(2, "0");
    self.registration.showNotification(
      `${act.summary} (${h}:${m} ~)`,
      {
        badge,
        icon,
        renotify: false,
        silent: true,
        tag: "logoca",
        data: act.start,
        actions: [
          { action: "end", title: "end action" }
        ]
      }
    );
  }
}

const notificationClickHandler = new class {
  constructor() {
    addEventListener('notificationclick', this.click.bind(this));
  }
  click(e) {
    e.notification.close();
    const proc = (e.action === 'end') ? this.endAct.bind(this) : this.showPage;

    e.waitUntil(
      self.clients.matchAll({ type: "window" })
        .then(cl => cl.find(c => c.url == `${location.origin}/`))
        .then(client => proc(client, e))
    );
  }
  showPage(client) {
    if (client) {
      return client.focus();
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(`${location.origin}/`);
    }
  }
  async endAct(client, e) {
    if (client) {
      client.postMessage(null);
    } else {
      // save to indexedDB
      let toBeEndedAct;
      await idb.updateApp("doingAct", ({ key, value }) => {
        toBeEndedAct = { ...value };
        return { key, value: null };
      });
      toBeEndedAct.isSynced = false;
      toBeEndedAct.end = Date.now();
      const [h, m, s] = this.calcElapsedTime(toBeEndedAct.start, toBeEndedAct.end);
      const elapsedTime = `${h == 0 ? "" : h + "h"}${m}m`;
      await idb.updateApp("summaryToView", ({ key, value }) => {
        toBeEndedAct.summary = `${value} (${elapsedTime})`
        return { key, value: "" };
      });
      await idb.updateApp("descriptionToView", ({ key, value }) => {
        toBeEndedAct.description = value;
        return { key, value: "" };
      });
      return await idb.updateApp("doneActList", ({ key, value }) => {
        value.push(toBeEndedAct);
        return { key, value };
      });
    }
  }
  calcElapsedTime(start, end) {
    const elapsedTime = Math.floor((end - start) / 1000);
    const h = Math.floor(elapsedTime / (60 * 60));
    const m = Math.floor(elapsedTime / 60) % 60;
    const s = elapsedTime % 60;
    return [h, m, s];
  }

}

const cacheHandler = new class {
  cacheItems = [
    {
      version: "11",
      urls: [
        "/index.js",
      ]
    },
    {
      version: "9",
      urls: [
        "/",
        "/style.css"
      ]
    },
    {
      version: "1",
      urls: [
        "/favicon.ico",
        "/img/logo.svg",
        "/img/favicon.svg",
        "/img/logo72.png",
        "/img/logo192.png"
      ]
    },
  ];

  constructor() {
    self.addEventListener('install', this.addCache.bind(this));
    self.addEventListener('activate', this.removeCache.bind(this));
    self.addEventListener('fetch', this.proxy);
  }
  addCache(e) {
    e.waitUntil(
      Promise.all(
        this.cacheItems.map(item => {
          return caches.open(item.version).then(cache => {
            return Promise.all(
              item.urls.map(async url => {
                if (await cache.match(url)) {
                  return Promise.resolve();
                } else {
                  return cache.add(url);
                }
              })
            )
          })
        })
      )
    );
  }
  removeCache(e) {
    e.waitUntil(
      caches.keys().then(keys => {
        return Promise.all(keys.map(key => {
          const cacheItem = this.cacheItems.find(items => items.version === key);
          if (!cacheItem) {
            return caches.delete(key);
          } else {
            return caches.open(key).then(async cache => {
              const storedUrls = await cache.keys();
              await Promise.all(storedUrls.map(storedUrl => {
                const using = cacheItem.urls.find(url => url === new URL(storedUrl.url).pathname);
                if (using) {
                  return Promise.resolve();
                } else {
                  return cache.delete(storedUrl);
                }
              }))
            })
          }
        }))
      })
    );
  }

  proxy(e) {
    e.respondWith(
      caches.match(e.request)
        .then(res => res || fetch(e.request))
    );
  }
  getImg(url) {
    return new Promise(async resolve => {
      const res = await caches.match(url);
      const blob = await res.blob();
      let reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = e => resolve(e.target.result);
    })
  }
}