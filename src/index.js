
"use strict";
const TRUE = 1;
const FALSE = 0;
const ONEDAY_MS = 1000 * 60 * 60 * 24;
const ALL_TASK_LISTID = (id) => IDBKeyRange.bound([id, -1 * Date.now()], [id, Infinity]);
/**
 * データストア
 * @class Store
 */
class Store {
  static _data = new Map();

  /**
   * @static
   * @param {string} key
   * @param {object} subsriberObject
   * @memberof Store
   */
  static onChange(key, subsriberObject) {
    if (!this._data.has(key)) {
      this._data.set(key, { value: null, SOs: [] });
    }
    this._data.get(key).SOs.push(subsriberObject);
  }

  /**
   * @static
   * @param {String} key
   * @param {*} value
   * @memberof Store
   */
  static set(key, value) {
    if (this._data.has(key)) {
      const data = this._data.get(key);
      data.value = value;
      data.SOs.forEach(SO => SO.update({ key: key, value: value }));
    } else {
      this._data.set(key, { value: value, SOs: [] });
    }
  }
};

const storeKeys = {
  userProfile: "usrProfile",
  calendars: "calendars",
  settings: "settings",
  tmpNewCalendar: "tmpNewCalendar",
  isAddCalInProgress: "isAddCalInProgress",
  addedCalendar: "addedCalendar",
  summaryFromView: "summaryFromView",
  summaryToView: "summaryToView",
  descriptionFromView: "descriptionFromView",
  descriptionToView: "descriptionToView",
  doingAct: "doingAct",
  isSignedIn: "isSignedIn",
  notice: "notice",
  doneActList: "doneActList",
  sw: "sw",
  toBeStartedAct: "toBeStartedAct",
  listInserted: "listInserted",
  anotherAct: "anotherAct"
};

/* *************************************** */
/*  utirities definition                   */
/* *************************************** */
const Queue = {
  _queue: Promise.resolve(true),
  add(f) {
    this._queue = this._queue.then(f);
  }
};

class Cron {
  // key: {Number} ms, value: {object} {{Number} intervalId, {Array<function>} jobTable}
  static _jobRegister = new Map();
  static add(ms, f) {
    let jobs;
    if (this._jobRegister.has(ms)) {
      jobs = this._jobRegister.get(ms);
      jobs.jobTable.push(f);
    } else {
      jobs = { jobTable: [f] };
      this._jobRegister.set(ms, jobs);
    }

    if (jobs.jobTable.length == 1) {
      jobs.intervalId = setInterval(() => {
        jobs.jobTable.forEach(f => f());
      }, ms)
    }
  }
  static remove(ms, f) {
    if (this._jobRegister.has(ms)) {
      const { jobTable, intervalId } = this._jobRegister.get(ms);
      const index = jobTable.findIndex(job => job === f);
      if (index >= 0) {
        jobTable.splice(index, 1);
        if (jobTable.length == 0) {
          clearInterval(intervalId);
        }
      } else {
        console.log("not found");
      }
    }
  }
}
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
/** 
 * 
 * @method getAllRoutine
 * */
const idb = new class {
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


class MyDate extends Date {
  /**
   * @param {string} fmt 日時のフォーマット文字列。
   * [書式コード](https://docs.python.org/ja/3/library/datetime.html_strftime-and-strptime-format-codes)の一部を実装
   * @return {string} フォーマット済み文字列
   * @memberof MyDate
   */
  strftime(fmt) {
    return fmt
      .replaceAll("%Y", String(this.getFullYear()))
      .replaceAll("%m", ("0" + (this.getMonth() + 1)).slice(-2))
      .replaceAll("%d", ("0" + this.getDate()).slice(-2))
      .replaceAll("%H", ("0" + this.getHours()).slice(-2))
      .replaceAll("%h", ("0" + this.getUTCHours()).slice(-2))
      .replaceAll("%M", ("0" + this.getMinutes()).slice(-2))
      .replaceAll("%S", ("0" + this.getSeconds()).slice(-2));
  }
}

class Enum {
  static _created = new Map();
  name;
  value;
  constructor() {
    if (this.constructor._created.has(this.__proto__)) {
      return;
    } else {
      this.constructor._created.set(this.__proto__);
    }
    let value = 0;
    Object.keys(this.constructor).forEach(key => {

      if (this.constructor[key]) {
        const maybeNum = Number(this.constructor[key]);
        if (!Number.isNaN(maybeNum)) {
          value = Math.floor(maybeNum);
        }
      }
      this.constructor[key] = new this.__proto__.constructor();
      this.constructor[key].name = key;
      this.constructor[key].value = value;
      Object.freeze(this.constructor[key]);
      value++;
    })
    Object.freeze(this.__proto__.constructor);
  }
  static [Symbol.iterator]() {
    return Object.values(this)[Symbol.iterator]()
  }

  toString() { return this.name; }
  isSame(obj) {
    return obj && obj.name === this.name && obj.value === this.value;
  }
  isSameName(str) {
    return str === this.name;
  }
  isSameValue(val) {
    return val === this.value;
  }
}
const API = new class {
  logCalendarId;
  colorId;
  constructor() {
    Store.onChange(storeKeys.settings, this);
  }
  /**
   * @param {Object} object
   * @param {Settings} object.value
   */
  update({ key, value }) {
    this.logCalendarId = value.logCalendarId;
    this.colorId = value.colorId;
  }
  /**
   * IDで指定したイベントを取得する
   * 
   * @param {object} object
   * @param {string} object.eventId
   * @return {PromiseLike} 
   */
  getEvent({ eventId }) {
    return gapi.client.calendar.events.get({
      calendarId: this.logCalendarId,
      eventId
    });
  }
  /**
   * 期間内のイベントのリストを取得する
   *
   * @param {object} object
   * @param {string} object.calendarId
   * @param {string} object.timeMax - ISO format
   * @param {string} object.timeMin - ISO format
   * @return {PromiseLike} 
   */
  listEvent({ calendarId, timeMax, timeMin, q }) {
    return gapi.client.calendar.events.list({
      calendarId,
      timeMax,
      timeMin,
      orderBy: "startTime",
      singleEvents: true,
      maxResults: 365,
      q
    });
  }
  /**
   * 新しいイベントを挿入する
   *
   * @param {object} object
   * @param {string} [object.summary]
   * @param {string} [object.description]
   * @param {string} object.start
   * @param {string} object.end
   * @return {PromiseLike} 
   */
  insertEvent({ summary = "", description = "", start, end, colorId }) {

    return gapi.client.calendar.events.insert({
      calendarId: this.logCalendarId,
      resource: {
        summary,
        description,
        start: {
          dateTime: start,
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: end,
          timeZone: "Asia/Tokyo",
        },
        colorId: colorId ? colorId : this.colorId,
      },
    });
  }
  /**
   * 新しい終日イベントを挿入する
   *
   * @param {object} object
   * @param {string} [object.summary]
   * @param {string} [object.description]
   * @param {Date} object.start
   * @return {PromiseLike} 
   */
  insertAllDayEvent({ summary = "", description = "", start, location = "" }) {
    const startFormatted = new MyDate(start).strftime("%Y-%m-%d");
    const endFormatted = new MyDate(start.getTime() + ONEDAY_MS).strftime("%Y-%m-%d");
    return gapi.client.calendar.events.insert({
      calendarId: this.logCalendarId,
      resource: {
        summary: summary,
        description: description,
        start: { date: startFormatted },
        end: { date: endFormatted },
        colorId: this.colorId,
        location,
        transparency: "transparent"
      },
    });
  }
  /**
   * IDで指定したイベントを更新する
   *
   * @param {object} object
   * @param {string} object.eventId
   * @param {string} [object.summary]
   * @param {string} [object.description]
   * @param {string} object.start
   * @param {string} object.end
   * @return {PromiseLike} 
   */
  updateEvent({ eventId, summary = "", description = "", start, end, colorId }) {
    return gapi.client.calendar.events.update({
      calendarId: this.logCalendarId,
      eventId,
      resource: {
        summary,
        description,
        start: {
          dateTime: start,
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: end,
          timeZone: "Asia/Tokyo",
        },
        colorId: colorId ? colorId : this.colorId,
      },
    });
  }
  /**
   * IDで指定した終日イベントを更新する
   *
   * @param {object} object
   * @param {string} object.eventId
   * @param {string} object.summary
   * @param {string} object.description
   * @param {Date} object.start
   * @return {PromiseLike} 
   */
  updateAllDayEvent({ eventId, summary = "", description = "", start, location }) {
    const startFormatted = new MyDate(start).strftime("%Y-%m-%d");
    const endFormatted = new MyDate(start.getTime() + ONEDAY_MS).strftime("%Y-%m-%d");
    return gapi.client.calendar.events.update({
      calendarId: this.logCalendarId,
      eventId,
      resource: {
        summary,
        description,
        start: { date: startFormatted },
        end: { date: endFormatted },
        colorId: this.colorId,
        location,
        transparency: "transparent"
      },
    });
  }
  deleteEvent({ calendarId, eventId }) {
    // なぜかthen()を呼ばないと実行されない
    return gapi.client.calendar.events.delete({
      calendarId,
      eventId
    }).then();
  }
  /**
   * カレンダーのリストを取得する
   * 
   * @return {PromiseLike} 
   */
  listCalendar() {
    return gapi.client.calendar.calendarList.list();
  }
  /**
   * 新しいカレンダーを挿入する
   *
   * @param {object} object
   * @param {string} object.summary
   * @return {PromiseLike} 
   */
  insertCalendar({ summary }) {
    return gapi.client.calendar.calendars.insert({
      summary,
      discription: "created by LoGoCa"
    });
  }

  /**
   *  アカウントのタスクリストをリストする
   *
   * @return {*} 
   */
  listTasklist() {
    return gapi.client.tasks.tasklists.list();
  }
  /**
   * 新しいタスクリストを挿入する
   *
   * @param {TaskList} taskList
   * @return {PromiseLike} 
   */
  insertTaskList(taskList) {
    return gapi.client.tasks.tasklists.insert({ resource: TaskList.toAPI(taskList) });
  }
  /**
   * タスクリストを更新する
   *
   * @param {TaskList} taskList
   * @return {PromiseLike} 
   */
  updateTaskList(taskList) {
    return gapi.client.tasks.tasklists.update({
      tasklist: taskList.id,
      resource: TaskList.toAPI(taskList)
    });
  }
  /**
   * タスクリストを削除する
   *
   * @param {TaskList} taskList
   * @return {PromiseLike} 
   */
  deleteTaskList(taskList) {
    return gapi.client.tasks.tasklists.delete({ tasklist: taskList.id });
  }

  /**
   *
   *
   * @param {String} tasklist 
   * @return {PromiseLike} 
   */
  listTask(tasklist) {
    return gapi.client.tasks.tasks.list({
      tasklist,
      showHidden: true
    });
  }
  /**
   * 新しいタスクを挿入する
   *
   * @param {Task} task
   * @return {PromiseLike} 
   */
  insertTask(task) {
    return gapi.client.tasks.tasks.insert({
      tasklist: task.listId,
      parent: task.parent,
      resource: Task.toAPI(task)
    });
  }
  /**
   * タスクを更新する
   *
   * @param {Task} task
   * @return {PromiseLike} 
   */
  updateTask(task) {
    return gapi.client.tasks.tasks.update({
      tasklist: task.listId,
      task: task.id,
      resource: Task.toAPI(task)
    });
  }
  /**
   * タスクを移動する
   *
   * @param {Task} task
   * @param {String} previous
   * @return {PromiseLike} 
   */
  moveTask(task, previous) {
    return gapi.client.tasks.tasks.move({
      tasklist: task.listId,
      task: task.id,
      parent: task.parent,
      previous
    });
  }
  /**
   * タスクを削除する
   *
   * @param {Task} task
   * @return {PromiseLike} 
   */
  deleteTask(task) {
    return gapi.client.tasks.tasks.delete({
      tasklist: task.listId,
      task: task.id
    });
  }

}
const ToDoUtils = new class ToDoUtils {
  isSignedIn;
  constructor() {
    Store.onChange(storeKeys.isSignedIn, this);
  }
  /**
   * @param {object} object
   * @param {Boolean} object.value
   */
  update({ key, value }) {
    switch (key) {
      case storeKeys.isSignedIn:
        this.isSignedIn = value;
        break;
    }
  }
  /**
   * タスクリストを挿入する
   *
   * @param {TaskList} taskList
   * @param {Boolean} [toSync=this.isSignedIn]
   */
  async insertTaskList(taskList, toSync = this.isSignedIn) {
    await idb.setTaskList(taskList);
    if (toSync) {
      await API.insertTaskList(taskList).then(async res => {
        const insertedTaskList = TaskList.fromAPI(res.result);
        await idb.setTaskList(insertedTaskList)
          .then(() => idb.deleteTaskList(taskList.id));

        const tasks = await idb.getIndexAllTask("listId", ALL_TASK_LISTID(taskList.id));
        for (const task of tasks) {
          await idb.updateTask(task.id, /** @param {Task} t */t => {
            t.listId = res.result.id;
            return t;
          })
        }
        Store.set(storeKeys.listInserted, true);
      }).then(res => console.log(res))
    }
  }
  /**
   * タスクリストを更新する
   *
   * @param {TaskList} taskList
   * @param {Boolean} [toSync=this.isSignedIn]
   */
  async updateTaskList(taskList, toSync = this.isSignedIn) {
    await idb.setTaskList(taskList);
    if (toSync) {
      await API.updateTaskList(taskList).then(async res => {
        await idb.updateTaskList(taskList.id, () => TaskList.fromAPI(res.result))
      })
    }
  }
  /**
   * タスクリストを削除する
   * @param {TaskList} taskList
   * @param {Boolean} [toSync=this.isSignedIn]
   * @memberof ToDoUtils
   */
  async deleteTaskList(taskList, toSync = this.isSignedIn) {
    const tasks = await idb.getIndexAllTask("listId", ALL_TASK_LISTID(taskList.id));

    // in Google Tasks, tasks are deleted with tasklist.
    for (const task of tasks) await idb.deleteTask(task.id);

    if (toSync && !SyncAction.INSERT.isSame(taskList.action)) {
      await idb.updateTaskList(taskList.id, /** @param {TaskList}taskList */taskList => {
        taskList.isSynced = false;
        taskList.action = SyncAction.DELETE;
        taskList.updated = new Date();
        return taskList;
      });
      await API.deleteTaskList(taskList).then(() => {
        idb.deleteTaskList(taskList.id);
      }).catch(async res => {
        if (res.result.error.message === "Invalid Value") {
          await idb.updateTaskList(taskList.id, /** @param {TaskList}taskList */taskList => {
            taskList.isSynced = true;
            taskList.action = null;
            taskList.updated = new Date();
            return taskList;
          });
          throw new Error("This is default list, so can not be deleted.");
        }
      });
    } else {
      await idb.deleteTaskList(taskList.id);
    }
  }
  /**
   * タスクを挿入する
   *
   * @param {Task} task
   * @param {TaskItem} taskItem
   */
  async insertTask(task, taskItem) {
    await idb.setTask(task);
    if (this.isSignedIn) {
      let newId;
      await API.insertTask(task).then(async res => {
        const newTask = Task.fromAPI(res.result);
        newId = newTask.id;
        newTask.listId = task.listId;
        await idb.setTask(newTask);
        await idb.deleteTask(task.id);
        if (taskItem) taskItem.task = newTask;

        const children = await idb.getIndexAllTask("parent", task.id);
        for (const child of children) {
          await idb.updateTask(child.id, task => {
            task.parent = newTask.id;
            return task;
          })
        }
      })
      return newId;
    }
  }
  /**
   * タスクを更新する
   * @param {Task} updatedTask
   * @param {Boolean} [toSync=this.isSignedIn]
   */
  async updateTask(updatedTask, toSync = this.isSignedIn) {
    await idb.setTask(updatedTask);
    if (toSync) {
      await API.updateTask(updatedTask).then(async res => {
        const newTask = Task.fromAPI(res.result);
        newTask.listId = updatedTask.listId;
        await idb.setTask(newTask);
      })
    }
  }
  /**
   * タスクを別のリストに移動する
   *
   * @param {Task} from
   * @param {Task} to
   */
  async transferTask(from, to) {
    await idb.setTask(to);
    const children = await idb.getIndexAllTask("parent", to.id);
    const movedChildren = [];
    for (const child of children) {
      await idb.updateTask(child.id, t => {
        t.isSynced = false;
        t.listId = to.listId;
        t.updated = new Date();
        movedChildren.push(t);
        return t;
      })
    }

    if (this.isSignedIn) {
      movedChildren.sort((a, b) => b.position - a.position); // descending order
      await API.insertTask(to).then(async res => {
        const newTask = Task.fromAPI(res.result);
        newTask.listId = to.listId;
        await idb.setTask(newTask);

        const waitResult = [];
        movedChildren.forEach(child => {
          child.parent = newTask.id;
          const result = API.insertTask(child).then(async res => {
            const newChild = Task.fromAPI(res.result);
            newChild.listId = to.listId;
            await idb.setTask(newChild);
          }).catch(async () => {
            await idb.setTask(child);
          });
          waitResult.push(result);
        })
        await Promise.all(waitResult);
        await this.deleteTask(from);
      })
    }

  }
  /**
   * タスクをソートする
   * @param {TaskItem} taskItem
   * @param {Boolean} [toSync=this.isSignedIn]
   */
  async sortTask(taskItem, toSync = this.isSignedIn) {
    if (toSync) {
      let previous;
      if (taskItem.previousElementSibling) { previous = taskItem.previousElementSibling.id }
      await API.moveTask(taskItem.task, previous)
    }
  }
  /**
   * タスクを削除する
   *
   * @param {Task} task
   * @param {Boolean} [toSync=this.isSignedIn]
   */
  async deleteTask(task, toSync = this.isSignedIn) {
    const children = await idb.getIndexAllTask("parent", task.id);

    if (toSync) {
      // call API -- Children are deleted whith parent.
      await API.deleteTask(task).then(async () => {
        for (const child of children) await idb.deleteTask(child.id);
        await idb.deleteTask(task.id);
      }).catch(async () => {
        await idb.updateTask(task.id, t => {
          t.isSynced = false;
          t.action = SyncAction.DELETE;
          t.updated = new Date();
          return t;
        });
        for (const child of children) {
          await idb.updateTask(child.id, t => {
            t.isSynced = false;
            t.action = SyncAction.DELETE;
            t.updated = new Date();
            return t;
          });
        }
      });
    } else {
      for (const child of children) await idb.deleteTask(child.id);
      await idb.deleteTask(task.id);
    }
  }
}

/* *************************************** */
/*  data classes definition                */
/* *************************************** */
/**
 * ユーザーデータクラス
 *
 * @class User
 * @extends {Data}
 */
function User({ imgSrc = "", email = "" }) {
  this.imgSrc = imgSrc;
  this.email = email;
}
/**
 * カレンダーデータクラス
 *
 * @class Calendar
 * @extends {Data}
 */
function Calendar({ id = "", summary = "" }) {
  this.id = id;
  this.summary = summary;
}
/**
 * セッティングデータクラス
 *
 * @class Settings
 * @property {boolean}  upcomingEnabled
 * @property {string}   upcomingCalendarId
 * @property {string}   logCalendarId
 * @property {string}   colorId
 * @property {boolean}  routineEnabled
 * @property {boolean}  todoEnabled
 * @property {boolean}  diaryEnabled
 * @property {boolean}  notificationEnabled
 */
class Settings {
  upcomingEnabled;
  upcomingCalendarId;
  logCalendarId;
  colorId;
  routineEnabled;
  todoEnabled;
  diaryEnabled;
  notificationEnabled;

  constructor({
    upcomingEnabled,
    upcomingCalendarId,
    logCalendarId,
    colorId,
    routineEnabled,
    todoEnabled,
    diaryEnabled,
    notificationEnabled,
  }) {
    this.upcomingEnabled = upcomingEnabled;
    this.upcomingCalendarId = upcomingCalendarId;
    this.logCalendarId = logCalendarId;
    this.colorId = colorId;
    this.routineEnabled = routineEnabled;
    this.todoEnabled = todoEnabled;
    this.diaryEnabled = diaryEnabled;
    this.notificationEnabled = notificationEnabled;
  }
}
/**
 * アクションデータクラス
 *
 * @class Act
 * @extends {Data}
 */
class Act {
  constructor({
    isSynced = false,
    start = Date.now(),
    end = Date.now(),
    elapsedTime = "",
    id = "",
    summary = "",
    description = "",
    link = "",
    colorId = null
  }) {
    this.isSynced = isSynced;
    this.start = start;
    this.end = end;
    this.elapsedTime = elapsedTime;
    this.id = id;
    this.summary = summary;
    this.description = description;
    this.link = link;
    this.colorId = colorId;
  }
  getElapsedTime() {
    const [h, m, s] = this._calcElapsedTime(this.start, this.end);
    return `${h == 0 ? "" : h + "h"}${m}m`;
  }
  _calcElapsedTime(start, end) {
    const elapsedTime = Math.floor((end - start) / 1000);
    const h = Math.floor(elapsedTime / (60 * 60));
    const m = Math.floor(elapsedTime / 60) % 60;
    const s = elapsedTime % 60;
    return [h, m, s];
  }
}
/**
 * 通知データクラス
 * @class Notice
 * @extends {Data}
 */
function Notice({ message = "", duration = 5000 }) {
  this.message = message;
  this.duration = duration;
}
/**
 * Diary データクラス
 * @class Diary
 */
class Diary {
  calendarId;
  /** @type {Date} */
  date;
  /** @type {String} */
  id;
  /** @type {String} */
  value;
  /** @type {Number} */
  timestamp;
  /** @type {Number} */
  isSynced;
  link;
  constructor({ calendarId, date, id = "", value, timestamp = Date.now(), isSynced = FALSE, link = "" }) {
    this.calendarId = calendarId;
    this.date = date;
    this.id = id;
    this.value = value;
    this.timestamp = timestamp;
    this.isSynced = isSynced;
    this.link = link;
  }
}

class Routine {
  id;
  order;
  summary;
  description;
  color;
  constructor({ order = -1, summary = "", description = "", color = null }) {
    this.order = order;
    this.id = Date.now();
    this.summary = summary;
    this.description = description;
    this.color = color;
  }
  getAct() {
    return new Act({
      summary: this.summary,
      description: this.description,
      colorId: this.color ? this.color.id : null
    })
  }
}

class SyncAction extends Enum {
  static DELETE;
  static INSERT;
  static UPDATE;
} new SyncAction();

class TaskList {
  /** @type {String} */   id; // API
  /** @type {String} */   title; // API
  /** @type {Date} */     updated; // API
  /** @type {Number} */   order
  /** @type {Boolean} */  isSynced;
  /** @type {SyncAction} */  action;

  /** 
  * @param {object}   object
  * @param {String}   object.id
  * @param {String}   object.title
  * @param {Date}     object.updated
  * @param {Number}   object.order
  * @param {Boolean}  [object.isSynced]
  * @param {SyncAction}   object.action
  */
  constructor({
    id,
    title,
    updated,
    order,
    isSynced = false,
    action,
  }) {
    this.id = id;
    this.title = title;
    this.updated = updated;
    this.order = order;
    this.isSynced = isSynced;
    this.action = action;
  }
  static fromAPI(obj) {
    return new TaskList({
      id: obj.id,
      title: obj.title,
      updated: new Date(obj.updated),
      isSynced: true,
      order: Date.now()
    })
  }
  static toAPI(taskList) {
    return {
      id: taskList.id,
      title: taskList.title,
    }
  }
  getAPIFormatted() {
    return this.constructor.toAPI(this);
  }
}

class TaskStatus extends Enum {
  /** @type {TaskStatus} */ static needsAction;
  /** @type {TaskStatus} */ static completed;
} new TaskStatus();
class Task {
  /** @type {String} */     id;        // API
  /** @type {String} */     title;     // API
  /** @type {Date} */       updated;   // API
  /** @type {String} */     parent;    // API
  /** @type {Number} */     position;  // API
  /** @type {String} */     notes;      // API
  /** @type {TaskStatus} */ status;    // API
  /** @type {Date} */       due;       // API
  /** @type {Date} */       completed; // API
  /** @type {String} */     links;      // API
  /** @type {String} */     listId;
  /** @type {Boolean} */    isSynced;
  /** @type {SyncAction} */ action;

  /**
  * Creates an instance of Task.
  * @param {object}     object
  * @param {String}     object.id
  * @param {String}     object.title
  * @param {Date}       [object.updated]
  * @param {String}     object.parent
  * @param {Number}     object.position
  * @param {String}     object.notes
  * @param {TaskStatus} [object.status]
  * @param {Date}       object.due
  * @param {Date}       object.completed
  * @param {String}     object.links
  * @param {String}     object.listId
  * @param {Boolean}    [object.isSynced]
  * @param {SyncAction} object.action
  * @memberof Task
  */
  constructor({
    id,
    title,
    updated = new Date(),
    parent,
    position,
    notes,
    status = TaskStatus.needsAction,
    due,
    completed,
    links,
    listId,
    isSynced = false,
    action
  }) {
    this.id = id;
    this.title = title;
    this.updated = updated;
    this.parent = parent;
    this.position = Number(position);
    this.notes = notes;
    this.status = status;
    this.due = due;
    this.completed = completed;
    this.links = links;
    this.listId = listId;
    this.isSynced = isSynced;
    this.action = action;
  }

  static fromAPI(obj) {
    const status = [...TaskStatus].find(s => s.name === obj.status);
    let due;
    if (obj.due) {
      due = new Date(obj.due);
      due.setHours(0, 0, 0, 0);
    } else {
      due = obj.due;
    }
    let position;
    if (TaskStatus.completed.isSame(status)) {
      position = new Date(obj.completed).getTime();
    } else {
      position = Number(obj.position);
    }
    return new Task({
      id: obj.id,
      title: obj.title,
      updated: new Date(obj.updated),
      parent: obj.parent,
      position,
      notes: obj.notes,
      status,
      due,
      completed: obj.completed ? new Date(obj.completed) : undefined,
      links: obj.links,
      isSynced: true
    })
  }

  static toAPI(task) {
    const due = task.due ? new MyDate(task.due).strftime("%Y-%m-%dT00:00:00.000Z") : undefined;
    return {
      id: task.id,
      title: task.title,
      notes: task.notes,
      status: task.status.name,
      due
    }
  }

  getAPIFormatted() {
    return this.constructor.toAPI(this);
  }


}
/* *************************************** */
/*  custom elements definitions            */
/* *************************************** */
/**
 * - `data-tab`属性: 表示するページに対応するタブ
 * - `data-page`属性: 表示するページ
 *
 * @class TabSwipeable
 * @extends {HTMLElement}
 */
class TabSwipeable extends HTMLElement {
  tabs;
  view;
  scrollHandler;
  constructor() {
    super();
    this.tabs = {};
    this.scrollHandler = this._scrollHandler.bind(this);
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.toBeStartedAct, this);
  }
  connectedCallback() {
    this.querySelectorAll("[data-tab]").forEach(tab => {
      tab.addEventListener("click", this.tabClickHandler.bind(this));
      this.tabs[tab.dataset.tab] = { tab };
    });
    this.querySelectorAll("[data-page]").forEach(page => {
      this.tabs[page.dataset.page]["page"] = page;
    });
    this.view = this.querySelector("#view");
    this.tabContainer = this.querySelector("#tab");
    this.view.addEventListener("scroll", this.scrollHandler);
    window.addEventListener("resize", () => this._scrollHandler({ target: this.view }));
    // this.view.scrollLeftへの代入が機能しないため
    setTimeout(() => this.init(), 0);
  }
  init() {
    Object.values(this.tabs).find(tab => tab.tab.classList.contains("is-active")).tab.dispatchEvent(new Event("click"));
    this.view.style.scrollBehavior = "smooth";
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.settings:
        this._toggleDisplay(value.routineEnabled, this.tabs.page0);
        this._toggleDisplay(value.diaryEnabled, this.tabs.page2);
        this._toggleDisplay(value.todoEnabled, this.tabs.page3);
        if (!value.todoEnabled && !value.routineEnabled && !value.diaryEnabled) {
          // single column
          this.setAttribute("data-column", "1");
        } else if (
          (value.todoEnabled && !value.routineEnabled && !value.diaryEnabled) ||
          (!value.todoEnabled && (value.routineEnabled || value.diaryEnabled))
        ) {
          // 2 column
          this.setAttribute("data-column", "2");
        } else {
          // 3 column
          this.setAttribute("data-column", "3");
        }
        this._scrollHandler({ target: this.view });
        break;
      case storeKeys.toBeStartedAct:
        this.tabs.page1.tab.dispatchEvent(new Event("click"));
    }
  }
  _toggleDisplay(flag, page) {
    if (flag) {
      Object.values(page).forEach(elm => elm.classList.remove("is-hidden"));
    } else {
      Object.values(page).forEach(elm => elm.classList.add("is-hidden"));
    }
  }
  tabClickHandler(e) {
    e.stopPropagation();
    Object.values(this.tabs).forEach(tab => {
      if (tab.tab.contains(e.target)) {
        const scrollLength = tab.page.getBoundingClientRect().x - this.view.getBoundingClientRect().x;
        this.view.scrollLeft += scrollLength;
      }
    })
  }
  _scrollHandler(e) {
    e.target.removeEventListener("scroll", this.scrollHandler);
    const origin = this.view.getBoundingClientRect().x;
    const activeTab = Object.values(this.tabs).find(tab => {
      const lengthFromOrigin = Math.abs(tab.page.getBoundingClientRect().x - origin);
      return (lengthFromOrigin < 10 && !tab.page.classList.contains("is-hidden"));
    });
    if (activeTab) {
      Object.values(this.tabs).forEach(tab => {
        if (tab === activeTab) {
          tab.tab.classList.add("is-active");
        } else {
          tab.tab.classList.remove("is-active");
        }
      })
    }
    e.target.addEventListener("scroll", this.scrollHandler);
  }
}
class AnotherAct extends HTMLElement {
  _act;
  _transformValue;
  connectedCallback() {
    Store.onChange(storeKeys.anotherAct, this);
    Store.onChange(storeKeys.doingAct, this);
    this.innerHTML += `
      <div data-role="modal" class="modal" style="cursor: initial;justify-content: flex-start;padding-top: 50px;">
        <div data-action="close" class="modal-background"></div>
        <div class="modal-card">
          <header class="modal-card-head p-3">
            <p class="modal-card-title is-size-6">別デバイスで実行中<span data-role="time"></span></p>
            <button data-action="close" class="delete" aria-label="close"></button>
          </header>
          <section class="modal-card-body">
            <input data-role="summary" class="input mb-1" style="overflow-x: scroll;" disabled></input>
            <div data-role="description" class="content"></div>
          </section>
          <footer class="modal-card-foot">
            <button data-role="takeOverButton" data-action="takeOver" class="button is-link">引き継ぐ</button>
            <button data-action="ignore" class="button is-link is-light">無視する</button>
          </footer>
        </div>
      </div>
    `;

    this.querySelectorAll("[data-role]").forEach(elm => {
      this[`_${elm.dataset.role}`] = elm;
    });
    this.querySelectorAll("[data-action]").forEach(elm => {
      elm.addEventListener("click", this[`_${elm.dataset.action}`].bind(this))
    });
    this._transformValue = this.style.transform;
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.anotherAct:
        this._act = value;
        this._slideIn();
        this._summary.value = this._act.summary;
        this._time.innerHTML = `( ${new MyDate(this._act.start).strftime("%m/%d %H:%M")} ~ )`;
        this._description.innerHTML = this._act.description;
        break;
      case storeKeys.doingAct:
        if (value) {
          this._takeOverButton.disabled = true;
        } else {
          this._takeOverButton.disabled = false;
        }
      default:
    }
  }
  _takeOver() {
    Store.set(storeKeys.doingAct, this._act);
    Store.set(storeKeys.summaryToView, this._act.summary);
    Store.set(storeKeys.descriptionToView, this._act.description);
    this._close();
    this._slideOut();
    ActSynchronizer.synchronize();
  }
  _ignore() {
    this._close();
    this._slideOut();
  }
  _open() { this._modal.classList.add("is-active") }
  _close() { this._modal.classList.remove("is-active") }
  _slideIn() { this.style.transform = "initial"; }
  _slideOut() { this.style.transform = this._transformValue; }
}
/**
 * 設定のモーダル
 * - `data-action="open"`属性：クリックされるとモーダルを開く
 * - `data-action="close"`属性：クリックされるとモーダルを閉じる
 * - `data-action="signin"`属性：クリックされるとサインイン処理
 * - `data-action="logout"`属性：クリックされるとログアウト処理
 * - `data-action="apply"`属性：クリックされると設定を保存
 * - `data-state="logedout"`: 非ログイン状態で表示
 * - `data-state="signedin"`: ログイン状態で表示
 * - `data-role="modal"`: モーダル本体
 * - `data-role="upcomingEnabled"`: 予定の取得を有効化チェックボックス
 * - `data-role="upcomingCalendar_id"`: 予定を取得するカレンダーセレクトボックス
 * - `data-role="logCalendar_id"`: ログを記録するカレンダーセレクトボックス
 * - `data-role="colorId"`: イベントカラーラジオボタン
 * - `data-role="routineEnabled"`: routineを有効化チェックボックス
 * - `data-role="todoEnabled"`: todoリストを有効化チェックボックス
 * - `data-role="diaryEnabled"`: diaryを有効化チェックボックス
 * 
 * 
 * @class SettingsModal
 * @extends {HTMLElement}
 */
class SettingsModal extends HTMLElement {
  /** @type {Settings} */
  appliedSetting;
  upcomingEnabled;
  upcomingCalendarId;
  logCalendarId;
  colorId;
  diaryEnabled;
  notificationEnabled;

  constructor() {
    super();
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.calendars, this);
  }
  connectedCallback() {
    this.innerHTML += `
      <img is="user-img" data-action="open" data-role="userImg">
      <div data-role="modal" class="modal">
        <div data-action="close" class="modal-background"></div>
        <div class="modal-card">
          <header class="modal-card-head p-3">
            <p class="modal-card-title is-size-6 has-text-weight-bold">設定</p>
            <button data-action="close" class="delete" aria-label="close"></button>
          </header>
          <section class="modal-card-body">
            <div data-state="logedout">
              <button data-action="signin" class="button is-link">Googleアカウントにサインイン</button>
            </div>
            <div data-state="signedin" class="block is-hidden">
              <div class="field">
                <label class="label">User Profile</label>
                <div class="media control">
                  <figure class="media-left image is-32x32 mx-2">
                    <img is="user-img" class="is-rounded">
                  </figure>
                  <div class="media-content">
                    <user-email class="has-text-weight-medium is-size-7"></user-email>
                  </div>
                  <div class="media-right">
                    <button data-action="logout" class="button is-small">SignOut</button>
                  </div>
                </div>
              </div>
              <div class="field">
                <label class="label">予定を取得するカレンダー</label>
                <div class="ml-2 control">
                  <label class="checkbox"><input data-role="upcomingEnabled" type="checkbox">予定の取得を有効化</label>
                </div>
                <div class="ml-2 control">
                  <div class="select">
                    <select is="select-cal" data-role="upcomingCalendarId" style="width:150px">
                      <option value="primary">default</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="field">
                <label class="label">ログを記録するカレンダー</label>
                <div claass="ml-2 control" style="display:flex">
                  <div class="select mr-2">
                    <select is="select-log" data-role="logCalendarId" style="width:150px">
                      <option value="primary">default</option>
                    </select>
                  </div>
                  <div class="field has-addons">
                    <div class="control">
                      <input is="new-cal" id="new_calendar" class="input" type="text" placeholder="新規作成">
                    </div>
                    <div class="control">
                      <button is="add-cal" class="button is-info  has-text-light"><svg class="icon"><use xlink:href="#icon-add-outline"></use></svg></button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="field">
                <label class="label">Event Color</label>
                <eve-col data-role="colorId"></eve-col>
              </div>
            </div>
            <div class="field">
              <label class="label">
                <span class="icon is-small"><svg><use xlink:href="#icon-tool"></use></svg></span>
                <span>Routine</span>
                <tool-tip class="icon is-small has-text-info" title="繰り返し行うActivityを登録します。"></tool-tip>
              </label>
              <div class="ml-2 control">
                <label class="checkbox"><input data-role="routineEnabled" type="checkbox">Routineを有効化</label>
              </div>
            </div>
            <div class="field">
              <label class="label">
                <span class="icon is-small"><svg><use xlink:href="#icon-tasks"></use></svg></span>
                <span>ToDoリスト</span>
                <tool-tip class="icon is-small has-text-info" title="Googleアカウントにサインインした場合、GoogleのToDoリストと同期します。"></tool-tip>
              </label>
              <div class="ml-2 control">
                <label class="checkbox"><input data-role="todoEnabled" type="checkbox">ToDoリストを有効化</label>
              </div>
            </div>
            <div class="field">
              <label class="label">
                <span class="icon is-small"><svg><use xlink:href="#icon-quill"></use></svg></span>
                <span>Diary</span>
                <tool-tip class="icon is-small has-text-info" title="Googleアカウントにサインインした場合、終日のイベントとしてGoogle Calendarに登録します。"></tool-tip>
              </label>
              <div class="ml-2 control">
                <label class="checkbox"><input data-role="diaryEnabled" type="checkbox">Diaryを有効化</label>
              </div>
            </div>
            <div class="field">
              <label class="label">
                <span>通知</span>
                <tool-tip class="icon is-small has-text-info" title="通知バーなどに実行中のActivityを表示し、すばやくアクセスできるようにします。<br>初回はデバイスで許可する必要があります。"></tool-tip>
              </label>
              <div class="ml-2 control">
                <label class="checkbox"><input is="notification-check" data-role="notificationEnabled" type="checkbox">実行中Activityの通知を有効化</label>
              </div>
            </div>
          </section>
          <footer class="modal-card-foot">
            <button data-action="apply" class="button is-link">保存</button>
            <button data-action="close" class="button is-link is-light">キャンセル</button>
          </footer>
        </div>
      </div>
    `;
    this.querySelectorAll("[data-role]").forEach(elm => {
      this[`${elm.dataset.role}`] = elm;
    })
    this.querySelectorAll("[data-action]").forEach(elm => {
      elm.addEventListener("click", this[`${elm.dataset.action}`].bind(this))
    })
    this.upcomingEnabled.addEventListener("click", e => {
      this.upcomingCalendarId.disabled = !e.target.checked;
    }
    )
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.settings:
        this.appliedSetting = value;
      // continue
      case storeKeys.calendars:
        // wait calendar selectors updating
        setTimeout(() => this.init(this.appliedSetting), 0);
        break;
      case storeKeys.isSignedIn:
        if (value) {
          this.querySelectorAll(`[data-state="signedin"]`)
            .forEach(elm => elm.classList.remove("is-hidden"));
          this.querySelectorAll(`[data-state="logedout"]`)
            .forEach(elm => elm.classList.add("is-hidden"));
          this.userImg.style.display = "initial";
        } else {
          this.querySelectorAll(`[data-state="signedin"]`)
            .forEach(elm => elm.classList.add("is-hidden"));
          this.querySelectorAll(`[data-state="logedout"]`)
            .forEach(elm => elm.classList.remove("is-hidden"));
          this.userImg.style.display = "none";
        }
        break;
      default:
    }
  }
  open() {
    this.modal.classList.add("is-active");
  }
  close() {
    this.modal.classList.remove("is-active");
  }
  signin(ev) {
    ev.target.classList.add("is-loading");
    gapi.auth2.getAuthInstance().signIn()
      .catch(error => {
        console.error(error);
      })
      .then(() => {
        ev.target.classList.remove("is-loading");
      });
  }
  logout(ev) {
    gapi.auth2.getAuthInstance().signOut();
  }
  apply() {
    const newSettings = new Settings({
      upcomingEnabled: this.upcomingEnabled.checked,
      upcomingCalendarId: this.upcomingCalendarId.value,
      logCalendarId: this.logCalendarId.value,
      colorId: this.colorId.value,
      routineEnabled: this.routineEnabled.checked,
      todoEnabled: this.todoEnabled.checked,
      diaryEnabled: this.diaryEnabled.checked,
      notificationEnabled: this.notificationEnabled.checked
    });
    Store.set(storeKeys.settings, newSettings);
    this.close();
  }
  init(settings) {
    this.upcomingEnabled.checked = settings.upcomingEnabled;
    this.upcomingCalendarId.value = settings.upcomingCalendarId;
    this.upcomingCalendarId.disabled = !settings.upcomingEnabled;
    this.logCalendarId.value = settings.logCalendarId;
    this.colorId.value = settings.colorId;
    this.routineEnabled.checked = settings.routineEnabled;
    this.todoEnabled.checked = settings.todoEnabled;
    this.diaryEnabled.checked = settings.diaryEnabled;
    this.notificationEnabled.checked = settings.notificationEnabled;
  }
}

/**
 * UserImg
 * @class UserImg
 * @extends {HTMLImageElement}
 */
class UserImg extends HTMLImageElement {
  constructor() {
    super();
    Store.onChange(storeKeys.userProfile, this);
  }
  /**
   * @param {object} object
   * @param {string} object.key
   * @param {User} object.value
   * @memberof UserImg
   */
  update({ key, value }) {
    this.src = value.imgSrc;
  }
}

/**
 * UserEmail
 * @class UserEmail
 * @extends {HTMLElement}
 */
class UserEmail extends HTMLElement {
  constructor() {
    super();
    Store.onChange(storeKeys.userProfile, this);
  }
  /**
   * @param {object} object
   * @param {string} object.key
   * @param {User} object.value
   * @memberof UserEmail
   */
  update({ key, value }) {
    this.innerText = value.email;
  }
}

/**
 * カレンダーセレクトボックスの親クラス
 * @class SelectCalendar
 * @extends {HTMLSelectElement}
 */
class SelectCalendar extends HTMLSelectElement {
  constructor() {
    super();
    Store.onChange(storeKeys.calendars, this);
    Store.onChange(storeKeys.addedCalendar, this);

  }

  /**
   * - calendarsを取得し、セレクトボックスにリストする
   * - addedCalendarを取得し、セレクトボックスに追加する
   * 
   * @param {object} object
   * @param {string} object.key
   * @param {Array<Calendar> | Calendar} object.value
   * @memberof SelectCalendar
   */
  update({ key, value }) {
    switch (key) {
      case storeKeys.calendars:
        this.innerHTML = "";
        value.forEach(cal => this.addOption(cal));
        break;
      case storeKeys.addedCalendar:
        this.addOption(value);
        break;
      default:
    }
  }

  /**
   * @param {Calendar} cal
   * @memberof SelectCalendar
   */
  addOption(cal) {
    const opt = document.createElement("option");
    opt.value = cal.id;
    opt.innerText = cal.summary;
    this.insertAdjacentElement('beforeend', opt);
  }
}
/**
 * ログを記録するカレンダー
 *
 * @class SelectLogCalendar
 * @extends {SelectCalendar}
 */
class SelectLogCalendar extends SelectCalendar {
  /**
   * - addedCalendarを選択
   * 
   * @param {object} object
   * @param {string} object.key
   * @param {Calendar} object.value
   * @memberof SelectCalendar
   */
  update({ key, value }) {
    super.update({ key, value });
    switch (key) {
      case storeKeys.addedCalendar:
        this.value = value.id;
        break;
      default:
    }
  }
}

class NewCalendar extends HTMLInputElement {
  constructor() {
    super();
    Store.onChange(storeKeys.isAddCalInProgress, this);
  }
  connectedCallback() {
    this.addEventListener("input", e => {
      Store.set(storeKeys.tmpNewCalendar, this.value);
    })
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.isAddCalInProgress:
        if (!value) {
          this.value = "";
        }
        break;
    }
  }
}

class AddCalendar extends HTMLButtonElement {
  tmpNewCalendar;
  IntervalId;
  constructor() {
    super();
    Store.onChange(storeKeys.tmpNewCalendar, this);
    Store.onChange(storeKeys.isAddCalInProgress, this);
  }
  connectedCallback() {
    this.style.transitionDuration = "500ms";
    this.addEventListener("click", () => {
      this.addCalendarProc(this.tmpNewCalendar);
    })
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.tmpNewCalendar:
        this.tmpNewCalendar = value;
        this.blink(value);
        break;
      case storeKeys.isAddCalInProgress:
        if (value) {
          this.blink("");
          this.classList.add("is-loading");
        } else {
          this.classList.remove("is-loading");
          this.value = "";
        }
        break;
    }
  }
  addCalendarProc(newCalendarSummary) {

    Store.set(storeKeys.isAddCalInProgress, true);
    API.insertCalendar({ summary: newCalendarSummary })
      .then(res => {
        if (res.status == 200) {
          Store.set(storeKeys.addedCalendar, new Calendar({ id: res.result.id, summary: res.result.summary }));
        } else {
          throw new Error('The response status is other than "200".');
        }
      })
      .catch(err => {
        console.log(err);
        Store.set(storeKeys.notice, new Notice({ message: "新しいカレンダーを作成できませんでした。" }));
      })
      .then(() => {
        Store.set(storeKeys.isAddCalInProgress, false);
      })
  }
  blink(text) {
    if (text && !this.IntervalId) {
      this.IntervalId = setInterval(() => {
        this.classList.add("has-text-warning");
        setTimeout(() => this.classList.remove("has-text-warning"), 500);
      }, 1000);
    } else if (!text && this.IntervalId) {
      clearInterval(this.IntervalId);
      this.IntervalId = null;
    }
  }
}

/**
 * @class EventColor
 * @extends {HTMLElement}
 */
class EventColor extends HTMLElement {
  colors = [
    { id: "11", value: "#dc2127" },
    { id: "4", value: "#ff887c" },
    { id: "6", value: "#ffb878" },
    { id: "5", value: "#fbd75b" },
    { id: "10", value: "#51b749" },
    { id: "2", value: "#7ae7bf" },
    { id: "7", value: "#46d6db" },
    { id: "1", value: "#a4bdfc" },
    { id: "9", value: "#5484ed" },
    { id: "3", value: "#dbadff" },
    { id: "8", value: "#e1e1e1" },
  ];
  form;

  constructor() {
    super();
    this.form = document.createElement("form");
  }
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    let HTML = `
      <style>
      input {
        display: none;
      }
      input + label {
        display: inline-block;
        width: 1.4rem;
        height: 1.4rem;
        margin: 0 0.2rem;
        border: solid 3px;
        border-radius: 50%;
        line-height: 1rem;
        box-sizing: border-box;
        text-align: center;
        vertical-align: middle;
      }
      input:checked + label {
        border: solid 0.71rem;
      }
      </style>`;
    this.colors.forEach(color => {
      HTML += `<input type="radio" name="ev" value="${color.id}" id="${color.id}"><label for="${color.id}" style="color:${color.value};"></label>`;
    });
    this.form.innerHTML = HTML;
    this.shadowRoot.appendChild(this.form);
  }
  get value() {
    return this.form.ev.value;
  }
  get colorValue() {
    return this.colors.find(color => color.id == this.value).value;
  }
  set value(val) {
    this.form.ev.value = val;
  }
  set disabled(val) {
    if (typeof val != "boolean") return;

    if (val) {
      this.form.ev.forEach(radio => {
        radio.checked = false;
        radio.disabled = true;
      });
      this.form.querySelectorAll("label").forEach(l => l.style.borderColor = "gray");
    } else {
      this.form.ev.forEach(radio => {
        radio.disabled = false;
      });
      this.form.querySelectorAll("label").forEach(l => l.style.borderColor = "inherit");
    }
  }
}

class NotificationCheck extends HTMLInputElement {
  permission;
  constructor() {
    super();
    if (!("Notification" in window)) {
      this.disabled = true;
    } else {
      this.permission = Notification.permission;
    }
  }
  connectedCallback() {
    Store.set(storeKeys.notificationEnabled, this.checked);

    this.addEventListener("input", () => {
      if (this.checked) {
        if (this.permission === "denied") {
          Store.set(storeKeys.notice, new Notice({ message: "このアプリからの通知が拒否されています。<br>デバイス、またはブラウザの設定を確認してください。" }));
          this.checked = false;
        } else {
          const callback = permission => {
            if (permission != "granted") {
              this.checked = false;
            }
          };
          try {
            Notification.requestPermission().then(callback);
          } catch (e) {
            console.log(e)
            Notification.requestPermission(callback);
          }
        }
      }
    })
  }
  set checked(val) {
    super.checked = (val && this.permission === "granted") ? true : false;
  }
  get checked() {
    return super.checked;
  }
}

/**
 * アクションタイトル入力欄
 * @class Summary
 * @extends {HTMLInputElement}
 */
class Summary extends HTMLInputElement {
  constructor() {
    super();
    Store.onChange(storeKeys.summaryToView, this);
    Store.onChange(storeKeys.doingAct, this);
  }
  connectedCallback() {
    this.addEventListener("input", () => {
      Store.set(storeKeys.summaryFromView, this.value);
      idb.setApp({ key: storeKeys.summaryToView, value: this.value });
    });
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.summaryToView:
        this.value = value;
        this.dispatchEvent(new Event("input"));
        break;
      case storeKeys.doingAct:
        if (this[key] && !value) {
          this.value = "";
          this.dispatchEvent(new Event("input"));
        }
        this[key] = value;
        break;
      default:
    }
  }
}

/**
 * アクション詳細入力欄
 * @class Description
 * @extends {HTMLInputElement}
 */
class Description extends HTMLElement {
  constructor() {
    super();
    Store.onChange(storeKeys.descriptionToView, this);
    Store.onChange(storeKeys.doingAct, this);
  }
  connectedCallback() {
    const editorContainer = document.createElement("div");
    this.innerHTML = "";
    this.appendChild(editorContainer);
    this.quill = new Quill(editorContainer, {
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          ['link'],
          ['clean']
        ]
      },
      placeholder: this.getAttribute("placeholder"),
      theme: 'snow'
    });

    this.editor = this.querySelector(".ql-editor");
    this.editor.classList.add("textarea", "has-fixed-size");
    this.quill.on("text-change", () => {
      Store.set(storeKeys.descriptionFromView, this.editor.innerHTML);
      idb.setApp({ key: storeKeys.descriptionToView, value: this.editor.innerHTML });
    })
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.descriptionToView:
        this.value = value;
        this.dispatchEvent(new Event("input"));
        break;
      case storeKeys.doingAct:
        if (this[key] && !value) {
          this.value = "";
          this.dispatchEvent(new Event("input"));
        }
        this[key] = value;
        break;
      default:
    }
  }
  set value(val) { this.editor.innerHTML = val; }
}

/**
 * スタートボタン
 * @class ActStart
 * @extends {HTMLButtonElement}
 */
class ActStart extends HTMLButtonElement {
  summary;
  description;
  isSignedIn;
  constructor() {
    super();
    Store.onChange(storeKeys.summaryFromView, this);
    Store.onChange(storeKeys.descriptionFromView, this);
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.toBeStartedAct, this);
  }
  connectedCallback() {
    this.addEventListener("click", () => {
      const newAct = new Act({ summary: this.summary, description: this.description });
      this._startProc(newAct);
    })
  }
  _startProc(act) {
    const now = new Date();
    Store.set(storeKeys.doingAct, act);
    if (this.isSignedIn) {
      Queue.add(() => {
        return API.insertEvent({
          summary: act.summary,
          description: act.description,
          start: now.toISOString(),
          end: now.toISOString(),
          colorId: act.colorId
        })
          .then(res => {
            act.isSynced = true;
            act.id = res.result.id;
            act.link = res.result.htmlLink;
            idb.save(storeKeys.doingAct);
          })
          .catch(handleRejectedCommon);
      });
    }
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.summaryFromView:
        this.summary = value;
        break;
      case storeKeys.descriptionFromView:
        this.description = value;
        break;
      case storeKeys.isSignedIn:
        this.isSignedIn = value;
        break;
      case storeKeys.doingAct:
        if (value)
          this.classList.add("is-hidden");
        else
          this.classList.remove("is-hidden");
        break;
      case storeKeys.toBeStartedAct:
        this._startProc(value);
        break;
      default:
    }
  }

}

/**
 * エンドボタン
 * @class ActEnd
 * @extends {HTMLButtonElement}
 */
class ActEnd extends HTMLButtonElement {
  summary;
  description;
  isSignedIn;
  /** @type {Act} */
  doingAct;
  /** @type {Array<Act>} */
  doneActList;
  constructor() {
    super();
    Store.onChange(storeKeys.summaryFromView, this);
    Store.onChange(storeKeys.descriptionFromView, this);
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.doneActList, this);
    Store.onChange(storeKeys.sw, this);
  }
  connectedCallback() {
    this.addEventListener("click", () => {
      this.endProc(new Date(Date.now() + 1000));
    })
  }

  /**
   * @param {Date} end
   * @memberof ActEnd
   */
  endProc(end) {
    Queue.add(() => {
      if (!this.doingAct) return;
      const toBeEndedAct = new Act(this.doingAct);
      toBeEndedAct.end = end.getTime();
      toBeEndedAct.summary = `${this.summary} (${toBeEndedAct.getElapsedTime()})`;
      toBeEndedAct.description = this.description;
      Store.set(storeKeys.doingAct, null);

      if (this.isSignedIn) {
        const syncMethod = toBeEndedAct.isSynced ? API.updateEvent.bind(API) : API.insertEvent.bind(API);

        return syncMethod({
          eventId: toBeEndedAct.id,
          summary: toBeEndedAct.summary,
          description: toBeEndedAct.description,
          start: new Date(toBeEndedAct.start).toISOString(),
          end: end.toISOString(),
          colorId: toBeEndedAct.colorId
        })
          .then(res => {
            console.log(res);
            toBeEndedAct.isSynced = true;
            toBeEndedAct.id = res.result.id;
            toBeEndedAct.link = res.result.htmlLink;
          })
          .catch(err => {
            console.log(err);
            toBeEndedAct.isSynced = false;
            handleRejectedCommon(err);
          })
          .then(() => {
            postEndProc(this.doneActList, toBeEndedAct);
          });
      } else {
        postEndProc(this.doneActList, toBeEndedAct);
      }
    });
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.summaryFromView:
        this.summary = value;
        break;
      case storeKeys.descriptionFromView:
        this.description = value;
        break;
      case storeKeys.isSignedIn:
        this.isSignedIn = value;
        break;
      case storeKeys.doingAct:
        this.doingAct = value;
        if (value) {
          this.classList.remove("is-hidden");
        } else {
          this.classList.add("is-hidden");
        }
        break;
      case storeKeys.doneActList:
        this.doneActList = value;
        break;
      case storeKeys.sw:
        this.dispatchEvent(new Event("click"));
        break;
      default:
    }
  }
}

/**
 * 経過時間表示
 * @class TimeElapsed
 * @extends {HTMLElement}
 */
class TimeElapsed extends HTMLElement {
  start;
  doingAct;
  registeredJob;
  connectedCallback() {
    Store.onChange(storeKeys.doingAct, this);
  }
  /**
   * @param {object} object
   * @param {string} object.key
   * @param {boolean | Act} object.value
   * @memberof TimeElapsed
   */
  update({ key, value }) {
    switch (key) {
      case storeKeys.doingAct:
        if (value) {
          if (this.doingAct) return;
          this.doingAct = value;

          this.start = value.start;
          this.doTimeout();
          this.registeredJob = this.doTimeout.bind(this);
          Cron.add(1000, this.registeredJob);
        } else {
          if (!this.doingAct) return;
          this.doingAct = value;

          Cron.remove(1000, this.registeredJob);
          this.init();
          this.start = null;
        }
        break;
      default:
    }
  }

  init() {
    this.innerHTML = "00:00:00";
  }
  doTimeout() {
    const [h, m, s] = this.calcElapsedTime(this.start, Date.now());
    this.innerHTML = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    this.doingAct.elapsedTime = `${h == 0 ? "" : h + "h"}${m}m`;
  }
  calcElapsedTime(start, end) {
    const elapsedTime = Math.floor((end - start) / 1000);
    const h = Math.floor(elapsedTime / (60 * 60));
    const m = Math.floor(elapsedTime / 60) % 60;
    const s = elapsedTime % 60;
    return [h, m, s];
  }
}

/**
 * 通知表示
 * - `id="notice_message"`の要素内にメッセージを表示。
 * @class NoticeShow
 * @extends {HTMLElement}
 */
class NoticeShow extends HTMLElement {
  connectedCallback() {
    Store.onChange(storeKeys.notice, this);
  }
  update({ key, value }) {
    this.querySelector("#notice_message").innerHTML = value.message;
    this.style.transform = "translateY(-130px)";
    setTimeout(() => {
      this.style.transform = "";
    }, value.duration);
  }
}
class DoneActList extends HTMLElement {
  isSignedIn;
  doingAct = null;
  listContainer;
  tmpl;
  connectedCallback() {
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.doneActList, this);

    this.listContainer = this.querySelector("[data-container]")
    const template = this.querySelector("template");
    this.tmpl = template.innerHTML;
    template.remove();

  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.isSignedIn:
      case storeKeys.doingAct:
        this[key] = value;
        break;
      case storeKeys.doneActList:
        this.listContainer.innerHTML = "";
        value.forEach(act => {
          const doneAct = document.createElement("done-act");
          doneAct.init({ tmpl: this.tmpl, act, isSignedIn: this.isSignedIn, isActDoing: this.doingAct ? true : false });
          this.listContainer.insertAdjacentElement('afterbegin', doneAct);
        })
        break;
      default:
    }
  }
}
/**
 * 終了したアクティビティ
 * - テンプレートとAct型のデータを受け取りレンダリングする
 * - テンプレート(string)
 *  - data-summary属性：サマリ
 *  - data-description属性：詳細
 *  - data-time属性：時間
 *  - data-failed-add属性：非同期終了した場合、クラスを追加
 *  - data-failed-remove属性：非同期終了した場合、クラスを削除
 *  - data-restart属性：リスタートボタン
 *
 * @class DoneAct
 * @extends {HTMLElement}
 */
class DoneAct extends HTMLElement {
  act;
  isSignedIn;
  isActDoing;
  doneActList;
  connectedCallback() {
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.doneActList, this);
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.doingAct:
        this.isActDoing = value ? true : false;
        this._render(this.act);
        break;
      case storeKeys.isSignedIn:
        this[key] = value;
        this._render(this.act);
        break;
      case storeKeys.doneActList:
        this[key] = value;
        break;
      default:
    }
  }
  init({ tmpl, act, isSignedIn, isActDoing }) {
    this.innerHTML = tmpl;
    this.act = act;
    this.isSignedIn = isSignedIn;
    this.isActDoing = isActDoing;
    this._render(act);
  }
  /**
   * @param {Act} act
   * @memberof DoneAct
   */
  _render(act) {
    this.querySelector("[data-summary]").innerHTML = act.link ? `<a href="${act.link}" target="_blank" rel="noreferrer">${act.summary}</a>` : act.summary;
    this.querySelector("[data-time]").innerHTML = `${new MyDate(act.start).strftime("%m/%d %H:%M")} ~ ${new MyDate(act.end).strftime("%H:%M")}`;
    this.querySelector("[data-description]").innerHTML = act.description;

    if (this.isSignedIn && act.id === "") {
      this.querySelectorAll("[data-failed-add]")
        .forEach(e => e.classList.add(e.dataset.failedAdd));
      this.querySelectorAll("[data-failed-remove]")
        .forEach(e => e.classList.remove(e.dataset.failedRemove));
      this.querySelector("[data-sync]").onclick = this.sync.bind(this);
    } else {
      this.querySelectorAll("[data-failed-add]")
        .forEach(e => e.classList.remove(e.dataset.failedAdd));
      this.querySelectorAll("[data-failed-remove]")
        .forEach(e => e.classList.add(e.dataset.failedRemove));
    }

    const restartButton = this.querySelector("[data-restart]");
    restartButton.disabled = this.isActDoing;
    restartButton.onclick = this.restart.bind(this);

  }
  restart() {
    const newAct = new Act({
      summary: this.act.summary.replace(/ \([^(]*\d?m\)$/, ""),
      description: this.act.description,
      colorId: this.act.colorId
    });
    Store.set(storeKeys.summaryToView, newAct.summary);
    Store.set(storeKeys.descriptionToView, newAct.description);
    Store.set(storeKeys.toBeStartedAct, newAct);
  }
  sync() {
    Queue.add(() => API.insertEvent({
      summary: this.act.summary,
      description: this.act.description,
      start: new Date(this.act.start).toISOString(),
      end: new Date(this.act.end).toISOString(),
      colorId: this.act.colorId
    })
      .then(res => {
        this.act.isSynced = true;
        this.act.id = res.result.id;
        this.act.link = res.result.htmlLink;
        this._render(this.act);
        idb.save(storeKeys.doneActList);
      })
      .catch(handleRejectedCommon)
    );
  }
}

class UpcomingAct extends HTMLElement {
  act;
  isActDoing;
  connectedCallback() {
    Store.onChange(storeKeys.doingAct, this);
  }
  update({ key, value }) {
    this.isActDoing = value ? true : false;
    this._render(this.act)
  }
  init({ tmpl, act, isActDoing }) {
    this.innerHTML = tmpl;
    this.act = act;
    this.isActDoing = isActDoing;
    this._render(act);
  }
  /**
   * @param {Act} act
   * @memberof UpcomingAct
   */
  _render(act) {
    this.querySelector("[data-summary]").innerHTML = `<a href="${act.link}" target="_blank">${act.summary}</a>`;
    const dateTime = act.start && act.end ?
      `${new MyDate(act.start).strftime("%m/%d %H:%M")} ~ ${new MyDate(act.end).strftime("%H:%M")}` :
      new MyDate().strftime("%m/%d");
    this.querySelector("[data-time]").innerHTML = dateTime;

    const startButton = this.querySelector("[data-start]");
    startButton.disabled = this.isActDoing;
    startButton.onclick = this.start.bind(this);

  }
  start() {
    const newAct = new Act({
      summary: this.act.summary,
      description: this.act.description
    })
    Store.set(storeKeys.summaryToView, newAct.summary);
    Store.set(storeKeys.descriptionToView, newAct.description);
    Store.set(storeKeys.toBeStartedAct, newAct);
  }
}
class UpcomingActList extends HTMLElement {
  calendarId;
  settings;
  isActDoing = false;
  isSignedIn = false;
  listContainer;
  tmpl;

  connectedCallback() {
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.isSignedIn, this);

    this.listContainer = this.querySelector("[data-container]");
    const template = this.querySelector("template");
    this.tmpl = template.innerHTML;
    template.remove();

  }

  update({ key, value }) {
    switch (key) {
      case storeKeys.doingAct:
        this.isActDoing = value ? true : false;
        break;
      case storeKeys.settings:
      case storeKeys.isSignedIn:
        this[key] = value;

        if (!this.settings.upcomingEnabled || !this.isSignedIn) {
          this.classList.add("is-hidden");
        } else {
          this.classList.remove("is-hidden");
          if (this.calendarId != this.settings.upcomingCalendarId) {
            this.calendarId = this.settings.upcomingCalendarId;
            this.getUpcomings(this.calendarId)
              .then(this.listUpcomings.bind(this));
          }
        }
        break;
      default:
    }
  }

  getUpcomings(calendarId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tommorow = new Date(today.getTime() + ONEDAY_MS);
    return API.listEvent({
      calendarId,
      timeMax: tommorow.toISOString(),
      timeMin: new Date().toISOString()
    })
      .then(res => {
        console.log(res);
        const upcomings = [];
        res.result.items.forEach(item => {
          if (item.location && item.location.match(/.*LoGoCa.*/)) return;
          upcomings.push(new Act({
            start: item.start.dateTime ? new Date(item.start.dateTime).getTime() : null,
            end: item.end.dateTime ? new Date(item.end.dateTime).getTime() : null,
            summary: item.summary,
            description: item.description,
            link: item.htmlLink
          }))
        });
        return upcomings;
      })
      .catch(handleRejectedCommon);
  }

  listUpcomings(upcomings) {
    this.listContainer.innerHTML = "";
    upcomings.forEach(act => {
      const upcomingAct = document.createElement("upcoming-act");
      upcomingAct.init({ tmpl: this.tmpl, act, isActDoing: this.isActDoing });
      this.listContainer.insertAdjacentElement('beforeend', upcomingAct);
    })
  }
}

class ToolTip extends HTMLElement {
  tip;
  constructor() {
    super();
    this.style.cursor = "help";
  }
  connectedCallback() {
    this.attachShadow({ mode: 'open' }).innerHTML = `
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32">
    <style>
      g{stroke-width: 0;fill: currentColor;}
      #tip{
        position: fixed;
        background: black;
        color: white;
        font-size: 11px;
        font-weight: normal;
        opacity: 0.8;
        padding: 3px;
        border-radius: 3px;
        z-index: 10;
        width: 250px;
        display: none;
        user-select: none ;
      }
    </style>
    <g>
    <path d="M14 9.5c0-0.825 0.675-1.5 1.5-1.5h1c0.825 0 1.5 0.675 1.5 1.5v1c0 0.825-0.675 1.5-1.5 1.5h-1c-0.825 0-1.5-0.675-1.5-1.5v-1z"></path>
    <path d="M20 24h-8v-2h2v-6h-2v-2h6v8h2z"></path>
    <path d="M16 0c-8.837 0-16 7.163-16 16s7.163 16 16 16 16-7.163 16-16-7.163-16-16-16zM16 29c-7.18 0-13-5.82-13-13s5.82-13 13-13 13 5.82 13 13-5.82 13-13 13z"></path>
    </g></svg>
    `
    this.tip = document.createElement("div");
    this.tip.id = "tip";
    this.tip.innerHTML = this.getAttribute("title");
    this.shadowRoot.append(this.tip);

    this.addEventListener("click", this.show);
    this.hide = this._hide.bind(this);
  }
  show(e) {
    this.tip.style.left = `${this.getBoundingClientRect().x + 16}px`;
    this.tip.style.top = `${this.getBoundingClientRect().y + 16}px`;
    const marginRight = window.innerWidth - (this.getBoundingClientRect().x + 270);
    if (marginRight < 0) {
      this.tip.style.transform = `translateX(${marginRight}px)`;
    }
    this.removeEventListener("click", this.show);
    setTimeout(() => document.addEventListener("click", this.hide), 0);
    this.tip.style.display = "block";
  }
  _hide() {
    this.tip.style.transform = "";
    document.removeEventListener("click", this.hide);
    this.tip.style.display = "none";
    this.addEventListener("click", this.show);
  }
}
/**
 * - `data-role="tommorow"`: 翌日ボタン
 * - `data-role="yesterday"`: 昨日ボタン
 * - `data-role="date"`: input[type="date"]
 *
 * @class DiaryNav
 * @extends {HTMLElement}
 */
class DiaryNav extends HTMLElement {
  _currentDate; // 地方時の午前0時で日付を保持する
  _today; // today判定用変数。今日の地方時の午前0時。
  _tomorrow;
  _yesterday;
  _date;
  _onchange;
  constructor() {
    super();
    this._currentDateUpdate(new Date());
    this._today = new Date(this._currentDate);
  }
  connectedCallback() {
    this.querySelectorAll("[data-role]").forEach(elm => {
      this[`_${elm.dataset.role}`] = elm;
    })

    this._date.max = this._date.value = this._currentDate.strftime("%Y-%m-%d");
    this._tomorrow.disabled = true;
    this._yesterday.addEventListener("click", e => {
      this._date.stepDown();
      this._date.dispatchEvent(new Event("change"));
    });
    this._tomorrow.addEventListener("click", e => {
      this._date.stepUp();
      this._date.dispatchEvent(new Event("change"));
    });
    this._date.addEventListener("change", this._dateOnChange.bind(this));
  }
  _dateOnChange(e) {
    e.stopPropagation();
    this._currentDateUpdate(new Date(e.target.value));
    if (this._currentDate.getTime() === this._today.getTime()) {
      this._tomorrow.disabled = true;
    } else {
      this._tomorrow.disabled = false;
    }
  }
  _currentDateUpdate(date) {
    this._currentDate = new MyDate(date);
    this._currentDate.setHours(0, 0, 0, 0);
    this.dispatchEvent(new Event("change"));
  }
  get value() { return new Date(this._currentDate); }
}
class QuillCommon extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const editorContainer = document.createElement("div");
    this.appendChild(editorContainer);
    this.quill = new Quill(editorContainer, {
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          ['link'],
          ['clean']
        ]
      },
      placeholder: this.getAttribute("placeholder"),
      theme: 'snow'
    });

    this.editor = this.querySelector(".ql-editor");
    this.editor.classList.add("textarea", "has-fixed-size");
    this.quill.on("text-change", () => {
      this.dispatchEvent(new Event("change"));
    })
  }
  set value(val) { this.editor.innerHTML = val; }
  get value() { return this.editor.innerHTML; }
}

class DiaryContainer extends HTMLDivElement {
  DIARY_LABEL = "LoGoCa_DIARY";
  currentDiary;
  descChange;
  calendarId;
  isSignedIn;
  /** @type {Settings}  */settings;
  connectedCallback() {
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.isSignedIn, this);
    this.date = this.querySelector("diary-nav");
    this.desc = this.querySelector("[data-role='description']");
    this.linkButton = this.querySelector("[data-role='gcalLink']");
    this.descChange = this._descChange.bind(this);
    this.date.onchange = e => this.dateChange(e.target.value);
    this.dateChange(this.date.value);
  }
  async update({ key, value }) {
    switch (key) {
      case storeKeys.settings:
        this.calendarId = value.logCalendarId;
      // don't break
      case storeKeys.isSignedIn:
        this[key] = value;
        this.linkButton.style.visibility = value ? "visible" : "hidden";
        if (this.isSignedIn && this.settings.diaryEnabled) {
          await this.fetch();
          this.checkUnsynced();
        }

    }
  }
  dateChange(date) {
    this.desc.removeEventListener("change", this.descChange);
    idb.getDiary(date).then(diary => {
      if (diary) {
        this.currentDiary = diary;
        this.desc.value = diary.value;
      } else {
        this.currentDiary = null;
        this.desc.value = "";
      }
      // quill内でchangeイベントが非同期で発火するため
      setTimeout(() => this.desc.addEventListener("change", this.descChange), 0);
    });
  }
  _descChange(e) {
    if (e.target.value === "<p><br></p>") {
      idb.getDiary(this.date.value).then(diary => {
        if (diary.id && this.isSignedIn) {
          API.deleteEvent({ calendarId: diary.calendarId, eventId: diary.id });
        }
        idb.deleteDiary(this.date.value);
      })
    } else {
      idb.updateDiary(this.date.value, diary => {
        const updateDiary = diary ? diary : new Diary({ calendarId: this.calendarId, date: this.date.value });
        updateDiary.value = e.target.value;
        updateDiary.timestamp = Date.now();
        updateDiary.isSynced = FALSE;
        return updateDiary;
      })
      if (this.isSignedIn) {
        clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => this.checkUnsynced(), 10_000);
      }
    }
  }
  checkUnsynced() {
    idb.getIndexAllDiary("isSynced", FALSE).then(list => {
      console.dir(list);
      list.forEach(diary => {
        const syncMethod = diary.id ? API.updateAllDayEvent : API.insertAllDayEvent;
        const APIParam = {
          eventId: diary.id,
          summary: new MyDate(diary.date).strftime("%m/%d"),
          description: diary.value,
          start: diary.date,
          location: this.DIARY_LABEL
        };
        const callback = res => {
          idb.getDiary(diary.date).then(currentDiary => {
            if (currentDiary.timestamp == diary.timestamp) {
              diary.isSynced = TRUE;
              diary.timestamp = new Date(res.result.updated).getTime();
            }
            diary.calendarId = this.calendarId;
            diary.id = res.result.id;
            diary.link = res.result.htmlLink;
            idb.setDiary(diary);
          })
        };
        syncMethod.bind(API)(APIParam).then(callback)
          .catch(error => {
            if (error.status == 404) {
              API.insertAllDayEvent(APIParam).then(callback)
            }
          })
      })
    })
  }
  fetch() {
    const timeMax = new Date(Date.now() + ONEDAY_MS).toISOString();
    const timeMin = new Date(Date.now() - ONEDAY_MS * 365).toISOString();
    return API.listEvent({
      calendarId: this.calendarId,
      timeMax,
      timeMin,
      q: this.DIARY_LABEL
    }).then(res => {
      res.result.items.forEach(item => {
        if (!item.start.date) return;

        const date = new Date(item.start.date);
        date.setHours(0, 0, 0, 0);
        idb.syncDiary(new Diary({
          calendarId: this.calendarId,
          date,
          id: item.id,
          value: item.description,
          timestamp: new Date(item.updated).getTime(),
          isSynced: TRUE,
          link: item.htmlLink
        }))
      })
    })
  }
}
/**
 * Routineページのコンテナ
 * - `data-action="open"`属性：クリックされるとモーダルを開く
 * - `data-action="start"`属性：クリックされるとルーティンを開始
 * - `data-action="edit"`属性：クリックされるとルーティンを編集
 * - `data-action="delete"`属性：クリックされるとルーティンを削除
 * - `data-role="modal"`: モーダル
 * 
 * @class RoutineContainer
 * @extends {HTMLElement}
 */
class RoutineContainer extends HTMLDivElement {
  container;
  modal;
  routineList;
  editingRoutine;

  connectedCallback() {
    Store.onChange(storeKeys.doingAct, this);

    this.container = this.querySelector('[data-role="container"]');
    this.modal = this.querySelector('routine-modal');
    this.addEventListener("click", e => {
      const target = e.target.closest("[data-action]");
      if (target && this[target.dataset.action]) {
        this[target.dataset.action](target.closest(".routine_item"));
      }
    })
    this._init();
    this.modal.addEventListener("update", this.routineUpdateHandler.bind(this));
    this.modal.addEventListener("delete", () => this.delete(this.editingRoutineItem));
  }
  _init() {
    new Sortable(this.container, {
      animation: 150,
      handle: ".sortable-handle",
      selectedClass: "sortable-ghost",
      ghostClass: "sortable-ghost",
      onUpdate: evt => {
        this.updateRoutineOrder();
      },
    });
    this.updateRoutineList().then(() => {
      this.routineList.forEach(routine => {
        this.container.appendChild(this.renderContents(routine));
      });
    })
  }
  update({ key, value }) {
    this[key] = value;
  }
  renderContents(routine) {
    const li = document.createElement("li");
    li.classList.add("is-flex", "routine_item", "box", "p-0");
    li.id = routine.id;
    li.innerHTML = `
      <div class="routine_details sortable-handle"><span class="button"><svg class="icon"><use xlink:href="#icon-arrows-v"></use></svg></span></div>
      <div class="routine_details"><button class="button" data-action="start"><svg class="icon has-text-primary is-clickable"><use xlink:href="#icon-play-outline"></use></svg></button></div>
      <div class="routine_details has-text-weight-bold is-size-7 routine_summary"><span ${routine.color ? 'style="background: linear-gradient(transparent 60% , ' + routine.color.value + ', transparent 110%);"' : ""}>${routine.summary}</span></div>
      <div class="routine_details"><button class="button" data-action="edit"><svg class="icon has-text-danger-dark is-clickable"><use xlink:href="#icon-pencil"></use></svg></button></div>
    `;
    return li;
  }
  routineUpdateHandler() {
    if (this.routineList.length === this.editingRoutine.order) {
      this.container.appendChild(this.renderContents(this.editingRoutine));
    } else {
      this.editingRoutineItem.innerHTML = this.renderContents(this.editingRoutine).innerHTML;
    }
    this.updateRoutineList();
  }
  updateRoutineList() {
    return idb.getIndexAllRoutine("order").then(list => this.routineList = list);
  }
  updateRoutineOrder() {
    let queue = Promise.resolve();
    [...this.container.children].forEach((li, idx) => {
      queue = queue.then(() => {
        return idb.updateRoutine(Number(li.id), routine => {
          routine.order = idx;
          return routine;
        })
      });
    })
    queue.then(() => this.updateRoutineList());
  }
  open(routineItem) {
    this.editingRoutine = new Routine({ order: this.routineList.length });
    this.modal.open(this.editingRoutine, false);
  }
  edit(routineItem) {
    this.editingRoutineItem = routineItem;
    this.editingRoutine = this.routineList.find(routine => routine.id === Number(routineItem.id));
    this.modal.open(this.editingRoutine, true);
  }
  delete(routineItem) {
    routineItem.remove();

    idb.deleteRoutine(Number(routineItem.id))
      .then(() => {
        this.updateRoutineOrder();
      });
  }
  start(routineItem) {
    if (this.doingAct) return;

    const startRoutine = this.routineList.find(routine => routine.id === Number(routineItem.id));
    Store.set(storeKeys.toBeStartedAct, new Routine(startRoutine).getAct());
    Store.set(storeKeys.summaryToView, startRoutine.summary);
    Store.set(storeKeys.descriptionToView, startRoutine.description);
  }

}
/**
 * Routineページのモーダル
 * - `data-action="close"`属性：クリックされるとモーダルを閉じる
 * - `data-action="apply"`属性：クリックされると設定を保存
 * - `data-action="delete"`属性：クリックされると現在のルーティンを削除
 * - `data-role="modalTitle"`属性：モーダルのヘッダー
 * - `data-role="summary"`属性：ルーティンのサマリー
 * - `data-role="description"`属性：ルーティンの詳細
 * - `data-role="color"`属性：ルーティンのイベントカラー
 * - `data-role="samecolor"`属性：Actのイベントカラーと同じチェックボックス
 * 
 * @class RoutineModal
 * @extends {HTMLElement}
 */
class RoutineModal extends HTMLElement {
  editingRoutine;
  connectedCallback() {
    this.querySelectorAll("[data-role]").forEach(elm => {
      this[elm.dataset.role] = elm;
    });
    this.samecolor.addEventListener("change", this._samecolorOnChange.bind(this));
    this.querySelectorAll("[data-action]").forEach(elm => {
      elm.addEventListener("click", this[`_${elm.dataset.action}`].bind(this));
    })
  }
  open(routine, isEdit) {
    if (isEdit) {
      this.modalTitle.innerHTML = "編集";
      this.deleteButton.style.display = "flex";
    } else {
      this.modalTitle.innerHTML = "新しいRoutine";
      this.deleteButton.style.display = "none";
    }
    this.editingRoutine = routine;
    this.classList.add("is-active");
    this.summary.value = routine.summary;
    this.description.value = routine.description;
    if (routine.color) {
      this.samecolor.checked = false;
      this.color.value = routine.color.id;
      this.color.disabled = false;
    } else {
      this.samecolor.checked = true;
      this.color.disabled = true;
    }
  }
  _samecolorOnChange(e) {
    this.color.disabled = e.target.checked;
  }
  _close(e) {
    this.classList.remove("is-active");
  }
  _delete(e) {
    e.stopPropagation();
    this.dispatchEvent(new Event("delete"));
    this._close();
  }
  _apply(e) {
    e.stopPropagation();
    this.editingRoutine.summary = this.summary.value;
    this.editingRoutine.description = this.description.value;
    if (!this.samecolor.checked && this.color.value) {
      this.editingRoutine.color = { id: this.color.value, value: this.color.colorValue };
    } else {
      this.editingRoutine.color = null;
    }

    idb.updateRoutine(this.editingRoutine.id, routine => {
      return this.editingRoutine;
    }).then(() => this.dispatchEvent(new Event("update")));

    this.classList.remove("is-active");
  }
}
/**
 * todoのコンテナ
 * data-role="selectList"
 * data-role="tasks"
 * @class ToDoContainer
 * @extends {HTMLDivElement}
 */
class ToDoContainer extends HTMLDivElement {
  toDolists;
  constructor() {
    super();
    this.toDoLists = new Map();
  }
  connectedCallback() {
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.settings, this);

    this.querySelectorAll("[data-role]").forEach(elm => {
      this[elm.dataset.role] = elm;
    })
    this.selectList.addEventListener("selectlist", this._selectListHandler.bind(this));
  }
  /**
   * @param {Object} object
   * @param {Settings | Boolean} object.value
   * @memberof ToDoContainer
   */
  update({ key, value }) {
    switch (key) {
      case storeKeys.isSignedIn:
      case storeKeys.settings:
        this[key] = value;
        if (this.isSignedIn && this.settings.todoEnabled) {
          this.synchronize();
        }
        break;
      default:
    }
  }
  async synchronize() {
    const res = await API.listTasklist();
    console.log(res);

    /** @type {Array<TaskList>} */const cloudTaskLists = [];
    res.result.items.forEach(item => {
      const taskList = TaskList.fromAPI(item);
      cloudTaskLists.push(taskList);
    })
    cloudTaskLists.sort((a, b) => a.id < b.id ? -1 : 1);

    /** @type {Array<TaskList>} */const localTaskLists = await idb.getAllTaskList();
    let iCloudList = 0;
    let iLocalList = 0;
    const waitResult = [];
    let syncCase;
    const sameIdExsist = 0;
    const onlyCloud = 1;
    const onlyLocal = 2;
    while (iCloudList < cloudTaskLists.length || iLocalList < localTaskLists.length) {
      const cTaskList = cloudTaskLists[iCloudList];
      const lTaskList = localTaskLists[iLocalList];

      if (!cTaskList) { syncCase = onlyLocal }
      else if (!lTaskList) { syncCase = onlyCloud }
      else if (cTaskList.id > lTaskList.id) { syncCase = onlyLocal }
      else if (cTaskList.id < lTaskList.id) { syncCase = onlyCloud }
      else if (cTaskList.id === lTaskList.id) { syncCase = sameIdExsist }

      switch (syncCase) {
        case sameIdExsist:
          // sync proc
          waitResult.push(this._syncTaskList(cTaskList, lTaskList));
          iCloudList++;
          iLocalList++;
          break;

        case onlyCloud:
          // add local
          waitResult.push(idb.setTaskList(cTaskList));
          iCloudList++;
          break;

        case onlyLocal:
          if (SyncAction.INSERT.isSame(lTaskList.action)) {
            // insert cloud
            waitResult.push(ToDoUtils.insertTaskList(lTaskList));
          } else {
            // remove local
            waitResult.push(ToDoUtils.deleteTaskList(lTaskList, false));
          }
          iLocalList++;
          break;
        default:
      }
    }
    console.log("taskList check done.");
    await Promise.all(waitResult);
    console.log("taskList proc done.");

    // tasks synchronize
    const latestTaskLists = await idb.getAllTaskList();
    const cloudTasks = [];
    for (const taskList of latestTaskLists) {
      const result = API.listTask(taskList.id).then(res => {
        if (res.result.items)
          res.result.items.forEach(item => {
            const task = Task.fromAPI(item);
            task.listId = taskList.id;
            cloudTasks.push(task);
          });
      });
      waitResult.push(result);
    }

    const localTaskFamilies = this._makeFamily(await idb.getAllTask());
    await Promise.all(waitResult);
    const cloudTaskFamilies = this._makeFamily(cloudTasks);
    console.log("getting all task done.");
    console.dir('cloudTaskFamilies: ', cloudTasks);

    await this._verifyTasks(cloudTaskFamilies, localTaskFamilies);

    console.log("task proc done.")
    this.selectList.init();
  }

  /**
   * @param {Array<Task>} cloudTasks
   * @param {Array<Task>} localTasks
   * @memberof ToDoContainer
   */
  async _verifyTasks(cloudTasks, localTasks) {
    const waitResult = [];
    let iCloudTask = 0;
    let iLocalTask = 0;
    let syncCase;
    const sameIdExsist = 0;
    const onlyCloud = 1;
    const onlyLocal = 2;

    while (iCloudTask < cloudTasks.length || iLocalTask < localTasks.length) {
      const cTask = cloudTasks[iCloudTask];
      const lTask = localTasks[iLocalTask];

      if (!cTask) { syncCase = onlyLocal }
      else if (!lTask) { syncCase = onlyCloud }
      else if (cTask.id > lTask.id) { syncCase = onlyLocal }
      else if (cTask.id < lTask.id) { syncCase = onlyCloud }
      else if (cTask.id === lTask.id) { syncCase = sameIdExsist }

      switch (syncCase) {
        case sameIdExsist:
          // sync proc
          waitResult.push(this._syncTask(cTask, lTask));

          iCloudTask++;
          iLocalTask++;
          break;

        case onlyCloud:
          // add local
          if (cTask.children) {
            for (const child of cTask.children) {
              waitResult.push(idb.setTask(child));
            }
            delete cTask.children;
          }
          waitResult.push(idb.setTask(cTask));
          iCloudTask++;
          break;

        case onlyLocal:
          if (SyncAction.INSERT.isSame(lTask.action)) {
            // insert cloud
            const newId = await ToDoUtils.insertTask(lTask);
            if (lTask.children) {
              for (const child of lTask.children) {
                child.parent = newId;
                waitResult.push(ToDoUtils.insertTask(child));
              }
            }
          } else {
            // remove local
            waitResult.push(ToDoUtils.deleteTask(lTask, false));
          }
          iLocalTask++;
          break;
        default:
      }
    }

    await Promise.all(waitResult);
  }
  /**
   *
   *
   * @param {TaskList} cTaskList
   * @param {TaskList} lTaskList
   * @memberof ToDoContainer
   */
  async _syncTaskList(cTaskList, lTaskList) {
    if (SyncAction.DELETE.isSame(lTaskList.action)) {
      await API.deleteTaskList(cTaskList).then(async () => {
        await idb.deleteTaskList(lTaskList.id);
      });
    } else if (cTaskList.updated.getTime() === lTaskList.updated.getTime()) {
      // do nothing
    } else if (cTaskList.updated.getTime() > lTaskList.updated.getTime()) {
      await idb.setTaskList(cTaskList);
    } else {
      await API.updateTaskList(lTaskList).then(async res => {

        await idb.updateTaskList(lTaskList.id, /** @param {TaskList}taskList */taskList => {
          taskList.isSynced = true;
          taskList.action = null;
          taskList.updated = new Date(res.result.updated);
          return taskList;
        });
      })
    }
  }
  /**
   *
   *
   * @param {Task} cTask
   * @param {Task} lTask
   * @memberof ToDoContainer
   */
  async _syncTask(cTask, lTask) {
    if (cTask.listId !== lTask.listId && cTask.updated.getTime() < lTask.updated.getTime()) {
      await ToDoUtils.transferTask(cTask, lTask);
    } else if (SyncAction.DELETE.isSame(lTask.action)) {
      await ToDoUtils.deleteTask(lTask);
    } else {
      if (cTask.children || lTask.children) {
        await this._verifyTasks(cTask.children ? cTask.children : [], lTask.children ? lTask.children : []);
        delete cTask.children;
        delete lTask.children;
      }
      if (cTask.updated.getTime() >= lTask.updated.getTime()) {
        await idb.setTask(cTask);
      } else {
        await ToDoUtils.updateTask(lTask);
      }
    }
  }

  _makeFamily(tasks) {
    const retList = [];
    const lostChildren = [];
    tasks.forEach(task => {
      if (task.parent) {
        lostChildren.push(task);
      } else {
        retList.push({ ...task });
      }
    })
    lostChildren.forEach(child => {
      const parent = retList.find(task => task.id === child.parent);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push({ ...child });
      } else {
        delete child.parent;
        retList.push({ ...child });
      }
    })
    retList.sort((a, b) => a.id < b.id ? -1 : 1);
    retList.forEach(task => { if (task.children) task.children.sort((a, b) => a.id < b.id ? -1 : 1) });

    return retList;
  }
  _selectListHandler(e) {
    this.tasks.show(e.detail);
  }
}
/**
 * todoリストのセレクトボックス
 * 
 * - `data-action="open"`: 
 * - `data-action="select"`: 
 * - `data-action="addList"`: 
 * - `data-role="sentinel"`: 
 * - `data-role="currentListName"`: 
 * - `data-role="modal"`: 
 * - `data-role="sortable`"
 *
 * @class SelectToDoList
 * @extends {HTMLElement}
 */
class SelectTaskList extends HTMLElement {
  _selectedTaskListItem;
  _selectedTaskListId;
  constructor() {
    super();
    this.close = this._close.bind(this);
  }
  connectedCallback() {
    Store.onChange(storeKeys.listInserted, this);

    this.classList.add("dropdown");
    this.innerHTML = `
      <div data-action="open" class="dropdown-trigger">
        <button class="button">
          <span data-role="currentListName" style="overflow: hidden;"></span>
          <span class="icon is-small" style="flex-shrink: 0;">
            <svg width="12" height="12"><use xlink:href="#icon-chevron-down"></use></svg>
          </span>
        </button>
      </div>
      <div class="dropdown-menu override">
        <div data-role="sortable" class="dropdown-content">
          <hr data-role="sentinel" class="dropdown-divider">
          <a data-action="addList" class="dropdown-item">新しいリストを作成</a>
        </div>
      </div>
      <tasklist-modal data-role="modal"></tasklist-modal>
    `;
    this.querySelectorAll("[data-role]").forEach(elm => {
      this[elm.dataset.role] = elm;
    })
    this.addEventListener("click", e => {
      const target = e.target.closest("[data-action]");
      if (target && this[`_${target.dataset.action}`]) {
        this[`_${target.dataset.action}`](e, target);
      }
    });
    this.init();
    this.addEventListener("tasklistedit", e => this.modal.open(e.target));
    this.addEventListener("tasklistdelete", this._taskListDeleteHandler.bind(this));
    this.modal.addEventListener("modaladd", this._modalAddHandler.bind(this));
    this.modal.addEventListener("modaledit", () => this._updateCurrentListName());

    new Sortable(this.sortable, {
      animation: 150,
      draggable: ".sortable_item",
      delay: 60,
      delayOnTouchOnly: true,
      onUpdate: evt => this._updateOrder()
    });
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.listInserted:
        this.init();
    }
  }
  _noItemView(flag) {
    if (flag) {
      this.classList.add("no_item");
      this.currentListName.innerHTML = "ここから新しいリスト作りましょう";
    } else {
      this.classList.remove("no_item");
    }
  }
  async init() {
    const taskListsList = await idb.getIndexAllTaskList("order");

    this.render(taskListsList);
    if (this.sortable.querySelectorAll("tasklist-item").length === 0) {
      this._noItemView(true);
    } else {
      this._noItemView(false);
      if (!this._selectedTaskListItem) {
        this.sortable.firstElementChild.dispatchEvent(new Event("click", { "bubbles": true }));
      }
    }
  }
  render(taskLists) {
    this._selectedTaskListItem = null;
    this.sortable.querySelectorAll("tasklist-item").forEach(taskListItem => taskListItem.remove());

    taskLists.forEach(taskList => {
      if (SyncAction.DELETE.isSame(taskList.action)) {
        return;
      } else if (this._selectedTaskListId === taskList.id || this.currentListName.innerHTML === taskList.title) {
        const selected = this._renderList(taskList, true);
        selected.dispatchEvent(new Event("click", { "bubbles": true }));
      } else {
        this._renderList(taskList, false);
      }
    });
  }
  _renderList(taskList, isActive) {
    const taskListItem = document.createElement("tasklist-item");
    taskListItem.init(taskList);
    if (isActive) {
      this.currentListName.innerHTML = taskList.title;
      taskListItem.activate();
    }
    this.sentinel.insertAdjacentElement('beforebegin', taskListItem);
    return taskListItem;
  }
  _open(e) {
    if (this.classList.toggle("is-active")) {
      setTimeout(() => document.addEventListener("click", this.close), 0);
    }
  }
  _close() {
    this.classList.remove("is-active");
    document.removeEventListener("click", this.close);
  }
  _updateOrder() {
    this.sortable.querySelectorAll(".sortable_item").forEach((tli, idx) => {
      idb.updateTaskList(tli.id, tl => {
        tl.order = idx;
        return tl;
      })
    })
  }
  _addList() {
    this.modal.open();
  }
  _select(e, target) {
    this.querySelectorAll("tasklist-item").forEach(taskListItem => taskListItem.deactivate());
    target.activate();
    this._selectedTaskListItem = target;
    this._updateCurrentListName();
    this._selectedTaskListId = target.id;

    this.dispatchEvent(new CustomEvent("selectlist", { detail: target }));
  }
  _updateCurrentListName() {
    this.currentListName.innerHTML = this._selectedTaskListItem.taskList.title;
  }
  _modalAddHandler(e) {
    this._noItemView(false);
    this._renderList(e.detail).dispatchEvent(new Event("click", { "bubbles": true }));
    this._updateOrder();
  }
  _taskListDeleteHandler(e) {
    const toActivateList = e.target.previousElementSibling ?
      e.target.previousElementSibling :
      e.target.nextElementSibling;
    if (toActivateList === this.sentinel) {
      this._noItemView(true);
      this.dispatchEvent(new CustomEvent("selectlist", { detail: null }));
    } else {
      if (e.target.classList.contains("is-active")) {
        toActivateList.dispatchEvent(new Event("click", { "bubbles": true }));
      }
    }
    e.target.remove();
  }
  get value() { return this._selectedTaskListId }
}

class TaskListItem extends HTMLElement {
  /** @type {TaskList} */  taskList;
  /**
   * @param {TaskList} taskList
   * @memberof TaskListItem
   */
  init(taskList) {
    this.taskList = taskList;
    this.id = taskList.id;
    this.title = taskList.title;
    this.setAttribute("data-action", "select");
    this.classList.add("dropdown-item", "sortable_item", "is-flex", "pr-2");
    this.innerHTML = `
    <span data-role="listTitle">${taskList.title}</span>
    <span data-action="edit" class="button p-0"><svg class="has-text-danger-dark" width="16" height="16"><use xlink:href="#icon-pencil"></use></svg></span>
    `;

    this.querySelectorAll("[data-role]").forEach(elm => {
      this[elm.dataset.role] = elm;
    });

    this.querySelectorAll("[data-action]").forEach(elm => {
      elm.addEventListener("click", this[`_${elm.dataset.action}`].bind(this))
    });
  }
  activate() { this.classList.add("is-active") }
  deactivate() { this.classList.remove("is-active") }
  update(taskList) {
    this.taskList = taskList;
    ToDoUtils.updateTaskList(taskList);
    this.title = this.listTitle.innerHTML = taskList.title;
  }
  _edit(e) {
    this.dispatchEvent(new CustomEvent("tasklistedit", { bubbles: true }));
  }
  async delete(e) {
    try {
      await ToDoUtils.deleteTaskList(this.taskList);
    } catch (e) {
      console.log(e);
      return;
    }
    this.dispatchEvent(new CustomEvent("tasklistdelete", { bubbles: true }));

  }
}

/**
 * taskListのモーダル
 * - `data-action="close"`属性：クリックされるとモーダルを閉じる
 * - `data-action="delete"`属性：クリックされるとtaskListを削除
 * - `data-action="apply"`属性：クリックされると設定を保存
 * - `data-role="header"`属性：モーダルのヘッダー
 * - `data-role="listTitle"`属性：taskListのタイトル
 *
 * @class TaskListModal
 * @extends {HTMLElement}
 */
class TaskListModal extends HTMLElement {
  connectedCallback() {
    this.classList.add("modal");
    this.innerHTML = `
        <div data-action="close" class="modal-background"></div>
        <div class="modal-card" style="width: 300px">
          <header class="modal-card-head p-3">
            <p data-role="header" class="modal-card-title is-size-6"></p>
            <span data-role="deleteButton" data-action="delete" class="is-flex is-clickable mr-3" title="削除">
              <svg width="20" height="20"><use xlink:href="#icon-trashcan"></use></svg>
            </span>
            <button data-action="close" class="delete" aria-label="close"></button>
          </header>
          <section class="modal-card-body">
            <input type="text" data-role="listTitle" class="input" placeholder="title">
          </section>
          <footer class="modal-card-foot">
            <button data-action="apply" class="button is-link">保存</button>
            <button data-action="close" class="button is-link is-light">キャンセル</button>
          </footer>
        </div>
      `;
    this.querySelectorAll("[data-role]").forEach(elm => {
      this[elm.dataset.role] = elm;
    });
    this.querySelectorAll("[data-action]").forEach(elm => {
      elm.addEventListener("click", this[`_${elm.dataset.action}`].bind(this))
    });
    this.addEventListener("click", e => e.stopPropagation());
  }
  /**
   * @param {TaskListItem} taskListItem
   * @memberof TaskListModal
   */
  open(taskListItem) {
    this.classList.add("is-active");
    this.listTitle.focus();
    if (taskListItem) {
      this.editingTaskListItem = taskListItem;
      this.editingTaskList = { ...taskListItem.taskList };
      this.header.innerHTML = "名前の変更・削除";
      this.deleteButton.style.visibility = "visible";
      this.listTitle.value = taskListItem.taskList.title;
    } else {
      this.header.innerHTML = "新規作成";
      this.deleteButton.style.visibility = "hidden";
      this.editingTaskList = new TaskList({});
    }
  }
  _close() {
    this.classList.remove("is-active");
    this.listTitle.value = "";
  }
  _delete() {
    this.editingTaskListItem.delete();
    delete this.editingTaskListItem;
    this._close();
  }
  async _apply() {
    this.editingTaskList.isSynced = false;
    this.editingTaskList.action = SyncAction.UPDATE;
    this.editingTaskList.title = this.listTitle.value;
    this.editingTaskList.updated = new Date();
    if (this.editingTaskListItem) {
      this.editingTaskListItem.update(this.editingTaskList);
      delete this.editingTaskListItem;
      this.dispatchEvent(new CustomEvent("modaledit"));
    } else {
      this.editingTaskList.id = Date.now().toString();
      this.editingTaskList.action = SyncAction.INSERT;
      ToDoUtils.insertTaskList(this.editingTaskList);
      this.dispatchEvent(new CustomEvent("modaladd", { detail: this.editingTaskList }));
    }
    this._close();
  }
}

/**
 * - `data-role="mainArea"`
 * - `data-role="subTasks"`
 * - `data-role="subTaskItemList"`
 * - `data-role="newSubTaskTitle"`
 * - `data-role="start"`: start button
 * - `data-role="radio"`
 * - `data-role="complete"`
 * - `data-action="view"`
 * - `data-action="start"`
 * - `data-action="edit"`
 * - `data-action="delete"`
 * - `data-action="complete"`
 * - `data-action="subAdd"`
 *
 * @class TaskItem
 * @extends {HTMLElement}
 */
class TaskItem extends HTMLElement {
  /** @type {Task} */   _task;
  /** @type {Number} */ DURATION = 100;
  set task(task) {
    this._task = task;
    this.id = task.id;
  }
  get task() { return this._task; }
  init(task) {
    this.classList.add("p-0", "task_item", task.parent ? "sub" : "parent", "ce-block");

    this.task = task;
    this.innerHTML = this._render(task);
    this._updateContent();

    this.querySelectorAll("[data-role]").forEach(elm => {
      this[elm.dataset.role] = elm;
    });
    this.addEventListener("click", e => {
      e.stopPropagation();
      const target = e.target.closest("[data-action]");
      if (target && this[`_${target.dataset.action}`]) {
        this[`_${target.dataset.action}`](e, target);
      }
    });

    if (!task.parent) {
      this.classList.add("box");
      this.complete.addEventListener("mouseenter", this._hoverHandler.bind(this));
      this.complete.addEventListener("mouseleave", this._hoverHandler.bind(this));
      this.subTaskItemList.addEventListener("taskdelete", e => {
        e.stopPropagation();
        setTimeout(() => this.mainArea.innerHTML = this._renderMain(this.task), 0);
      });
      this.subTaskItemList.addEventListener("taskincomplete", e => {
        e.stopPropagation();
        this.subTaskItemList.insertAdjacentElement("afterbegin", e.target);
        this.mainArea.innerHTML = this._renderMain(this.task);
        this._updateOrder();
      })
      this.subTaskItemList.addEventListener("taskcomplete", e => {
        e.stopPropagation();
        this.subTaskItemList.insertAdjacentElement("beforeend", e.target);
        this.mainArea.innerHTML = this._renderMain(this.task);
        this._updateOrder();
      })
      this.newSubTaskTitle.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          this._subAdd();
          e.target.blur();
        }
      });
    }
  }
  _render(task) {
    return task.parent ? `
      <div data-role="mainArea" class="is-flex"></div>
    ` : `
      <input type="radio" data-role="radio" name="tasks" id="radio${task.id}" hidden ${TaskStatus.completed.isSame(task.status) ? "disabled" : ""}>
      <div data-role="mainArea" class="is-flex"></div>
      <div data-role="subTasks">
        <div data-role="subTaskItemList"></div>
        <div class="field has-addons m-0">
          <div class="control">
            <input data-role="newSubTaskTitle" class="input" type="text" placeholder="新しいサブタスク">
          </div>
          <div class="control">
            <button data-action="subAdd" class="button is-info">追加</button>
          </div>
        </div>
      </div>
    `
  }
  _renderMain(task) {
    const isComp = TaskStatus.completed.isSame(task.status);
    const fontColor = isComp ?
      "is-link" :
      task.due ?
        task.due - Date.now() < ONEDAY_MS ?
          "is-danger" :
          task.due - Date.now() < 3 * ONEDAY_MS ?
            "is-warning" :
            "is-primary" :
        "";
    const subTaskLen = this.subTaskItemList ? this.subTaskItemList.children.length : 0;
    const subTaskCompLen = subTaskLen > 0 ? [...this.subTaskItemList.children].filter(i => TaskStatus.completed.isSame(i.task.status)).length : 0;
    return `
      ${task.parent ? "" : '<div class="task_details sortable-handle"><span class="button"><svg class="icon"><use xlink:href="#icon-arrows-v"></use></svg></span></div>'}
      <div ${isComp ? "" : 'data-action="start"'} class="task_details"><button data-role="start" class="button" ${isComp ? "disabled" : ""}><svg class="icon has-text-primary"><use xlink:href="#icon-play-outline"></use></svg></button></div>
      <div class="task_details task_title is-size-7"><label data-action="view" for="radio${task.id}">
        ${task.links ?
        `<p class="task_title_text has-text-weight-bold"><a href="${task.links[0].link}" target="_blank" rel="noreferrer">${task.title}</a></p>` :
        `<p class="task_title_text has-text-weight-bold">${task.title}</p>`
      }
        ${isComp || task.due ?
        `<div class="tags has-addons mr-1">
            <span class="tag  p-1 ${isComp ? "" : "is-light"} ${fontColor}">
              <svg style="width:15px;height:15px"><use xlink:href="${isComp ? '#icon-check' : '#icon-calendar'}"></use></svg>
            </span>
            ${isComp ?
          `<span class="tag  p-1 ${fontColor} is-light">${new MyDate(task.completed).strftime("%m/%d %H:%M")}</span>` :
          `<span class="tag  p-1 ${fontColor}">${new MyDate(task.due).strftime("%m/%d")}</span>`
        }
          </div>`: ""
      }
        ${subTaskLen > 0 ?
        `<div class="tags has-addons">
            <span class="tag p-1">sub/cmp</span>
              <span class="tag p-1 is-dark">${subTaskLen}/${subTaskCompLen}</span>
          </div>`: ""
      }

      </label></div>
      ${isComp ?
        '<div data-action="delete" class="task_details"><span class="button"><svg class="icon has-text-grey-light"><use xlink:href="#icon-trashcan"></use></svg></span></div>' :
        '<div data-action="edit" class="task_details"><button class="button"><svg class="icon has-text-danger-dark"><use xlink:href="#icon-pencil"></use></svg></button></div>'
      }
      <div data-action="complete" data-role="complete" class="task_details" title="${isComp ? "未完了に戻す" : "完了とする"}"><span class="button"><svg class="icon has-text-grey-light is-clickable"><use xlink:href="#icon-check"></use></svg></span></div>
    `
  }
  _subAdd(e, target) {
    const newSubTask = new Task({
      id: Date.now().toString(),
      listId: this.task.listId,
      parent: this.id,
      title: this.newSubTaskTitle.value,
      action: SyncAction.INSERT
    });
    this.newSubTaskTitle.value = "";
    idb.setTask(newSubTask);
    const newTaskItem = document.createElement("task-item");
    newTaskItem.init(newSubTask);
    ToDoUtils.insertTask(newSubTask, newTaskItem);
    this.addSubTask(newTaskItem, 'afterbegin');
  }

  /** @param {TaskItem} taskItem   */
  addSubTask(taskItem, position = 'beforeend') {
    if (!this.sortableSubTask) {
      this.sortableSubTask = new Sortable(this.subTaskItemList, {
        animation: 150,
        draggable: ".task_item",
        filter: ".completed",
        delay: 60,
        delayOnTouchOnly: true,
        onUpdate: e => this._updateOrder(e)
      });
    }
    this.subTaskItemList.insertAdjacentElement(position, taskItem);
    this.mainArea.innerHTML = this._renderMain(this.task);
    taskItem._animateThis();
    this._updateOrder();
  }
  async update(updatedTask) {
    if (this.task.listId === updatedTask.listId) {
      ToDoUtils.updateTask(updatedTask);
      this.task = updatedTask;
      this.mainArea.innerHTML = this._renderMain(this.task);
    } else {
      const res = confirm("LoGoCaでリンク付きのタスクを移動すると、リンクの情報が破棄されます。\n続行しますか？");
      if (res) {
        updatedTask.position = - Date.now();
        ToDoUtils.transferTask(this.task, updatedTask);
        this._animateNext();
        this.remove();
      }
    }
  }
  _updateContent() {
    if (TaskStatus.completed.isSame(this.task.status)) {
      this.style.order = String(this.task.position).substr(2, 9);
      this.classList.add("completed");
      this.setAttribute("data-completed", this.task.completed.getTime());
      if (this.radio) {
        this.radio.checked = false;
        this.radio.disabled = true;
      }
    } else {
      this.style.order = "";
      this.classList.remove("completed");
      if (this.radio) this.radio.disabled = false;
    }
    this.querySelector('[data-role="mainArea"]').innerHTML = this._renderMain(this.task);
  }
  async _complete(e, target) {
    this._hoverHandler({ type: "mouseleave" });
    if (TaskStatus.completed.isSame(this.task.status)) {

      this.task.status = TaskStatus.needsAction;
      this.task.completed = undefined;
      this.task.position = 0;
      this.task.isSynced = false;
      this.task.updated = new Date();

      ToDoUtils.updateTask(this.task);
      this._updateContent();
      if (!this.task.parent) {
        if (this._animateNext()) this._animateThis();
      } else {
        if (this._animatePrev()) this._animateThis();
      }
      this.dispatchEvent(new CustomEvent("taskincomplete", { detail: this, bubbles: true }));
    } else {
      this.task.status = TaskStatus.completed;
      this.task.completed = new Date();
      this.task.position = Date.now();
      this.task.isSynced = false;
      this.task.updated = new Date();

      ToDoUtils.updateTask(this.task);
      this._updateContent();
      if (!this.task.parent) {
        [...this.subTaskItemList.children].forEach(taskItem => {
          if (TaskStatus.completed.isSame(taskItem.task.status)) return;
          taskItem._complete();
        });
      }
      if (this._animateNext()) this._animateThis();
      this.dispatchEvent(new CustomEvent("taskcomplete", { detail: this, bubbles: true }));
    }
  }
  _animateThis() {
    const length = window.getComputedStyle(this).height;
    this.animate(
      [{ height: "0px" }, { height: length }],
      { duration: this.DURATION, iterations: 1 }
    );
  }
  _animateNext() {
    const nextElm = this.nextElementSibling;
    if (nextElm) {
      const length = window.getComputedStyle(this).height;
      nextElm.animate(
        [{ marginTop: length }, { marginTop: "0px" }],
        { duration: this.DURATION, iterations: 1 }
      );
      return true;
    } else {
      return false;
    }
  }
  _animatePrev() {
    const prevElm = this.previousElementSibling;
    if (prevElm) {
      const length = window.getComputedStyle(this).height;
      prevElm.animate(
        [{ marginBottom: length }, { marginBottom: "0px" }],
        { duration: this.DURATION, iterations: 1 }
      );
      return true;
    } else {
      return false;
    }
  }
  _view(e) {
    if (this.radio && this.radio.checked) {
      this.radio.checked = false;
      e.preventDefault();
    }
  }
  _start(e, target) {
    this.dispatchEvent(new CustomEvent("taskstart", { detail: this, bubbles: true }));
  }
  _edit(e, target) {
    this.dispatchEvent(new CustomEvent("taskedit", { detail: this, bubbles: true }));
  }
  _delete(e, target) {
    ToDoUtils.deleteTask(this.task);
    this.dispatchEvent(new CustomEvent("taskdelete", { bubbles: true }));
    if (this._animateNext() || this._animatePrev()) { /* do nothing */ }
    this.remove();
  }
  _hoverHandler(e) {
    const compCheckList = this.querySelectorAll('[data-action="complete"]');
    switch (e.type) {
      case "mouseenter":
        compCheckList.forEach(elm => elm.classList.add("hover"));
        break;
      case "mouseleave":
        compCheckList.forEach(elm => elm.classList.remove("hover"));
        break;
      default:
    }
  }
  _updateOrder(e) {
    if (e) { ToDoUtils.sortTask(e.item) }
    [...this.subTaskItemList.children].forEach((taskItem, idx) => {
      if (TaskStatus.completed.isSame(taskItem.task.status)) return;
      idb.updateTask(taskItem.id, task => {
        task.position = idx;
        return task;
      })
    })
  }


}

/** 選択されたtodoList内のtodoTaskを一覧表示するelement
 * - `data-role="newTaskTitle"`
 * - `data-role="container"`
 * - `data-role="modal"`
 * - `data-action="add"`
 * @class ToDoTasks
 * @extends {HTMLElement}
 */
class ToDoTasks extends HTMLElement {
  currentListId;
  taskItems;
  _initialized;

  connectedCallback() {
    Store.onChange(storeKeys.doingAct, this);
    this._init(true);

    this.querySelectorAll("[data-role]").forEach(elm => {
      this[elm.dataset.role] = elm;
    });
    this.addEventListener("click", e => {
      const target = e.target.closest("[data-action]");
      if (target && this[`_${target.dataset.action}`]) {
        this[`_${target.dataset.action}`](e, target);
      }
    });
    new Sortable(this.container, {
      animation: 150,
      handle: ".sortable-handle",
      draggable: ".task_item",
      onUpdate: e => this._updateOrder(e)
    });

    this.addEventListener("taskstart", this._taskStartHandler.bind(this));
    this.addEventListener("taskedit", e => this.modal.open(e.detail));
    this.addEventListener("taskcomplete", e => this.completed.add(e.detail));
    this.addEventListener("taskincomplete", e => {
      this.container.insertAdjacentElement("afterbegin", e.detail);
      this._updateOrder();
    });
    this.newTaskTitle.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        this._add();
        e.target.blur();
      }
    });
  }
  update({ key, value }) {
    this[key] = value;
  }

  _init(flag) {
    if (flag) {
      if (this._initialized) {
        return;
      } else {
        this._initialized = true;
        this.classList.add("is-hidden");
      }
    } else {
      if (this._initialized) {
        this._initialized = false;
        this.classList.remove("is-hidden");
      } else {
        return;
      }
    }
  }
  show(taskListItem) {
    if (taskListItem) {
      this._init(false);
      this.taskListItem = taskListItem;
      this.currentTaskList = taskListItem.taskList;
      this.currentListId = taskListItem.id;
      this._render(taskListItem.id);
    } else {
      this._init(true);
    }
  }
  async _render(listId) {
    this.container.innerHTML = "";
    this.completed.init();

    const tasks = await idb.getIndexAllTask("listId", ALL_TASK_LISTID(listId));
    this.taskItems = [];
    const lostChildren = [];
    tasks.forEach(task => {
      if (SyncAction.DELETE.isSame(task.action)) {
        return;
      } else if (task.parent) {
        lostChildren.push(task);
      } else {
        const taskItem = this._renderContent(task);
        this.taskItems.push(taskItem);
        if (TaskStatus.completed.isSame(task.status)) {
          this.completed.add(taskItem);
        } else {
          this.container.appendChild(taskItem);
        }
      }
    });
    lostChildren.forEach(task => {
      const parent = this.taskItems.find(taskItem => taskItem.id === task.parent);
      if (parent) {
        parent.addSubTask(this._renderContent(task));
      } else {
        delete task.parent;
        const independentTaskItem = this._renderContent(task);
        if (TaskStatus.completed.isSame(task.status)) {
          this.completed.add(independentTaskItem);
        } else {
          this.container.appendChild(independentTaskItem);
        }
      }
    })
  }
  _renderContent(task) {
    const taskItem = document.createElement("task-item");
    taskItem.init(task);
    return taskItem;
  }
  _add() {
    const newTask = new Task({
      id: Date.now().toString(),
      listId: this.currentListId,
      title: this.newTaskTitle.value,
      action: SyncAction.INSERT
    });
    this.newTaskTitle.value = "";
    const newTaskItem = this._renderContent(newTask);
    ToDoUtils.insertTask(newTask, newTaskItem);
    this.taskItems.push(newTaskItem);
    this.container.insertAdjacentElement('afterbegin', newTaskItem);
    this._updateOrder();
  }
  _updateOrder(e) {
    if (e) { ToDoUtils.sortTask(e.item) }
    [...this.container.children].forEach((taskItem, idx) => {
      idb.updateTask(taskItem.id, task => {
        task.position = idx;
        return task;
      })
    })
  }
  _taskStartHandler(e) {
    if (this.doingAct) return;

    const act = new Act({
      summary: e.detail.task.title,
      description: e.detail.task.notes
    });
    Store.set(storeKeys.toBeStartedAct, act);
    Store.set(storeKeys.summaryToView, act.summary);
    Store.set(storeKeys.descriptionToView, act.description);
  }
}
/**
 * taskの編集モーダル
 * - `data-action="close"`属性：クリックされるとモーダルを閉じる
 * - `data-action="apply"`属性：クリックされると設定を保存
 * - `data-action="delete"`属性：
 * - `data-role="header"`属性：モーダルのヘッダー
 * - `data-role="taskTitle"`属性：taskのタイトルinput
 * - `data-role="taskNotes"`属性：taskのnotes, textbox
 * - `data-role="taskDue"`属性：taskのdue, input type="date"
 * - `data-role="listId"`属性：taskListのselectbox
 * 
 *
 * @class TaskListModal
 * @extends {HTMLElement}
 */
class TaskModal extends HTMLElement {
  currentTaskItem;
  connectedCallback() {
    this.classList.add("modal");
    this.innerHTML = `
        <div data-action="close" class="modal-background"></div>
        <div class="modal-card" style="width: 300px">
          <header class="modal-card-head p-3">
            <p data-role="header" class="modal-card-title is-size-6">編集</p>
            <span data-action="delete" class="is-clickable" title="削除">
              <svg class="icon"><use xlink:href="#icon-trashcan"></use></svg>
            </span>
            <button data-action="close" class="delete"></button>
          </header>
          <section class="modal-card-body">
            <div class="field">
              <input type="text" data-role="taskTitle" class="input" placeholder="title">
              <textarea data-role="taskNotes" class="textarea has-fixed-size" placeholder="詳細"></textarea>
            </div>
            <div class="field">
              <label class="label">期限</label>
              <div class="control">
                <input data-role="taskDue" type="date" class="input" min="1900-01-01">
              </div>
            </div>
            <div class="field">
              <label class="label">移動</label>
              <div class="select control">
                <select data-role="listId"></select>
              </div>
            </div>
          </section>
          <footer class="modal-card-foot">
            <button data-action="apply" class="button is-link">保存</button>
            <button data-action="close" class="button is-link is-light">キャンセル</button>
          </footer>
        </div>
      `;
    this.querySelectorAll("[data-role]").forEach(elm => {
      this[elm.dataset.role] = elm;
    });
    this.querySelectorAll("[data-action]").forEach(elm => {
      elm.addEventListener("click", this[`_${elm.dataset.action}`].bind(this))
    });
    this.addEventListener("click", e => e.stopPropagation());
  }
  async open(taskItem) {
    this.currentTaskItem = taskItem;
    this.classList.add("is-active");
    this.taskTitle.focus();

    this.listId.disabled = taskItem.task.parent ? true : false;
    this._fillForms(taskItem.task);
    this._genList(taskItem.task.listId);
  }
  _close() {
    this.classList.remove("is-active");
  }
  async _apply() {
    let due;
    if (this.taskDue.value) {
      due = new Date(this.taskDue.value);
      due.setHours(0, 0, 0, 0);
    } else {
      due = undefined;
    }

    const updatedTask = { ...this.currentTaskItem.task };
    updatedTask.title = this.taskTitle.value;
    updatedTask.notes = this.taskNotes.value;
    updatedTask.due = due;
    updatedTask.isSynced = false;
    updatedTask.updated = new Date();
    if (this.listId.value) updatedTask.listId = this.listId.value;

    this.currentTaskItem.update(updatedTask);
    this._close();
  }
  _delete() {
    this.currentTaskItem._delete();
    this._close();
  }
  async _genList(currentListId) {
    const lists = await idb.getIndexAllTaskList("order");
    let HTML = "";
    lists.forEach(list => {
      if (list.id === currentListId) {
        HTML = `<option value="" hidden>${list.title}</option>` + HTML;
      } else {
        HTML += `<option value="${list.id}">${list.title}</option>`;
      }
    });
    this.listId.innerHTML = HTML;
  }
  _fillForms(task) {
    if (task) {
      this.taskTitle.value = task.title;
      this.taskNotes.value = task.notes ? task.notes : "";
      this.taskDue.value = task.due ? new MyDate(task.due).strftime("%Y-%m-%d") : "";
    } else {
      this.taskTitle.value = "";
      this.taskNotes.value = "";
      this.taskDue.value = "";
    }
  }
}

/**
 * 完了したtaskのモーダル
 * - `data-action="open"`属性：クリックされるとモーダルを開く
 * - `data-action="close"`属性：クリックされるとモーダルを閉じる
 * - `data-role="buttonText"`属性：ボタンの表示テキスト
 * - `data-role="modal"`属性：モーダル
 * - `data-role="header"`属性：モーダルのヘッダー
 * - `data-role="container"`属性：タスクをリストするコンテナ
 *
 * @class CompletedTask
 * @extends {HTMLElement}
 */
class CompletedTask extends HTMLElement {
  _taskCnt;
  taskItems;
  connectedCallback() {
    this.innerHTML = `
      <span data-role="buttonText" data-action="open" class="button"></span>
      <div data-role="modal" class="modal">
        <div data-action="close" class="modal-background"></div>
        <div class="modal-card" style="height:450px">
          <header class="modal-card-head p-3">
            <p data-role="header" class="modal-card-title is-size-6">編集</p>
            <button data-action="close" class="delete"></button>
          </header>
          <section class="modal-card-body">
            <ul data-role="container"></ul>
          </section>
          <footer class="modal-card-foot">
            <button data-action="close" class="button is-link is-light">閉じる</button>
          </footer>
        </div>
      </div>
      `;
    this.querySelectorAll("[data-role]").forEach(elm => {
      this[elm.dataset.role] = elm;
    });
    this.querySelectorAll("[data-action]").forEach(elm => {
      elm.addEventListener("click", this[`_${elm.dataset.action}`].bind(this))
    });
    this.addEventListener("click", e => {
      e.stopPropagation();
      const target = e.target.closest("[data-action]");
      if (target && this[`_${target.dataset.action}`]) {
        this[`_${target.dataset.action}`](e, target);
      }
    });
    this.addEventListener("taskdelete", () => this.taskCnt--);
    this.addEventListener("taskincomplete", () => this.taskCnt--);
  }
  init() {
    this.taskCnt = 0;
    this.container.innerHTML = "";
  }
  add(taskItem) {
    this.taskCnt = this.taskCnt + 1;

    const idx = [...this.container.children].findIndex(li => li.dataset.completed < taskItem.dataset.completed);
    if (idx >= 0) {
      this.container.children[idx].insertAdjacentElement('beforebegin', taskItem);
    } else {
      this.container.appendChild(taskItem);
    }
  }
  _open() {
    this.modal.classList.add("is-active");
  }
  _close() {
    this.modal.classList.remove("is-active");
  }

  set taskCnt(val) {
    this._taskCnt = val;
    this.buttonText.innerHTML = `完了(${this._taskCnt}件)`;
  }
  get taskCnt() { return this._taskCnt }
}

const customTags = [
  {
    class: TabSwipeable,
    name: "tab-swipeable"
  },
  {
    class: AnotherAct,
    name: "another-act"
  },
  {
    class: SettingsModal,
    name: "settings-modal"
  },
  {
    class: UserImg,
    custom: "img",
    name: "user-img"
  },
  {
    class: UserEmail,
    name: "user-email"
  },
  {
    class: SelectCalendar,
    custom: "select",
    name: "select-cal"
  },
  {
    class: SelectLogCalendar,
    custom: "select",
    name: "select-log"
  },
  {
    class: NewCalendar,
    custom: "input",
    name: "new-cal"
  },
  {
    class: AddCalendar,
    custom: "button",
    name: "add-cal"
  },
  {
    class: EventColor,
    name: "eve-col"
  },
  {
    class: NotificationCheck,
    custom: "input",
    name: "notification-check"
  },
  {
    class: Summary,
    custom: "input",
    name: "act-summary"
  },
  {
    class: Description,
    name: "act-description"
  },
  {
    class: ActStart,
    custom: "button",
    name: "act-start"
  },
  {
    class: ActEnd,
    custom: "button",
    name: "act-end"
  },
  {
    class: TimeElapsed,
    name: "time-elapsed"
  },
  {
    class: NoticeShow,
    name: "notice-show"
  },
  {
    class: DoneAct,
    name: "done-act"
  },
  {
    class: DoneActList,
    name: "done-act-list"
  },
  {
    class: UpcomingAct,
    name: "upcoming-act"
  },
  {
    class: UpcomingActList,
    name: "upcoming-act-list"
  },
  {
    class: ToolTip,
    name: "tool-tip"
  },
  {
    class: QuillCommon,
    name: "quill-common"
  },
  {
    class: DiaryNav,
    name: "diary-nav"
  },
  {
    class: DiaryContainer,
    custom: "div",
    name: "diary-container"
  },
  {
    class: RoutineContainer,
    custom: "div",
    name: "routine-container"
  },
  {
    class: RoutineModal,
    name: "routine-modal"
  },
  {
    class: ToDoContainer,
    custom: "div",
    name: "todo-container"
  },
  {
    class: SelectTaskList,
    name: "select-tasklist"
  },
  {
    class: TaskListItem,
    name: "tasklist-item"
  },
  {
    class: TaskListModal,
    name: "tasklist-modal"
  },
  {
    class: ToDoTasks,
    name: "todo-tasks"
  },
  {
    class: TaskModal,
    name: "task-modal"
  },
  {
    class: CompletedTask,
    name: "completed-task"
  },
  {
    class: TaskItem,
    name: "task-item"
  }
];
customTags.forEach(customTag => {
  if (customTag.custom) {
    customElements.define(customTag.name, customTag.class, { extends: customTag.custom });
    console.log(`usage: <${customTag.custom} is="${customTag.name}">`)
  } else {
    customElements.define(customTag.name, customTag.class);
    console.log(`usage: <${customTag.name}>...</${customTag.name}>`)
  }
});

/* *************************************** */
/*  functions definition                   */
/* *************************************** */
function handleClientLoad() {

  const CLIENT_ID = '235370693851-sctgf3t32m6df955d28g898itm97165d.apps.googleusercontent.com';
  const API_KEY = 'AIzaSyDENRe8RAK0ZhuZT9f0VQgSqG3o0ybuf5c';
  const DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
    "https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest"
  ];
  const SCOPES =
    "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks";

  gapi.load('client:auth2', () => {
    gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: DISCOVERY_DOCS,
      scope: SCOPES
    })
      .then(() => {
        Store.set(storeKeys.isSignedIn, gapi.auth2.getAuthInstance().isSignedIn.get());
        gapi.auth2.getAuthInstance().isSignedIn.listen(isSignedIn => Store.set(storeKeys.isSignedIn, isSignedIn));
      })
      .catch(error => {
        Store.set(storeKeys.notice, new Notice({ message: "Some fatal errors occurred.<br>Try reloading this page.", duration: 1_000_000 }));
        console.log(error);
      });
  });
}

function appInit() {
  // default settings
  Store.set(storeKeys.settings, new Settings({
    logCalendarId: "primary",
    upcomingCalendarId: "primary",
    upcomingEnabled: false,
    colorId: "1",
    routineEnabled: false,
    todoEnabled: false,
    diaryEnabled: false,
    notificationEnabled: false
  }));

  idb.init();
}

function updateCalendarlist() {
  API.listCalendar()
    .then(res => {
      const calendars = res.result.items;

      const calendarList = [];
      calendars.forEach(calendar => {
        if (calendar.primary)
          calendarList.push(new Calendar({ id: "primary", summary: "default" }));
        else
          calendarList.push(new Calendar({ id: calendar.id, summary: calendar.summary }));
      })
      Store.set(storeKeys.calendars, calendarList);
    })
}
function updateUserProfile() {
  const userBasicProfile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
  Store.set(
    storeKeys.userProfile,
    new User({ imgSrc: userBasicProfile.getImageUrl(), email: userBasicProfile.getEmail() })
  );
}
function postEndProc(doneActList, doneAct) {
  const listPtr = doneActList ? doneActList : [];
  listPtr.push({ ...doneAct });
  if (listPtr.length > 20) {
    listPtr.shift();
  }
  Store.set(storeKeys.doneActList, listPtr);
  Store.set(storeKeys.doingAct, null);
}
/**
 *
 * @param {object} err result when google API is rejected 
 */
function handleRejectedCommon(err) {
  console.log(err);
  if (err.status == 400) {
    // do nothing
  } else if (err.status == 404) {
    Store.set(storeKeys.notice, new Notice({ message: "Googleカレンダーにアクセスできませんでした。<br>カレンダー名を確認してください。" }));
  } else if (err.status == 401) {
    Store.set(storeKeys.notice, new Notice({ message: "Googleカレンダーにアクセスできませんでした。<br>ページを再読み込みしてください。" }));
  } else {
    Store.set(storeKeys.notice, new Notice({ message: "Googleカレンダーにアクセスできませんでした。<br>通信状態を確認してください。" }));
  }
}


/* *************************************** */
/*  other procs                            */
/* *************************************** */
const coordinator = new class {
  constructor() {
    Store.onChange(storeKeys.isSignedIn, this);
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.isSignedIn:
        if (value) {
          updateCalendarlist();
          updateUserProfile();
        }
        break;
      default:
    }
  }
}
const workerManager = new class {
  doingAct;
  notificationEnabled;
  registration;
  serviceWorker;
  constructor() {
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.settings, this);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener("message", this.recieve.bind(this));
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          this.registration = registration;
          this.serviceWorker = registration.active;
        })
        .catch(error => console.log('Service worker registration failed, error:', error));
    }
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.doingAct:
        this[key] = value;
        if (!this.notificationEnabled) return;
        if (value) {
          this._showNotification();
        } else {
          this._closeNotification();
        }
        break;
      case storeKeys.settings:
        if (this.notificationEnabled === value.notificationEnabled) return;
        if (value.notificationEnabled && this.doingAct) {
          this._showNotification();
        } else {
          this._closeNotification();
        }
        this.notificationEnabled = value.notificationEnabled;
        break;
      default:
    }
  }
  _showNotification() {
    if (!this.serviceWorker) return;
    this.serviceWorker.postMessage(this.doingAct);
  }
  _closeNotification() {
    if (!this.serviceWorker) return;
    this.serviceWorker.postMessage(null);
  }
  recieve(e) {
    Store.set(storeKeys.sw, e.data);
  }
}

const titleManager = new class {
  doingAct;
  summaryFromView;
  svgContainer;
  favicon;
  faviconHrefOrg;
  title;
  titleTextOrg;
  iconHand;
  iconParts;
  registeredJob;
  constructor() {
    if (screen.width + screen.height < 1500) return;

    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.summaryFromView, this);

    this.favicon = document.getElementById("favicon");
    this.faviconHrefOrg = this.favicon.href;
    this.title = document.querySelector("title");
    this.titleTextOrg = this.title.innerText;


    this.svgContainer = document.createElement("div");
    fetch('img/favicon.svg')
      .then(res => res.text())
      .then(data => {
        this.svgContainer.innerHTML = data;
        this.iconHand = this.svgContainer.querySelector("#hand");
        this.iconParts = this.svgContainer.querySelectorAll(".st0");
      });

  }

  /**
   * @param {object} object
   * @param {string} object.key
   * @param {Act | boolean} object.value
   */
  update({ key, value }) {
    switch (key) {
      case storeKeys.summaryFromView:
        this.summaryFromView = value;
        break;
      case storeKeys.doingAct:
        if (value) {
          if (this.doingAct) return;
          this.doingAct = value;

          this.registeredJob = this.proc.bind(this);
          Cron.add(1_000, this.registeredJob);
        } else {
          if (!this.doingAct) return;
          this.doingAct = value;

          Cron.remove(1_000, this.registeredJob);
          this.title.text = this.titleTextOrg;
          this.favicon.href = this.faviconHrefOrg;
        }
        break;
      default:
    }
  }
  proc() {
    const seconds = Math.floor((Date.now() - this.doingAct.start) / 1000) % 60;
    this.iconHand.style.transform = `rotate(${seconds * 6}deg)`;
    const color = (seconds % 2) ? "#F80" : "#444";
    this.iconParts.forEach(e => e.style.fill = color);
    this.favicon.href = `data:image/svg+xml,${encodeURIComponent(this.svgContainer.innerHTML)}`;

    this.title.innerHTML = `${this.summaryFromView} (${this.doingAct.elapsedTime}) | ${this.titleTextOrg}`;
  }
}

const ActSynchronizer = new class {
  doingAct;
  doneActList;
  calendarId;
  constructor() {
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.doneActList, this);

  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.doingAct:
      case storeKeys.doneActList:
        this[key] = value;
        break;
      case storeKeys.settings:
        this.calendarId = value.logCalendarId;
        break;
      case storeKeys.isSignedIn:
        if (value) {
          this.synchronize();
        }
        break;
      default:
    }
  }
  synchronize() {
    Queue.add(async () => {
      if (this.doingAct) {
        if (this.doingAct.isSynced) {
          // check if doingTask has been done
          await this.checkDone();
        } else {
          // doingTask haven't been synced yet, so try to sync.
          await this.syncDoingAct(this.doingAct);
        }
      }
      await this.checkDoing();
    });
  }
  checkDone() {
    return API.getEvent({ eventId: this.doingAct.id })
      .then(res => {
        if (res.result.start.dateTime != res.result.end.dateTime) {
          this.doingAct.summary = res.result.summary;
          this.doingAct.description = res.result.description;
          this.doingAct.end = (new Date(res.result.end.dateTime)).getTime();
          postEndProc(this.doneActList, this.doingAct);
        }
      })
      .catch(handleRejectedCommon);
  }
  checkDoing() {
    return API.listEvent({
      calendarId: this.calendarId,
      timeMax: new Date().toISOString(),
      timeMin: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    })
      .then(res => {
        console.log(res);
        res.result.items
          .filter(item => item.start.dateTime && item.end.dateTime && item.start.dateTime == item.end.dateTime)
          .forEach(resDoingAct => {
            if (this.doingAct && resDoingAct.id == this.doingAct.id) {
              return;
            } else {
              if (this.doneActList) {
                const unsyncedAct = this.doneActList.find(act => act.id === resDoingAct.id);
                if (unsyncedAct) {
                  return this.syncDoneAct(unsyncedAct);
                }
              }
              const newAct = new Act({
                isSynced: true,
                start: new Date(resDoingAct.start.dateTime).getTime(),
                end: new Date(resDoingAct.end.dateTime).getTime(),
                id: resDoingAct.id,
                summary: resDoingAct.summary,
                description: resDoingAct.description,
                link: resDoingAct.htmlLink,
                colorId: resDoingAct.colorId
              });
              Store.set(storeKeys.anotherAct, newAct);
            }
          })
      })
      .catch(handleRejectedCommon)
  }
  /**
   * @param {Act} act
   * @return {*} 
   */
  syncDoneAct(act) {
    return API.updateEvent({
      eventId: act.id,
      summary: act.summary,
      description: act.description,
      start: new Date(act.start).toISOString(),
      end: new Date(act.end).toISOString(),
      colorId: act.colorId
    })
      .then(res => {
        console.log(res);
        act.isSynced = true;
        idb.save(storeKeys.doneActList);
      })
      .catch(handleRejectedCommon);
  }
  syncDoingAct(act) {
    return API.insertEvent({
      summary: act.summary,
      description: act.description,
      start: new Date(act.start).toISOString(),
      end: new Date(act.end).toISOString(),
      colorId: act.colorId
    })
      .then(res => {
        console.log(res)
        act.isSynced = true;
        act.id = res.result.id;
        act.link = res.result.htmlLink;
        idb.save(storeKeys.doingAct);
      })
      .catch(handleRejectedCommon);
  }


}

/* *************************************** */
/*  for debug                              */
/* *************************************** */
const dbg = {
  style: {
    bound: ["font-weight: bold;background: yellow;color:black;", ""],
    bold: ["font-weight: bold;", ""],
    red: ["font-weight: bold;color: red;", ""],
    blue: ["font-weight: bold;color: hsl(210,100%,70%)", ""],
  },

  update({ key, value }) {
    const length = 50;
    const keyword = `  ${key}  `;
    const padLeft = Math.floor(length / 2 + keyword.length / 2);
    console.log(`%c${keyword.padStart(padLeft, '■').padEnd(length, '■')}%c`, ...this.style.bound);
    if (value) console.log(value.toString());
    console.dir(value);
  }
};
Store.onChange(storeKeys.settings, dbg);
Store.onChange(storeKeys.doingAct, dbg);
Store.onChange(storeKeys.doneActList, dbg);
Store.onChange(storeKeys.addedCalendar, dbg);
Store.onChange(storeKeys.calendars, dbg);
Store.onChange(storeKeys.sw, dbg);
