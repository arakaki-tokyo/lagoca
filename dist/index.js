
"use strict";
const TRUE = 1;
const FALSE = 0;
const ONEDAY_MS = 1000 * 60 * 60 * 24;
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
  isModalOpen: "isModalOpen",
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
  toBeStartedAct: "toBeStartedAct"
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
      }
    }
  }
}
const OSs = {
  App: {name: "App", option: {keyPath: "key"}},
  DoneAct: {name: "DoneAct", option: {keyPath: "start"}},
  Routine: { name: "Routine", option: { keyPath: 'id' }, index: [{ key: "order" }] },
  Diary: { name: "Diary", option: { keyPath: 'date' }, index: [{ key: "isSynced" }] },
};
/** 
 * 
 * @method getAllRoutine
 * */
const idb = new class {
  VERSION = 1;
  constructor(OSs) {
    const openRequest = indexedDB.open("logoca", this.VERSION);
    openRequest.onupgradeneeded = function (ev) {
      // initialize, or update idb
      const db = ev.target.result;
      Object.values(OSs).forEach(OS => {
        const objectStore = OS.option ?
          db.createObjectStore(OS.name, OS.option) :
          db.createObjectStore(OS.name);
        if (OS.index) OS.index.forEach(idx => objectStore.createIndex(idx.key, idx.key));
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
  init(){
    this.getAllApp()
    .then(list => list.forEach(({key, value}) => {
      Store.set(key, value);
      this[key] = value;
    }))
    .then(() => {
      Store.onChange(storeKeys.doingAct, this);
      Store.onChange(storeKeys.settings, this);
      Store.onChange(storeKeys.doneActList, this);
    });

  }
  update({key, value}){
    this.setApp({key, value});
    this[key] = value;
  }
  save(key){
    this.setApp({key, value: this[key]});
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
      const req = key ? objectStore.getAll(key) : objectStore.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerrors = (ev) => reject(ev);
      })
    });
  }
  _getIndexAll(store, index, key) {
    return this.db.then(db => {
      const idx = db.transaction(store, "readonly").objectStore(store).index(index);
      const req = key ? idx.getAll(key) : idx.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerrors = (ev) => reject(ev);
      })
    });
  }

  _getAllKV(store, key) {
    return this.db.then(db => {
      const objectStore = db.transaction(store, "readonly").objectStore(store);
      const req = key ? objectStore.openCursor(key) : objectStore.openCursor();
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
  getUnsyncedDiaries() {
    return this.db.then(db => {
      const req = db.transaction(OSs.Diary.name, "readonly")
        .objectStore(OSs.Diary.name).index(OSs.Diary.index[0].key).getAll(FALSE);
      return new Promise((resolve, reject) => {
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerrors = (ev) => reject(ev);
      })
    });
  }
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
        colorId: colorId? colorId:this.colorId,
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
        location
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
        colorId: colorId? colorId:this.colorId,
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
        location
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
}

/* *************************************** */
/*  data classes definition                */
/* *************************************** */
const DATA = {
  User: User,
  Calendar: Calendar,
  Settings: Settings,
  Act: Act,
  Notice: Notice
};
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
 * @property {boolean} upcomingEnabled
 * @property {string} upcomingCalendarId
 * @property {string} logCalendarId
 * @property {string} colorId
 */
function Settings({
  upcomingEnabled = "",
  upcomingCalendarId = "",
  logCalendarId = "",
  colorId = "",
  diaryEnabled = "",
  notificationEnabled = ""
}) {
  this.upcomingEnabled = upcomingEnabled;
  this.upcomingCalendarId = upcomingCalendarId;
  this.logCalendarId = logCalendarId;
  this.colorId = colorId;
  this.diaryEnabled = diaryEnabled;
  this.notificationEnabled = notificationEnabled;
}
/**
 * アクションデータクラス
 *
 * @class Act
 * @extends {Data}
 */
function Act({
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
  getAct(){
    return new Act({
      summary: this.summary,
      description: this.description,
      colorId: this.color? this.color.id: null
    })
  }
}
/* *************************************** */
/*  custom elements definitions            */
/* *************************************** */
const $ = (id) => document.getElementById(id);

/**
 * - `data-tab`属性: 表示するページに対応するタブ
 * - `data-page`属性: 表示するページ
 *
 * @class TabSwipeable
 * @extends {HTMLElement}
 */
class TabSwipeable extends HTMLDivElement {
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
    // this.view.scrollLeftへの代入が機能しないため
    setTimeout(() => this.init(), 0);
  }
  init() {
    Object.values(this.tabs).find(tab => tab.tab.classList.contains("is-active")).tab.dispatchEvent(new Event("click"));
    this.view.style.scrollBehavior = "smooth";
  }
  update({ key, value }) {
    switch(key){
      case storeKeys.settings:
        if (value.diaryEnabled) {
          Object.values(this.tabs.page2)
            .forEach(elm => elm.classList.remove("is-hidden"));
          } else {
          Object.values(this.tabs.page2)
            .forEach(elm => elm.classList.add("is-hidden"));
        }    
        break;
      case storeKeys.toBeStartedAct:
        this.tabs.page1.tab.dispatchEvent(new Event("click"));
    }
  }
  tabClickHandler(e) {
    e.stopPropagation();
    Object.values(this.tabs).forEach(tab => {
      if (tab.tab.contains(e.target)) {
        tab.tab.classList.add("is-active");
        this.view.scrollLeft += tab.page.getBoundingClientRect().x;
      } else {
        tab.tab.classList.remove("is-active");
      }

    })
  }
  _scrollHandler(e) {
    e.target.removeEventListener("scroll", this.scrollHandler);
    const activeTab = Object.values(this.tabs).find(tab => tab.page.getBoundingClientRect().x === 0);
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

/**
 * 設定のモーダル
 * - `data-action="close"`属性：クリックされるとモーダルを閉じる
 * - `data-action="signin"`属性：クリックされるとサインイン処理
 * - `data-action="logout"`属性：クリックされるとログアウト処理
 * - `data-action="apply"`属性：クリックされると設定を保存
 * - `data-state="logedout"`: 非ログイン状態で表示
 * - `data-state="signedin"`: ログイン状態で表示
 * - `data-role="upcoming_enabled"`: 予定の取得を有効化チェックボックス
 * - `data-role="upcoming_calendar_id"`: 予定を取得するカレンダーセレクトボックス
 * - `data-role="log_calendar_id"`: ログを記録するカレンダーセレクトボックス
 * - `data-role="color_id"`: イベントカラーラジオボタン
 * - `data-role="diary_enabled"`: diaryを有効化チェックボックス
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
    Store.onChange(storeKeys.isModalOpen, this);
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.calendars, this);
  }
  connectedCallback() {
    this.querySelectorAll("[data-role]").forEach(elm => {
      switch (elm.dataset.role) {
        case "upcoming_enabled":
          this.upcomingEnabled = elm;
          break;
        case "upcoming_calendar_id":
          this.upcomingCalendarId = elm;
          break;
        case "log_calendar_id":
          this.logCalendarId = elm;
          break;
        case "color_id":
          this.colorId = elm;
          break;
        case "diary_enabled":
          this.diaryEnabled = elm;
          break;
        case "notification_enabled":
          this.notificationEnabled = elm;
          break;
        default:
      }
    });
    this.addEventListener("click", (ev) => {
      if ("role" in ev.target.dataset) {
        if (ev.target == this.upcomingEnabled) {
          this.upcomingCalendarId.disabled = !this.upcomingEnabled.checked;
        }
      }
      else if ("action" in ev.target.dataset) {
        this[ev.target.dataset.action](ev);
      }
    })
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
      case storeKeys.isModalOpen:
        if (value) {
          this.classList.add("is-active");
        } else {
          this.classList.remove("is-active");
          this.init(this.appliedSetting);
        }
        break;
      case storeKeys.isSignedIn:
        if (value) {
          this.querySelectorAll(`[data-state="signedin"]`)
            .forEach(elm => elm.classList.remove("is-hidden"));
          this.querySelectorAll(`[data-state="logedout"]`)
            .forEach(elm => elm.classList.add("is-hidden"));
        } else {
          this.querySelectorAll(`[data-state="signedin"]`)
            .forEach(elm => elm.classList.add("is-hidden"));
          this.querySelectorAll(`[data-state="logedout"]`)
            .forEach(elm => elm.classList.remove("is-hidden"));
        }
        break;
      default:
    }
  }
  close() {
    Store.set(storeKeys.isModalOpen, false);
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
    const newSettings = new DATA.Settings({
      upcomingEnabled: this.upcomingEnabled.checked,
      upcomingCalendarId: this.upcomingCalendarId.value,
      logCalendarId: this.logCalendarId.value,
      colorId: this.colorId.value,
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
          Store.set(storeKeys.addedCalendar, new DATA.Calendar({ id: res.result.id, summary: res.result.summary }));
        } else {
          throw new Error('The response status is other than "200".');
        }
      })
      .catch(err => {
        Store.set(storeKeys.notice, new DATA.Notice({ message: "新しいカレンダーを作成できませんでした。" }));
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
          Store.set(storeKeys.notice, new DATA.Notice({ message: "このアプリからの通知が拒否されています。<br>デバイス、またはブラウザの設定を確認してください。" }));
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

class SettingsModalOpen extends HTMLElement {
  imgElm;
  constructor() {
    super();
    Store.onChange(storeKeys.userProfile, this);
    Store.onChange(storeKeys.isSignedIn, this);
    [
      ["position", "relative"],
      ["cursor", "pointer"]

    ].forEach(([key, value]) => this.style[key] = value);
  }
  connectedCallback() {
    this.imgElm = document.createElement("img");
    this.imgElm.setAttribute("style", `
      width: 20px;
      position: absolute;
      top: 15px;
      left: 13px;
      border-radius: 50%;
    `);

    this.addEventListener("click", () => {
      Store.set(storeKeys.isModalOpen, true);
    });

    this.innerHTML = `<div>${this.innerHTML}</div>`;
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.userProfile:
        this.logedIn(value.imgSrc);
        break;
      case storeKeys.isSignedIn:
        if (!value) {
          this.logedOut();
        }
        break;
      default:
    }
  }
  logedIn(src) {
    this.imgElm.src = src;
    this.appendChild(this.imgElm);
  }
  logedOut() {
    if (this.contains(this.imgElm)) {
      this.removeChild(this.imgElm);
    }
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
      idb.setApp({key: storeKeys.summaryToView, value: this.value});
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
      idb.setApp({key: storeKeys.descriptionToView, value: this.editor.innerHTML});
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
      const newAct = new DATA.Act({ summary: this.summary, description: this.description });
      this._startProc(newAct);
    })
  }
  _startProc(act){
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
      toBeEndedAct.summary = `${this.summary} (${toBeEndedAct.elapsedTime})`;
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
            toBeEndedAct.isSynced = true;
            toBeEndedAct.id = res.result.id;
            toBeEndedAct.link = res.result.htmlLink;
          })
          .catch(err => {
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
    this.init();
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
          if(this.doingAct) return;
          this.doingAct = value;

          this.start = value.start;
          this.doTimeout();
          this.registeredJob = this.doTimeout.bind(this);
          Cron.add(1000, this.registeredJob);
        }else{
          if(!this.doingAct) return;
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
  constructor() {
    super();
    this.style.display = "block";
  }
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
          doneAct.init({ tmpl: this.tmpl, act, isSignedIn: this.isSignedIn, isActDoing: this.doingAct? true: false });
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
        this.isActDoing = value? true: false;
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
    this.isActDoing = value? true: false;
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
    const dateTime = act.start && act.end?
      `${new MyDate(act.start).strftime("%m/%d %H:%M")} ~ ${new MyDate(act.end).strftime("%H:%M")}`:
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

  constructor() {
    super();
    this.style.display = "block";
  }
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
        this.isActDoing = value? true: false;
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
    const onedayms = 1000 * 60 * 60 * 24;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tommorow = new Date(today.getTime() + onedayms);
    return API.listEvent({
      calendarId,
      timeMax: tommorow.toISOString(),
      timeMin: today.toISOString()
    })
      .then(res => {
        const upcomings = [];
        res.result.items.forEach(item => {
          upcomings.push(new Act({
            start: item.start.dateTime? new Date(item.start.dateTime).getTime(): null,
            end: item.end.dateTime? new Date(item.end.dateTime).getTime(): null,
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
      this.listContainer.insertAdjacentElement('afterbegin', upcomingAct);
    })
  }
}

class ToolTip extends HTMLElement {
  tip;
  constructor() {
    super();
    this.style.cursor = "help";
    this.style.position = "relative";
  }
  connectedCallback() {
    this.attachShadow({ mode: 'open' }).innerHTML = `
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32">
    <style>
      g{stroke-width: 0;fill: currentColor;}
      #tip{
        position: absolute;
        top: 0.5rem;
        left: 1rem;
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
    e.stopPropagation();
    const marginRight = window.innerWidth - (this.getBoundingClientRect().x + 270);
    if (marginRight < 0) {
      this.tip.style.transform = `translateX(${marginRight}px)`;
    }
    this.removeEventListener("click", this.show);
    document.addEventListener("click", this.hide);
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
  connectedCallback() {
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.isSignedIn, this);
    this.date = this.querySelector("diary-nav");
    this.desc = this.querySelector("[data-role='description']");
  }
  update({ key, value }) {
    switch (key) {

      case storeKeys.settings:
        this.calendarId = value.logCalendarId;
        break;
      case storeKeys.isSignedIn:
        if (this.isSignedIn || !value) return;
        this.isSignedIn = value;
        this.fetch().then(() => {
          this.date.onchange = e => this.dateChange(e.target.value);
          this.dateChange(this.date.value);
          this.descChange = this._descChange.bind(this);

          Cron.add(60_000, this.checkUnsynced.bind(this));
        })
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
        if (diary.id) {
          API.deleteEvent({ calendarId: diary.calendarId, eventId: diary.id });
        }
        idb.deleteDiary(this.date.value);
      })
    } else {
      idb.updateDiary(this.date.value, diary => {
        const updateDiary = diary? diary: new Diary({calendarId: this.calendarId, date: this.date.value});
        updateDiary.value = e.target.value;
        updateDiary.timestamp = Date.now();
        updateDiary.isSynced = FALSE;
        return updateDiary;
      })
    }
  }
  checkUnsynced() {
    idb.getUnsyncedDiaries().then(list => {
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
    })
      .then(res => {
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
        this[target.dataset.action](target);
      }
    })
    this._init();
    this.modal.addEventListener("update", this.routineUpdateHandler.bind(this));
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
  update({key, value}){
    this[key] = value;
  }
  renderContents(routine) {
    const li = document.createElement("li");
    li.classList.add("is-flex", "routine_item");
    li.setAttribute("data-key", routine.id);
    li.innerHTML = `
      <div class="routine_details"><span class="button sortable-handle"><svg class="icon"><use xlink:href="#icon-arrows-v"></use></svg></span></div>
      <div class="routine_details"><svg data-key="${routine.id}" data-action="start" class="icon has-text-primary is-clickable"><use xlink:href="#icon-play-outline"></use></svg></div>
      <div class="routine_details has-text-weight-bold is-size-7 routine_summary"><span ${routine.color?'style="background: linear-gradient(transparent 60% , '+routine.color.value+', transparent 110%);"':""}>${routine.summary}</span></div>
      <div class="routine_details"><svg data-key="${routine.id}" data-action="edit" class="icon has-text-danger-dark is-clickable"><use xlink:href="#icon-pencil"></use></svg></div>
      <div class="routine_details"><button data-key="${routine.id}" data-action="delete" class="delete"></button></div>
    `;
    return li;
  }
  routineUpdateHandler() {
    if(this.routineList.length === this.editingRoutine.order){
      this.container.appendChild(this.renderContents(this.editingRoutine));
    }else{
      this.container.children[this.editingRoutine.order].innerHTML = this.renderContents(this.editingRoutine).innerHTML;
    }
    this.updateRoutineList();
  }
  updateRoutineList(){
    return idb.getIndexAllRoutine("order").then(list => this.routineList = list);
  }
  updateRoutineOrder(){
    let queue = Promise.resolve();
    [...this.container.children].forEach((li, idx) => {
      queue = queue.then(() => {
        return idb.updateRoutine(Number(li.dataset.key), routine => {
          routine.order = idx;
          return routine;
        })
      });
    })
    queue.then(() => this.updateRoutineList());
  }
  open(target) {
    this.editingRoutine = new Routine({ order: this.routineList.length });
    this.modal.open(this.editingRoutine);
  }
  edit(target) {
    this.editingRoutine = this.routineList.find(routine => routine.id === Number(target.dataset.key));
    this.modal.open(this.editingRoutine);
  }
  delete(target) {
    target.closest("li").remove();

    idb.deleteRoutine(Number(target.dataset.key))
      .then(() => {
        this.updateRoutineOrder();
      });
  }
  start(target){
    if(this.doingAct) return;

    const startRoutine = this.routineList.find(routine => routine.id === Number(target.dataset.key));
    Store.set(storeKeys.toBeStartedAct, new Routine(startRoutine).getAct());
    Store.set(storeKeys.summaryToView, startRoutine.summary);
    Store.set(storeKeys.descriptionToView, startRoutine.description);
  }

}
/**
 * Routineページのモーダル
 * - `data-action="close"`属性：クリックされるとモーダルを閉じる
 * - `data-action="apply"`属性：クリックされると設定を保存
 * - `data-role="title"`属性：モーダルのヘッダー
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
      elm.addEventListener("click", this[`_${elm.dataset.action}`].bind(this))
    })
  }
  open(routine) {
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
    e.stopPropagation();
    this.classList.remove("is-active");
  }
  _apply(e) {
    e.stopPropagation();
    this.editingRoutine.summary = this.summary.value;
    this.editingRoutine.description = this.description.value;
    if (!this.samecolor.checked && this.color.value) {
      this.editingRoutine.color = { id: this.color.value, value: this.color.colorValue };
    }else{
      this.editingRoutine.color = null;
    }

    idb.updateRoutine(this.editingRoutine.id, routine => {
      return this.editingRoutine;
    }).then(() => this.dispatchEvent(new Event("update")));
    
    this.classList.remove("is-active");
  }
}


const customTags = {
  TabSwipeable: {
    custom: "div",
    name: "tab-swipeable",
    class: TabSwipeable
  },
  SettingsModal: {
    name: "settings-modal",
    class: SettingsModal
  },
  SettingsModalOpen: {
    name: "modal-open",
    class: SettingsModalOpen
  },
  UserImg: {
    custom: "img",
    name: "user-img",
    class: UserImg
  },
  UserEmail: {
    name: "user-email",
    class: UserEmail
  },
  SelectCalendar: {
    custom: "select",
    name: "select-cal",
    class: SelectCalendar
  },
  SelectLogCalendar: {
    custom: "select",
    name: "select-log",
    class: SelectLogCalendar
  },
  NewCalendar: {
    custom: "input",
    name: "new-cal",
    class: NewCalendar
  },
  AddCalendar: {
    custom: "button",
    name: "add-cal",
    class: AddCalendar
  },
  EventColor: {
    name: "eve-col",
    class: EventColor
  },
  NotificationCheck: {
    custom: "input",
    name: "notification-check",
    class: NotificationCheck
  },
  Summary: {
    custom: "input",
    name: "act-summary",
    class: Summary
  },
  Description: {
    name: "act-description",
    class: Description
  },
  ActStart: {
    custom: "button",
    name: "act-start",
    class: ActStart
  },
  ActEnd: {
    custom: "button",
    name: "act-end",
    class: ActEnd
  },
  TimeElapsed: {
    name: "time-elapsed",
    class: TimeElapsed
  },
  NoticeShow: {
    name: "notice-show",
    class: NoticeShow
  },
  DoneAct: {
    name: "done-act",
    class: DoneAct
  },
  DoneActList: {
    name: "done-act-list",
    class: DoneActList
  },
  UpcomingAct: {
    name: "upcoming-act",
    class: UpcomingAct
  },
  UpcomingActList: {
    name: "upcoming-act-list",
    class: UpcomingActList
  },
  ToolTip: {
    name: "tool-tip",
    class: ToolTip
  },
  QuillCommon: {
    name: "quill-common",
    class: QuillCommon
  },
  DiaryNav: {
    name: "diary-nav",
    class: DiaryNav
  },
  DiaryContainer: {
    custom: "div",
    name: "diary-container",
    class: DiaryContainer
  },
  RoutineContainer: {
    custom: "div",
    name: "routine-container",
    class: RoutineContainer
  },
  RoutineModal: {
    name: "routine-modal",
    class: RoutineModal
  },

}
for (const key in customTags) {
  const customTag = customTags[key];
  if (customTag.custom) {
    customElements.define(customTag.name, customTag.class, { extends: customTag.custom });
  } else {
    customElements.define(customTag.name, customTag.class);
  }
}

/* *************************************** */
/*  functions definition                   */
/* *************************************** */
function handleClientLoad() {

  const CLIENT_ID = '235370693851-sctgf3t32m6df955d28g898itm97165d.apps.googleusercontent.com';
  const API_KEY = 'AIzaSyDENRe8RAK0ZhuZT9f0VQgSqG3o0ybuf5c';
  const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
  const SCOPES = "https://www.googleapis.com/auth/calendar";

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
        Store.set(storeKeys.notice, new DATA.Notice({ message: "Some fatal errors occurred.<br>Try reloading this page.", duration: 1_000_000 }));
        console.log(error);
      });
  });
}

function appInit() {
  // default settings
  Store.set(storeKeys.settings, new DATA.Settings({
    logCalendarId: "primary",
    upcomingCalendarId: "primary",
    upcomingEnabled: false,
    colorId: "1",
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
          calendarList.push(new DATA.Calendar({ id: "primary", summary: "default" }));
        else
          calendarList.push(new DATA.Calendar({ id: calendar.id, summary: calendar.summary }));
      })
      Store.set(storeKeys.calendars, calendarList);
    })
}
function updateUserProfile() {
  const userBasicProfile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
  Store.set(
    storeKeys.userProfile,
    new DATA.User({ imgSrc: userBasicProfile.getImageUrl(), email: userBasicProfile.getEmail() })
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
    Store.set(storeKeys.notice, new DATA.Notice({ message: "Googleカレンダーにアクセスできませんでした。<br>カレンダー名を確認してください。" }));
  } else if (err.status == 401) {
    Store.set(storeKeys.notice, new DATA.Notice({ message: "Googleカレンダーにアクセスできませんでした。<br>ページを再読み込みしてください。" }));
  } else {
    Store.set(storeKeys.notice, new DATA.Notice({ message: "Googleカレンダーにアクセスできませんでした。<br>通信状態を確認してください。" }));
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
  settings;
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
          this.proc();
        })
    }
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.doingAct:
      case storeKeys.settings:
        this[key] = value;
        this.proc();
        break;
      default:
    }
  }
  proc() {
    if (this.serviceWorker && this.settings.notificationEnabled) {
      if (this.doingAct) {
        this.serviceWorker.postMessage(this.doingAct);
      } else {
        this.serviceWorker.postMessage(null);
      }
    }
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
          if(this.doingAct) return;
          this.doingAct = value;

          this.registeredJob = this.proc.bind(this);
          Cron.add(1_000, this.registeredJob);
        }else{
          if(!this.doingAct) return;
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

const pereodic = new class {
  doingAct;
  doneActList;
  calendarId;
  registeredJob;
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
          this.registeredJob = this.periodicProc.bind(this);
          this.periodicProc.bind(this)();
          Cron.add(60_000, this.registeredJob);
        } else {
          Cron.remove(60_000, this.registeredJob);
        }
        break;
      default:
    }
  }
  periodicProc() {
    Queue.add(() => {
      if (this.doingAct) {
        if (this.doingAct.isSynced) {
          // check if doingTask has been done
          return this.checkDone();
        } else {
          // doingTask haven't been synced yet, so try to sync.
          return this.syncDoingAct(this.doingAct);
        }
      } else {
        return this.checkDoing();
      }
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
          return this.checkDoing();
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
        const resDoingAct = res.result.items.find(item =>
          item.start.dateTime && item.end.dateTime && item.start.dateTime == item.end.dateTime);
        if (resDoingAct) {
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
          return this.startNewAct(newAct);
        }
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
        act.isSynced = true;
        idb.save(storeKeys.doneActList);
      })
      .catch(handleRejectedCommon);
  }
  startNewAct(act) {
    Store.set(storeKeys.doingAct, act);
    Store.set(storeKeys.summaryToView, act.summary);
    Store.set(storeKeys.descriptionToView, act.description);
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
        act.isSynced = true;
        act.id = res.result.id;
        act.link = res.result.htmlLink;
        idb.save(storeKeys.doingAct);
      })
      .catch(handleRejectedCommon);
  }


}
