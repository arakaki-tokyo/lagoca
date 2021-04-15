const Store = require('./Store');
const storeKeys = require('./storeKeys');

const OSs = {
  App: {
    name: "App",
    option: { keyPath: "key" }
  },
  DoneAct: {
    name: "DoneAct",
    option: { keyPath: "start" }
  },
  Routine: {
    name: "Routine",
    option: { keyPath: 'id' },
    index: [
      { name: "order", keyPath: "order" }
    ]
  },
  Diary: {
    name: "Diary",
    option: { keyPath: 'date' },
    index: [
      { name: "isSynced", keyPath: "isSynced" }
    ]
  },
  TaskList: {
    name: "TaskList",
    option: { keyPath: 'id' },
    index: [
      { name: "order", keyPath: "order" }
    ]
  },
  Task: {
    name: "Task",
    option: { keyPath: 'id' },
    index: [
      { name: "listId", keyPath: ["listId", "position"] },
      { name: "parent", keyPath: "parent" }
    ]
  }
};
module.exports = new class {
  VERSION = 2;
  constructor(OSs) {
    const openRequest = indexedDB.open("logoca", this.VERSION);
    openRequest.onupgradeneeded = function (ev) {
      // initialize, or update idb
      const db = ev.target.result;
      Object.values(OSs).forEach(OS => {
        if (db.objectStoreNames.contains(OS.name)) return;

        const objectStore = OS.option ?
          db.createObjectStore(OS.name, OS.option) :
          db.createObjectStore(OS.name);
        if (OS.index) OS.index.forEach(idx => objectStore.createIndex(idx.name, idx.keyPath));
      })
    }

    this.db = new Promise(resolve => {
      openRequest.onsuccess = ev => resolve(ev.target.result);
    })

    Object.values(OSs).forEach(OS => {
      this[`get${OS.name}`] = key => this._get(OS.name, key);
      this[`getAll${OS.name}`] = key => this._getAll(OS.name, key);
      this[`getIndexAll${OS.name}`] = (index, key) => this._getIndexAll(OS.name, index, key);
      this[`getAllKV${OS.name}`] = key => this._getAllKV(OS.name, key);
      this[`set${OS.name}`] = obj => this._set(OS.name, obj);
      this[`update${OS.name}`] = (key, f) => this._update(OS.name, key, f);
      this[`delete${OS.name}`] = key => this._delete(OS.name, key);
    })
  }
  init() {
    this.getAllApp()
      .then(list => list.forEach(({ key, value }) => {
        Store.set(key, value);
        this[key] = value;
      }))
      .then(() => {
        Store.onChange(storeKeys.doingAct, this);
        Store.onChange(storeKeys.settings, this);
        Store.onChange(storeKeys.doneActList, this);
      });

  }
  update({ key, value }) {
    this.setApp({ key, value });
    this[key] = value;
  }
  save(key) {
    this.setApp({ key, value: this[key] });
  }
  _get(store, key) {
    return this.db.then(db => {
      const req = db.transaction(store, "readonly").objectStore(store).get(key);
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerrors = (ev) => reject(ev);
      })
    });
  }
  _getAll(store, key) {
    return this.db.then(db => {
      const objectStore = db.transaction(store, "readonly").objectStore(store);
      const req = key !== undefined ? objectStore.getAll(key) : objectStore.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerrors = (ev) => reject(ev);
      })
    });
  }
  _getIndexAll(store, index, key) {
    return this.db.then(db => {
      const idx = db.transaction(store, "readonly").objectStore(store).index(index);
      const req = key !== undefined ? idx.getAll(key) : idx.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerrors = (ev) => reject(ev);
      })
    });
  }

  _getAllKV(store, key) {
    return this.db.then(db => {
      const objectStore = db.transaction(store, "readonly").objectStore(store);
      const req = key !== undefined ? objectStore.openCursor(key) : objectStore.openCursor();
      return new Promise((resolve, reject) => {
        const KV = [];
        req.onsuccess = (ev) => {
          let cursor = ev.target.result;
          if (cursor) {
            KV.push({ key: cursor.key, value: cursor.value });
            cursor.continue();
          } else {
            resolve(KV);
          }
        };
        req.onerrors = (ev) => reject(ev);
      })
    });
  }

  _set(store, obj) {
    console.log(store);
    console.dir(obj);
    return this.db.then(db => {
      const req = db.transaction(store, "readwrite").objectStore(store).put(obj);
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerrors = (ev) => reject(ev);
      })
    });
  }
  _update(store, key, f) {
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
  _delete(store, key) {
    return this.db.then(db => {
      const req = db.transaction(store, "readwrite").objectStore(store).delete(key);
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerrors = (ev) => reject(ev);
      })
    });
  }

  /**
   * @return {Promise<Array<Diary>>} 
   */
  syncDiary(diary) {
    return this.db.then(db => {
      const req = db.transaction(OSs.Diary.name, "readwrite").objectStore(OSs.Diary.name).openCursor(diary.date);
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (cursor) {
            if (cursor.value.timestamp >= diary.timestamp) {
              // do nothing
            } else {
              cursor.update(diary).onsuccess = () => resolve(undefined);
            }
          } else {
            return this.setDiary(diary);
          }
        };
        req.onerrors = (ev) => reject(ev);
      })
    });
  }
}(OSs);

