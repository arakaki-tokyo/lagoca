
"use strict";
/**
 * データストア
 * @class Store
 */
class Store {
  static #data = new Map();

  /**
   * @static
   * @param {string} key
   * @param {object} subsriberObject
   * @memberof Store
   */
  static onChange(key, subsriberObject) {
    if (!this.#data.has(key)) {
      this.#data.set(key, { value: null, SOs: [] });
    }
    this.#data.get(key).SOs.push(subsriberObject);
  }

  /**
   * @static
   * @param {storeKeys} key
   * @param {*} value
   * @memberof Store
   */
  static set(key, value) {
    if (this.#data.has(key)) {
      const data = this.#data.get(key);
      data.value = value;
      data.SOs.forEach(SO => SO.update({ key: key, value: value }));
    } else {
      this.#data.set(key, { value: value, SOs: [] });
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
  isActDoing: "isActDoing",
  doingAct: "doingAct",
  isSignedIn: "isSignedIn",
  notice: "notice",
  doneActList: "doneActList",
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

class MyDate extends Date {
  /**
   * @param {string} fmt 日時のフォーマット文字列。
   * [書式コード](https://docs.python.org/ja/3/library/datetime.html#strftime-and-strptime-format-codes)の一部を実装
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
  listEvent({ calendarId, timeMax, timeMin }) {
    return gapi.client.calendar.events.list({
      calendarId,
      timeMax,
      timeMin,
      orderBy: "startTime",
      singleEvents: true
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
  insertEvent({ summary = "", description = "", start, end }) {

    return gapi.client.calendar.events.insert({
      calendarId: this.logCalendarId,
      resource: {
        summary: summary,
        description: description,
        start: {
          dateTime: start,
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: end,
          timeZone: "Asia/Tokyo",
        },
        colorId: this.colorId,
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
  updateEvent({ eventId, summary = "", description = "", start, end }) {
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
        colorId: this.colorId,
      },
    });
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
  colorId = ""
}) {
  this.upcomingEnabled = upcomingEnabled;
  this.upcomingCalendarId = upcomingCalendarId;
  this.logCalendarId = logCalendarId;
  this.colorId = colorId;
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
  link = ""
}) {
  this.isSynced = isSynced;
  this.start = start;
  this.end = end;
  this.elapsedTime = elapsedTime;
  this.id = id;
  this.summary = summary;
  this.description = description;
  this.link = link;
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

/* *************************************** */
/*  custom elements definitions            */
/* *************************************** */
const $ = (id) => document.getElementById(id);

/**
 * 設定のモーダル
 * - `data-action="close"`属性：クリックされるとモーダルを閉じる
 * - `data-action="signin"`属性：クリックされるとサインイン処理
 * - `data-action="logout"`属性：クリックされるとログアウト処理
 * - `data-state="logedout"`: 非ログイン状態で表示
 * - `data-state="signedin"`: ログイン状態で表示
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
      colorId: this.colorId.value
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
  constructor() {
    super();
    Store.onChange(storeKeys.tmpNewCalendar, this);
    Store.onChange(storeKeys.isAddCalInProgress, this);
  }
  connectedCallback() {
    this.addEventListener("click", () => {
      this.addCalendarProc(this.tmpNewCalendar);
    })
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.tmpNewCalendar:
        this.tmpNewCalendar = value;
        break;
      case storeKeys.isAddCalInProgress:
        if (value) {
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
        console.log(err);
        Store.set(storeKeys.notice, new DATA.Notice({ message: "新しいカレンダーを作成できませんでした。" }));
      })
      .then(() => {
        Store.set(storeKeys.isAddCalInProgress, false);
      })
  }


}

/**
 * @class EventColor
 * @extends {HTMLElement}
 */
class EventColor extends HTMLElement {
  colors = [
    { id: "1", value: "#a4bdfc" },
    { id: "2", value: "#7ae7bf" },
    { id: "3", value: "#dbadff" },
    { id: "4", value: "#ff887c" },
    { id: "5", value: "#fbd75b" },
    { id: "6", value: "#ffb878" },
    { id: "7", value: "#46d6db" },
    { id: "8", value: "#e1e1e1" },
    { id: "9", value: "#5484ed" },
    { id: "10", value: "#51b749" },
    { id: "11", value: "#dc2127" },
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
  set value(val) {
    this.form.ev.value = val;
  }
}

class SettingsModalOpen extends HTMLElement {
  connectedCallback() {
    this.addEventListener("click", () => {
      Store.set(storeKeys.isModalOpen, true);

    })
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
    Store.onChange(storeKeys.isActDoing, this);
  }
  connectedCallback() {
    this.addEventListener("input", () => {
      Store.set(storeKeys.summaryFromView, this.value);
      localStorage.setItem(storeKeys.summaryToView, this.value);
    });
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.summaryToView:
        this.value = value;
        this.dispatchEvent(new Event("input"));
        break;
      case storeKeys.isActDoing:
        if (!value) {
          this.value = "";
          this.dispatchEvent(new Event("input"));
        }
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
    Store.onChange(storeKeys.isActDoing, this);
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
    this.editor.classList.add("textarea");
    this.quill.on("text-change", () => {
      Store.set(storeKeys.descriptionFromView, this.editor.innerHTML);
      localStorage.setItem(storeKeys.descriptionToView, this.editor.innerHTML);
    })
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.descriptionToView:
        this.value = value;
        this.dispatchEvent(new Event("input"));
        break;
      case storeKeys.isActDoing:
        if (!value) {
          this.value = "";
          this.dispatchEvent(new Event("input"));
        }
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
    Store.onChange(storeKeys.isActDoing, this);
    Store.onChange(storeKeys.isSignedIn, this);
  }
  connectedCallback() {
    this.addEventListener("click", () => {
      Store.set(storeKeys.isActDoing, true);
      const now = new Date();
      const newAct = new DATA.Act({ summary: this.summary, description: this.description });
      Store.set(storeKeys.doingAct, newAct);
      if (this.isSignedIn) {
        Queue.add(() => {
          return API.insertEvent({
            summary: this.summary,
            description: this.description,
            start: now.toISOString(),
            end: now.toISOString(),
          })
            .then(res => {
              console.log(res);

              newAct.isSynced = true;
              newAct.id = res.result.id;
              newAct.link = res.result.htmlLink;
              storageManager.save(storeKeys.doingAct);
            })
            .catch(handleRejectedCommon);
        });
      }
    })
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
      case storeKeys.isActDoing:
        if (value)
          this.classList.add("is-hidden");
        else
          this.classList.remove("is-hidden");
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
    Store.onChange(storeKeys.isActDoing, this);
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.doneActList, this);
  }
  connectedCallback() {
    this.addEventListener("click", () => {
      const start = new Date(this.doingAct.start);
      const end = new Date(Date.now() + 1000);

      this.doingAct.end = end.getTime();
      this.doingAct.summary = `${this.summary} (${this.doingAct.elapsedTime})`;
      this.doingAct.description = this.description;
      Store.set(storeKeys.isActDoing, false);

      Queue.add(() => {
        if (this.isSignedIn) {
          const syncMethod = this.doingAct.isSynced ? API.updateEvent.bind(API) : API.insertEvent.bind(API);

          return syncMethod({
            eventId: this.doingAct.id,
            summary: this.doingAct.summary,
            description: this.doingAct.description,
            start: start.toISOString(),
            end: end.toISOString()
          })
            .then(res => {
              console.log(res);
              this.doingAct.isSynced = true;
              this.doingAct.id = res.result.id;
              this.doingAct.link = res.result.htmlLink;
            })
            .catch(err => {
              console.log(err);
              this.doingAct.isSynced = false;
              handleRejectedCommon(err);
            })
            .then(() => {
              postEndProc(this.doneActList, this.doingAct);
            });
        } else {
          postEndProc(this.doneActList, this.doingAct);
        }
      });
    })
  }


  update({ key, value }) {
    switch (key) {
      case storeKeys.doingAct:
        this.doingAct = value;
        break;
      case storeKeys.summaryFromView:
        this.summary = value;
        break;
      case storeKeys.descriptionFromView:
        this.description = value;
        break;
      case storeKeys.isSignedIn:
        this.isSignedIn = value;
        break;
      case storeKeys.isActDoing:
        if (value) {
          this.classList.remove("is-hidden");
        } else {
          this.classList.add("is-hidden");
        }
        break;
      case storeKeys.doneActList:
        this.doneActList = value;
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
  timeoutID;
  start;
  doingAct;
  connectedCallback() {
    this.init();
    Store.onChange(storeKeys.isActDoing, this);
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
      case storeKeys.isActDoing:
        if (value) {
        } else {
          clearTimeout(this.timeoutID);
          this.init();
          this.timeoutID = null;
          this.start = null;
        }
        break;
      case storeKeys.doingAct:
        this.doingAct = value;
        if (!value || this.timeoutID) return;
        this.start = value.start;
        this.doTimeout();
        break;
      default:
    }
  }

  init() {
    this.innerHTML = "00:00:00";
  }
  doTimeout() {
    this.calcElapsedTime(this.start, Date.now());
    this.timeoutID = setTimeout(() => { this.doTimeout() }, 1000);
  }
  calcElapsedTime(start, end) {
    const elapsedTime = Math.floor((end - start) / 1000);
    const h = Math.floor(elapsedTime / (60 * 60));
    const m = Math.floor(elapsedTime / 60) % 60;
    const s = elapsedTime % 60;
    this.innerHTML = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    this.doingAct.elapsedTime = `${h == 0 ? "" : h + "h"}${m}m`;
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
  isActDoing = false;
  listContainer;
  tmpl;
  constructor() {
    super();
    this.style.display = "block";
  }
  connectedCallback() {
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.isActDoing, this);
    Store.onChange(storeKeys.doneActList, this);

    this.listContainer = this.querySelector("[data-container]")
    const template = this.querySelector("template");
    this.tmpl = template.innerHTML;
    template.remove();

  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.isSignedIn:
      case storeKeys.isActDoing:
        this[key] = value;
        break;
      case storeKeys.doneActList:
        this.listContainer.innerHTML = "";
        value.forEach(act => {
          const doneAct = document.createElement("done-act");
          doneAct.init({ tmpl: this.tmpl, act, isSignedIn: this.isSignedIn, isActDoing: this.isActDoing });
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
    Store.onChange(storeKeys.isActDoing, this);
    Store.onChange(storeKeys.doneActList, this);
  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.isSignedIn:
      case storeKeys.isActDoing:
        this[key] = value;
        this.#render(this.act);
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
    this.#render(act);
  }
  /**
   * @param {Act} act
   * @memberof DoneAct
   */
  #render(act) {
    this.querySelector("[data-summary]").innerHTML = act.link ? `<a href="${act.link}" target="_blank">${act.summary}</a>` : act.summary;
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
    Store.set(storeKeys.summaryToView, this.act.summary.replace(/ \([^(]*\d?m\)$/,""));
    Store.set(storeKeys.descriptionToView, this.act.description);
  }
  sync() {
    Queue.add(() => API.insertEvent({
      summary: this.act.summary,
      description: this.act.description,
      start: new Date(this.act.start).toISOString(),
      end: new Date(this.act.end).toISOString()
    })
      .then(res => {
        this.act.isSynced = true;
        this.act.id = res.result.id;
        this.act.link = res.result.htmlLink;
        this.#render(this.act);
        storageManager.save(storeKeys.doneActList);
      })
      .catch(handleRejectedCommon)
    );
  }
}

class UpcomingAct extends HTMLElement {
  act;
  isActDoing;
  connectedCallback() {
    Store.onChange(storeKeys.isActDoing, this);
  }
  update({ key, value }) {
    this[key] = value;
    this.#render(this.act)
  }
  init({ tmpl, act, isActDoing }) {
    this.innerHTML = tmpl;
    this.act = act;
    this.isActDoing = isActDoing;
    this.#render(act);
  }
  /**
   * @param {Act} act
   * @memberof UpcomingAct
   */
  #render(act) {
    this.querySelector("[data-summary]").innerHTML = `<a href="${act.link}" target="_blank">${act.summary}</a>`;
    this.querySelector("[data-time]").innerHTML = `${new MyDate(act.start).strftime("%m/%d %H:%M")} ~ ${new MyDate(act.end).strftime("%H:%M")}`;

    const startButton = this.querySelector("[data-start]");
    startButton.disabled = this.isActDoing;
    startButton.onclick = this.start.bind(this);

  }
  start() {
    Store.set(storeKeys.summaryToView, this.act.summary);
    Store.set(storeKeys.descriptionToView, this.act.description);
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
    Store.onChange(storeKeys.isActDoing, this);
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.isSignedIn, this);

    this.listContainer = this.querySelector("[data-container]");
    const template = this.querySelector("template");
    this.tmpl = template.innerHTML;
    template.remove();

  }

  update({ key, value }) {
    switch (key) {
      case storeKeys.isActDoing:
        this[key] = value;
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
        console.log(res);
        const upcomings = [];
        res.result.items.forEach(item => {
          upcomings.push(new Act({
            start: new Date(item.start.dateTime).getTime(),
            end: new Date(item.end.dateTime).getTime(),
            summary: item.summary,
            description: item.description
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



const customTags = {
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
}
for (const key in customTags) {
  const customTag = customTags[key];
  if (customTag.custom) {
    customElements.define(customTag.name, customTag.class, { extends: customTag.custom });
    console.log(`usage: <${customTag.custom} is="${customTag.name}">`)
  } else {
    customElements.define(customTag.name, customTag.class);
    console.log(`usage: <${customTag.name}>...</${customTag.name}>`)
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
        Store.set(storeKeys.notice, new DATA.Notice("Some fatal errors occurred.<br>Try reloading this page.", 1_000_000));
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
    colorId: "1"
  }));

  storageManager.init();
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
const titleManager = new class {
  doingAct;
  summaryFromView;
  svgContainer;
  IntervalId;
  favicon;
  faviconHrefOrg;
  title;
  titleTextOrg;
  iconHand;
  iconParts;
  constructor() {
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.isActDoing, this);
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
        this.doingAct = value;
        if (this.doingAct) {
          this.IntervalId = setInterval(() => this.proc(), 1000);
        }
        break;
      case storeKeys.isActDoing:
        if (this.IntervalId && !value) {
          clearInterval(this.IntervalId);
          this.IntervalId = null;
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

const storageManager = new class {
  init() {
    Object.keys(localStorage).forEach(key => {
      let valueToSet;
      try {
        valueToSet = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        valueToSet = localStorage.getItem(key);
      }
      Store.set(key, valueToSet);
      this[key] = valueToSet;
    });

    Store.onChange(storeKeys.isActDoing, this);
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.doneActList, this);
  }
  update({ key, value }) {
    if (!value) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
      this[key] = value;
    }
  }
  save(key) {
    if (this[key]) localStorage.setItem(key, JSON.stringify(this[key]));
  }

}
const pereodic = new class {
  isActDoing;
  doingAct;
  doneActList;
  calendarId;
  /** @type {Act} */
  timeoutID;
  constructor() {
    Store.onChange(storeKeys.isSignedIn, this);
    Store.onChange(storeKeys.settings, this);
    Store.onChange(storeKeys.isActDoing, this);
    Store.onChange(storeKeys.doingAct, this);
    Store.onChange(storeKeys.doneActList, this);

  }
  update({ key, value }) {
    switch (key) {
      case storeKeys.isActDoing:
      case storeKeys.doingAct:
      case storeKeys.doneActList:
        this[key] = value;
        break;
      case storeKeys.settings:
        this.calendarId = value.logCalendarId;
        break;
      case storeKeys.isSignedIn:
        if (value) {
          this.init();
        } else {
          clearTimeout(this.timeoutID);
        }
        break;
      default:
    }
  }
  init() {
    Queue.add(this.periodicProc.bind(this));
    this.timeoutID = setTimeout(this.init.bind(this), 60_000);
  }
  periodicProc() {
    if (this.isActDoing) {
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
  }
  checkDone() {
    return API.getEvent({ eventId: this.doingAct.id })
      .then(res => {
        if (res.result.start.dateTime != res.result.end.dateTime) {
          Store.set(storeKeys.isActDoing, false);
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
        console.log(res);
        const resDoingAct = res.result.items.find(item => item.start.dateTime == item.end.dateTime);
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
            link: resDoingAct.htmlLink
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
      end: new Date(act.end).toISOString()
    })
      .then(res => {
        console.log(res);
        act.isSynced = true;
        storageManager.save(storeKeys.doneActList);
      })
      .catch(handleRejectedCommon);
  }
  startNewAct(act) {
    Store.set(storeKeys.isActDoing, true);
    Store.set(storeKeys.doingAct, act);
    Store.set(storeKeys.summaryToView, act.summary);
    Store.set(storeKeys.descriptionToView, act.description);
  }
  syncDoingAct(act) {
    Store.set(storeKeys.isActDoing, true);
    return API.insertEvent({
      summary: act.summary,
      description: act.description,
      start: new Date(act.start).toISOString(),
      end: new Date(act.end).toISOString(),
    })
      .then(res => {
        console.log(res)
        act.isSynced = true;
        act.id = res.result.id;
        act.link = res.result.htmlLink;
        storageManager.save(storeKeys.doingAct);
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
Store.onChange(storeKeys.isActDoing, dbg);
Store.onChange(storeKeys.doingAct, dbg);
Store.onChange(storeKeys.doneActList, dbg);
Store.onChange(storeKeys.addedCalendar, dbg);
Store.onChange(storeKeys.calendars, dbg);