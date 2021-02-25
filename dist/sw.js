
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
    const [h, m, s] = this.calcElapsedTime(act.start, Date.now());
    const elapsedTime = `${h == 0 ? "" : h + "h"}${m}m`;
    self.registration.showNotification(
      "LoGoCa",
      {
        body: `${act.summary}(${elapsedTime})`,
        badge: "/img/favicon.png",
        icon: "/img/favicon.png",
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
  calcElapsedTime(start, end) {
    const elapsedTime = Math.floor((end - start) / 1000);
    const h = Math.floor(elapsedTime / (60 * 60));
    const m = Math.floor(elapsedTime / 60) % 60;
    const s = elapsedTime % 60;
    return [h, m, s];
  }

}

const notificationClickHandler = new class {
  constructor() {
    addEventListener('notificationclick', this.click.bind(this));
  }
  click(e) {
    console.dir(e);
    e.notification.close();
    const proc = (e.action === 'end') ? this.endAct : this.showPage;
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
  endAct(client, e) {
      if (client) {
        client.postMessage(null);
      } else {
        // save to indexedDB
        return idb.put({start: e.notification.data, end: Date.now()});
      }
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
  put(record) {
    return this.db.then(db => {
      return new Promise(resolve => {
        db.transaction("sw", "readwrite")
          .objectStore("sw")
          .put(record, 0)
          .onsuccess = ev => resolve(ev);
      })
    })
  }
}