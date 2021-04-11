// badge is mostly the same as favicon.ico
const badge = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADIklEQVRYR7WXSciOURTHf1+ykDkkRMiwUDJGmcu0IBsUyVCfLCxMWSEUVuawQBlKilJYoIhMkTkrMylCSSgslP517tf97nfvc5/30Xfq6X3f557hf8859/zvW0d1uQr0M/PDwOYqruqqGAEKfgw4avaLgUXApFr9VQHQE3gIdAmCfQGGAe9rAVEFwGRgLLApCKTfN4HLzQ2gI/AVuAa0ANwmBKor8Lm5Acj/GmAGMNGC3QbOADtqCS7dKiVwMdSIfYHWwNMqDfi/ANzuHSCVJCa9gNnAzthirRkYAMy09HcHugF/gGfAC+CdHc23XrDrwDhgL7AiBFEWQCtgnT25Mn8zEJoTa4H5ZrAU0MBqJGUAzLLAI3ORI+tzgaHAX2BDlRLMAU4FhsdtJ5+A9taE+hRAPVMDfYE4nQJflIEw+ANgPXDRc6bsSM567+ZZrUcFeudqycAQ4JFncAlYAnwMnOid5EjEuYBOs/dqxAm1ANgFrDQDHa8Uyaw2ndgR0wk5Dww3HfnbU6YJe9vuO5iygqfO+BbTUWliMh24YAsiKYERaTVIrAdEKhtNQxwfko5vv99+LE8A0Gsdx4We3oEcANVT/C5ZAJwocH7S1tR4KdEQUg9ImpQzlgFR6hgzGA3cLXCu5pS4ZoupanpqUkqeAwNzGVCNOptSJ6PemGPV874tjAB0TGPSFvhuCz+AdjkAUpaRRJ8/E45FRmJESVGjajOu8XSP0KYaJFYCpUtpk/QHXiYA6LU7YqndS0flVFklKqfKWghAu3JUOx64UQCgzJIa2g0qNbQauxBAPXDINA4Cy8pEKdDxj7W+N7q+x0rQB3jtOSxqsBw2v09E02JG/66QvJJtt3ufAojJxGhVxC/nbmBV6CTFhprjtwBlowqIHlb3KV5A7f5xWQDS03jd5xloiql+KV5wqpr/2yzd7l3yTpC7EYnBxIy+CMQT4I5Hz22Awdawbu5ng0shB0A6/jEKM/gK+A0MijTIPWBrcFlpolYGgIx0QdGfT4FxNF3UlAqs51euc8sCcH50VxAQTUj9NddnSyvFB2POK8CbXGC3/g+a3Y4hi31FMAAAAABJRU5ErkJggg==";
// icon is the same as img/logo72.png
const icon = "data:image/png;base64,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";

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
  showActNotice(act) {
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
    console.dir(e);
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
      await idb.update("App", "doingAct", ({ key, value }) => {
        toBeEndedAct = { ...value };
        return { key, value: null };
      });
      toBeEndedAct.isSynced = false;
      toBeEndedAct.end = Date.now();
      const [h, m, s] = this.calcElapsedTime(toBeEndedAct.start, toBeEndedAct.end);
      const elapsedTime = `${h == 0 ? "" : h + "h"}${m}m`;
      await idb.update("App", "summaryToView", ({ key, value }) => {
        toBeEndedAct.summary = `${value} (${elapsedTime})`
        return { key, value: "" };
      });
      await idb.update("App", "descriptionToView", ({ key, value }) => {
        toBeEndedAct.description = value;
        return { key, value: "" };
      });
      return await idb.update("App", "doneActList", ({ key, value }) => {
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
      version: "8",
      urls: [
        "/index.js",
      ]
    },
    {
      version: "7",
      urls: [
        "/",
      ]
    },
    {
      version: "6",
      urls: [
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
}
const idb = new class {
  db;
  constructor() {
    this.db = new Promise(resolve => {
      indexedDB.open("logoca", 1).onsuccess = ev => {
        resolve(ev.target.result);
      }
    })
  }
  set(store, obj) {
    return this.db.then(db => {
      const req = db.transaction(store, "readwrite").objectStore(store).put(obj);
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerrors = (ev) => reject(ev);
      })
    });
  }
  update(store, key, f) {
    return this.db.then(db => {
      const req = db.transaction(store, "readwrite").objectStore(store).openCursor(key);
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (cursor) {
            cursor.update(f(cursor.value)).onsuccess = () => resolve(undefined);
          } else {
            this[`set${store}`](f()).then(() => resolve(undefined));
          }
        };
        req.onerrors = (ev) => reject(ev);
      })
    });
  }

}