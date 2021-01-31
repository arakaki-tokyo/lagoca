'use strict';
// global values
const Queue = {
  _queue: Promise.resolve(true),
  add(f) {
    this._queue = this._queue.then(f);
  }
};
const env = {
  isSignedIn: null,
  isDoing: false,
  settings: {
    gettingUpcoming: {
      enabled: false,
      upcomingCalendarId: "primary",
      upcomingCalendarSummary: "default"
    },
    calendarId: "primary",
    calendarSummary: "default",
    colorId: "1",
  },
  doingTask: {
    isSynced: "",
    id: "",
    start: "",
    end: "",
    htmlLink: "",
    elapsedTime: "",
    summary: "",
    description: ""
  },
  doneTask: {
    maxIndex: 10,
    list: new Array()
  }
};
const lsKeys = {
  settings: "settings",
  doingTask: "doingTask",
  doneTask: "doneTask",
  description: "description",
  summary: "summary"
}
const $ = (id) => document.getElementById(id);
const $$ = (className) => document.getElementsByClassName(className);
const nodes = {

  bgSettings: $("bg_settings"),
  btnAddNewCal: $("calendar_add_button"),
  btnAuthorize: $('authorize_button'),
  btnEnd: $("end_button"),
  btnsRestart: $$("restart_button"),
  btnSettingsCancel: $("settings_cancel_button"),
  btnSettingsClose: $("close_settings"),
  btnSettingsOpen: $("open_settings"),
  btnSettingsSave: $("settings_save_button"),
  btnSignOut: $('signout_button'),
  btnStart: $("start_button"),
  btnsSync: $$("sync_button"),
  btnsUpcomingStart: $$("upcoming_start_button"),
  containerDoneTasks: $("done_container"),
  containerIsNotSigneIn: $("isnot_signedin"),
  containerIsSignedIn: $("is_signedin"),
  containerUpcomingTasks: $("upcoming_container"),
  selectLogCalendarId: $("calendar_id"),
  inputDescription: $("description"),
  inputNewCalendar: $("new_calendar"),
  inputSummary: $("summary"),
  elapsed: $("elapsed"),
  enableGettingUpcoming: $("enable_getting_upcoming"),
  notification: $("notification"),
  notificationText: $("notification_text"),
  settingsModal: $("settings_modal"),
  upcomingCalendarId: $("upcoming_calendar_id"),
  userEmail: $("user_email"),
  userImg: $("user_img"),
};

function sealObjects() {
  [
    Queue,
    env,
    env.settings,
    env.settings.gettingUpcoming,
    env.doingTask,
    env.doneTask,
    lsKeys,
    nodes
  ].forEach(obj => Object.seal(obj));
}
// Client ID and API key from the Developer Console
const CLIENT_ID = '832522276123-aqt7vhfu2jaauqc763crddqknl48s9fo.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBWlwZoS4TgRDg-6uuINYlCvphULiUL6no';

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = "https://www.googleapis.com/auth/calendar";

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  })
    .then(myInit)
    .catch(error => {
      pushNotification("Some fatal errors occurred.<br>Try reloading this page.", 1_000_000);
      console.log(error);
    });
}






// function definition
// design
function initializeStyleHandler() {

  // open settings
  nodes.btnSettingsOpen.addEventListener("click", () => {
    nodes.settingsModal.classList.add("is-active");
  });

  // close settings
  [nodes.btnSettingsClose, nodes.bgSettings, nodes.btnSettingsCancel].forEach(e => {
    e.addEventListener("click", () => {
      nodes.settingsModal.classList.remove("is-active");
      initializeSettings();
    })
  });

  // enable or disable getting up-coming events
  nodes.enableGettingUpcoming.addEventListener("input", function () {
    nodes.upcomingCalendarId.disabled = !this.checked;
  })
}

function toggleTaskStatus(isDoing) {
  if (isDoing) {
    nodes.btnStart.classList.add("is-hidden");
    nodes.btnEnd.classList.remove("is-hidden");
    for (const btn of nodes.btnsRestart) btn.disabled = true;
    for (const btn of nodes.btnsUpcomingStart) btn.disabled = true;

    timeDoingTask();
  } else {
    nodes.btnEnd.classList.add("is-hidden");
    nodes.btnStart.classList.remove("is-hidden");
    nodes.inputSummary.value = "";
    nodes.inputDescription.value = "";
    for (const btn of nodes.btnsRestart) btn.disabled = false;
    for (const btn of nodes.btnsUpcomingStart) btn.disabled = false;
  }
}

function pushNotification(message, duration = 5000) {
  nodes.notificationText.innerHTML = message;
  nodes.notification.style.transform = "translateY(-130px)";
  setTimeout(() => {
    nodes.notification.style.transform = "";
  }, duration);
}
// proc
// pereodic

function checkDoingTask() {
  return listEvent({
    calendarId: env.settings.calendarId,
    timeMax: new Date().toISOString(),
    timeMin: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  })
    .then(res => {
      console.log(res);
      const resDoingTaskIndex = res.result.items.findIndex(item => item.start.dateTime == item.end.dateTime);
      if (resDoingTaskIndex > -1) {
        const resDoingTask = res.result.items[resDoingTaskIndex];
        const unsyncedIndex = env.doneTask.list.findIndex(task => task.id === resDoingTask.id);
        if (unsyncedIndex > -1) {
          const toSyncTask = env.doneTask.list[unsyncedIndex];
          return updateEvent({
            eventId: toSyncTask.id,
            summary: `${toSyncTask.summary} (${toSyncTask.elapsedTime})`,
            description: toSyncTask.description,
            start: new Date(toSyncTask.start).toISOString(),
            end: new Date(toSyncTask.end).toISOString()
          })
            .then(res => {
              console.log(res);
              env.doneTask.list.forEach(task => {
                if (task.id === res.result.id) {
                  task.isSynced = true;
                  // update doneTaskList view
                  listDoneTask();
                  // set updated-doneTaskList to localStorage
                  localStorage.setItem(lsKeys.doneTask, JSON.stringify(env.doneTask));
                }
              })
            })
            .catch(err => console.log(err));
        }
        env.isDoing = true;
        env.doingTask.isSynced = true;
        env.doingTask.id = resDoingTask.id;
        env.doingTask.htmlLink = resDoingTask.htmlLink;
        env.doingTask.start = (new Date(resDoingTask.start.dateTime)).getTime();
        env.doingTask.end = (new Date(resDoingTask.end.dateTime)).getTime();
        nodes.inputSummary.value = env.doingTask.summary = resDoingTask.summary;
        nodes.inputDescription.value = env.doingTask.description = resDoingTask.description;
        toggleTaskStatus(true);
        localStorage.setItem(lsKeys.doingTask, JSON.stringify(env.doingTask));
      }
    })
    .catch(handleRejectedCommon)
}

/**
 * 周期的に以下の処理を行う
 * - ローカルで実行中のタスクがある場合
 *  - Gcalに同期済み：他IFから終了されていないかチェック
 *  - Gcalに未同期：Gcalに同期実施
 * - ローカルで実行中のタスクがない場合
 *  - Gcalに同期済み実行中タスクがないかチェック
 *
 */
function periodicProc() {
  if (env.isDoing) {
    if (env.doingTask.isSynced) {
      // check if doingTask has been done
      return getEvent({ eventId: env.doingTask.id })
        .then(res => {
          if (res.result.start.dateTime != res.result.end.dateTime) {
            env.isDoing = false;
            env.doingTask.summary = res.result.summary;
            env.doingTask.description = res.result.description;
            env.doingTask.end = (new Date(res.result.end.dateTime)).getTime();
            toggleTaskStatus(env.isDoing);
            endTaskPostProcCommon();
            return checkDoingTask();
          }
        })
        .catch(err => {
          handleRejectedCommon(err);
        });
    } else {
      // doingTask haven't been synced yet, so try to sync.
      return insertEvent({
        summary: env.doingTask.summary,
        description: env.doingTask.description,
        start: new Date(env.doingTask.start).toISOString(),
        end: new Date(env.doingTask.end).toISOString(),
      })
        .then(res => {
          console.log(res)
          env.doingTask.isSynced = true;
          env.doingTask.id = res.result.id;
          localStorage.setItem(lsKeys.doingTask, JSON.stringify(env.doingTask));
        })
        .catch(err => {
          handleRejectedCommon(err);
        });
    }
  } else {
    return checkDoingTask();
  }
}

function timer60s() {
  if (!env.isSignedIn) return;

  Queue.add(periodicProc);
  setTimeout(timer60s, 60_000);
}
// util
/**
 * @classdesc implemented some additional methods
 * - strftime()
 * @class MyDate
 * @extends {Date}
 */
class MyDate extends Date {
  /**
   *
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


/**
 * quoted from official example -- 
 * Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 *
 * @param {boolean} isSignedIn
 */
function updateSigninStatus(isSignedIn) {
  env.isSignedIn = isSignedIn;
  if (isSignedIn) {
    const userBasicProfile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
    nodes.userImg.setAttribute("src", userBasicProfile.getImageUrl());
    nodes.userEmail.innerHTML = userBasicProfile.getEmail();

    nodes.containerIsSignedIn.classList.remove("is-hidden");
    nodes.btnSettingsSave.classList.remove("is-hidden");
    nodes.containerIsNotSigneIn.classList.add("is-hidden");
    listDoneTask();
  } else {
    nodes.containerIsSignedIn.classList.add("is-hidden");
    nodes.btnSettingsSave.classList.add("is-hidden");
    nodes.containerIsNotSigneIn.classList.remove("is-hidden");
    listDoneTask();
  }
}

/**
 * API wrapper
 *
 * @param {object} object
 * @param {string} object.eventId
 * @return {PromiseLike} 
 */
function getEvent({ eventId }) {
  return gapi.client.calendar.events.get({
    calendarId: env.settings.calendarId,
    eventId
  });
}

/**
 * API wrapper
 *
 * @param {object} object
 * @param {string} object.calendarId
 * @param {string} object.timeMax - ISO format
 * @param {string} object.timeMin - ISO format
 * @return {PromiseLike} 
 */
function listEvent({ calendarId, timeMax, timeMin }) {
  return gapi.client.calendar.events.list({
    calendarId,
    timeMax,
    timeMin,
    orderBy: "startTime",
    singleEvents: true
  });
}

/**
 * API wrapper
 *
 * @param {object} object
 * @param {string} [object.summary]
 * @param {string} [object.description]
 * @param {string} object.start
 * @param {string} object.end
 * @return {PromiseLike} 
 */
function insertEvent({ summary = "", description = "", start, end }) {

  return gapi.client.calendar.events.insert({
    calendarId: env.settings.calendarId,
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
      colorId: env.settings.colorId,
    },
  });
}

/**
 * API wrapper
 *
 * @param {object} object
 * @param {string} object.eventId
 * @param {string} [object.summary]
 * @param {string} [object.description]
 * @param {string} object.start
 * @param {string} object.end
 * @return {PromiseLike} 
 */
function updateEvent({ eventId, summary = "", description = "", start, end }) {
  return gapi.client.calendar.events.update({
    calendarId: env.settings.calendarId,
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
      colorId: env.settings.colorId,
    },
  });
}

/**
 * API wrapper
 * @return {PromiseLike} 
 */
function listCalendar() {
  return gapi.client.calendar.calendarList.list();
}

/**
 * API wrapper
 *
 * @param {object} object
 * @param {string} object.summary
 * @return {PromiseLike} 
 */
function insertCalendar({ summary }) {
  return gapi.client.calendar.calendars.insert({
    summary,
    discription: "created by LoGoCa"
  });
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
    pushNotification("Googleカレンダーにアクセスできませんでした。<br>カレンダー名を確認してください。");
  } else if (err.status == 401) {
    pushNotification("Googleカレンダーにアクセスできませんでした。<br>ページを再読み込みしてください。");
  } else {
    pushNotification("Googleカレンダーにアクセスできませんでした。<br>通信状態を確認してください。");
  }
}

function timeDoingTask() {

  function doTime(end) {
    const elapsedTime = Math.floor((end.getTime() - env.doingTask.start) / 1000);
    const h = Math.floor(elapsedTime / (60 * 60));
    const m = Math.floor(elapsedTime / 60) % 60;
    const s = elapsedTime % 60;
    nodes.elapsed.innerHTML = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    env.doingTask.elapsedTime = `${h == 0 ? "" : h + "h"}${m}m`;
  }
  if (env.isDoing) {
    doTime(new Date());
    setTimeout(timeDoingTask, 1000);
  } else {
    nodes.elapsed.innerHTML = "00:00:00";
  }
}

function initializeSettings() {
  nodes.enableGettingUpcoming.checked = env.settings.gettingUpcoming.enabled;
  nodes.upcomingCalendarId.disabled = !nodes.enableGettingUpcoming.checked;
  document.settings.event_color.value = env.settings.colorId;
  updateCalendarlist();
}

function addDoneTaskList(doneTask) {
  env.doneTask.list.unshift(doneTask);
  if (env.doneTask.list.length > env.doneTask.maxIndex)
    env.doneTask.list.pop();
}

function listDoneTask() {
  let HTML = `<h2 class="message-header is-radiusless"><label class="is-overlay has-text-centered" for="done_radio">最近の活動</label></h2><input type="radio" id="done_radio" name="which_to_show" ${env.settings.gettingUpcoming.enabled ? "" : "checked"}><div id="done">`;
  env.doneTask.list.forEach((task, index) => {
    HTML += `
    <div class="card ${env.isSignedIn && task.id == "" ? "has-background-danger-light" : ""} is-shadowless" style="width:130px;display:inline-block;">
      <header class="card-header is-size-7">
        <p class="card-header-title p-1"><a ${task.htmlLink ? 'href="' + task.htmlLink + '" target="_blank"' : ""}">${task.summary}</a></p>
      </header>
      <div class="card-content p-0">
        <time class="is-size-7">${new MyDate(task.start).strftime("%m/%d %H:%M")} ~ ${new MyDate(task.end).strftime("%H:%M")}</time>
        <textarea class="textarea has-fixed-size is-size-7 ${env.isSignedIn && task.id == "" ? "has-background-danger-light" : ""}" readonly tabindex="-1" rows="2" style="border-color:#dbdbdb">${task.description}</textarea>
      </div>
      <div class="card-footer">
        ${env.isSignedIn && task.id == "" ? `<button class="sync_button card-footer-item button is-small is-danger is-outlined is-rounded" index="${index}">Sync</button>` : ""}
        <button class="restart_button card-footer-item button is-small is-link is-outlined is-rounded" index="${index}">restart</button>
      </div>
    </div>
    `
  })
  nodes.containerDoneTasks.innerHTML = `${HTML}</div>`;

  for (const btn of nodes.btnsRestart) btn.addEventListener("click", handleRestartClick);
  for (const btn of nodes.btnsSync) btn.addEventListener("click", handleSyncClick);
}

function listUpcomingTask() {
  const onedayms = 1000 * 60 * 60 * 24;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tommorow = new Date(today.getTime() + onedayms);
  Queue.add(() => listEvent({
    calendarId: env.settings.gettingUpcoming.upcomingCalendarId,
    timeMax: tommorow.toISOString(),
    timeMin: today.toISOString()
  })
    .then(res => {
      console.log(res);
      let HTML = '<h2 class="message-header is-radiusless"><label class="is-overlay has-text-centered" for="upcoming_radio">今日の予定</label></h2><input type="radio" id="upcoming_radio" name="which_to_show"><div id="upcoming">';
      res.result.items.forEach(item => {
        HTML += `
          <div class="card is-shadowless" style="width:130px;display:inline-block;">
            <header class="card-header is-size-7">
              <p class="card-header-title p-1"><a href="${item.htmlLink}" target="_blank">${item.summary}</a></p>
            </header>
            <div class="card-content p-0">
              <time class="px-1 is-size-7">${new MyDate(item.start.dateTime).strftime("%H:%M")} ~ ${new MyDate(item.end.dateTime).strftime("%H:%M")}</time>
            </div>
            <div class="card-footer">
              <button class="upcoming_start_button card-footer-item button is-small is-info is-outlined is-rounded" summary="${item.summary}" description="${item.description || ""}" ${env.isDoing ? "disabled" : ""}>start</button>
            </div>
          </div>
        `
      });
      nodes.containerUpcomingTasks.innerHTML = `${HTML}</div>`;
      for (const btn of nodes.btnsUpcomingStart) btn.addEventListener("click", handleUpcomingStartClick);

    })
    .catch(handleRejectedCommon)
  )
}

/**
 * **TBC**
 * G-calからアカウントのカレンダーリストを取得し、
 * セッティングモーダル内、『予定を取得するカレンダー』と『ログを記録するカレンダー』
 * のリストを更新する。
 *
 */
function updateCalendarlist() {
  listCalendar()
    .then(res => {
      const calendars = res.result.items;

      let HTMLCalList = '<option value="primary">default</option>';
      calendars.forEach(calendar => {
        if (calendar.primary) return;
        HTMLCalList += `<option value="${calendar.id}">${calendar.summary}</option>`;
      })

      nodes.selectLogCalendarId.innerHTML =
        nodes.upcomingCalendarId.innerHTML = HTMLCalList;

      nodes.selectLogCalendarId.value = env.settings.calendarId;
      nodes.upcomingCalendarId.value = env.settings.gettingUpcoming.upcomingCalendarId;
    })
}
function endTaskPostProcCommon() {
  // update doneTaskList
  addDoneTaskList({ ...env.doingTask });
  // remove propaties of env.doingTask
  for (const key in env.doingTask) env.doingTask[key] = "";
  // update doneTaskList view
  listDoneTask();
  // set updated-doneTaskList to localStorage
  localStorage.setItem(lsKeys.doneTask, JSON.stringify(env.doneTask));
  // remove doingTask from localStorage
  localStorage.removeItem(lsKeys.doingTask);
}
function handleUnfinishedInput() {
  localStorage.setItem(this.id, this.value);
}
/**
 * handler for start button clicked
 *
 */
function handleStartClick() {
  Queue.add(() => {
    const summary = nodes.inputSummary.value;
    const description = nodes.inputDescription.value;
    const now = new MyDate();
    env.isDoing = true;
    env.doingTask.isSynced = false;
    env.doingTask.start = now.getTime();
    env.doingTask.end = now.getTime();
    env.doingTask.summary = summary;
    env.doingTask.description = description;
    toggleTaskStatus(env.isDoing);

    if (env.isSignedIn) {
      return insertEvent({
        summary,
        description,
        start: now.toISOString(),
        end: now.toISOString(),
      })
        .then(res => {
          console.log(res)
          env.doingTask.isSynced = true;
          env.doingTask.id = res.result.id;
          env.doingTask.htmlLink = res.result.htmlLink;
        })
        .catch(err => {
          console.log(err);
          handleRejectedCommon(err);
        })
        .then(() => {
          localStorage.setItem(lsKeys.doingTask, JSON.stringify(env.doingTask));
        });
    } else {
      localStorage.setItem(lsKeys.doingTask, JSON.stringify(env.doingTask));
    }

  });
}

function handleUpcomingStartClick() {
  nodes.inputSummary.value = this.getAttribute("summary");
  nodes.inputDescription.value = this.getAttribute("description");

}
/**
 * handler for restart button clicked
 *
 */
function handleRestartClick() {
  const restartTask = env.doneTask.list[this.getAttribute("index")];
  nodes.inputSummary.value = restartTask.summary;
  nodes.inputDescription.value = restartTask.description;
}
/**
 * handler for end button clicked
 *
 */
function handleEndClick() {
  Queue.add(() => {

    const start = new MyDate(env.doingTask.start);
    const end = new MyDate();
    const summary = nodes.inputSummary.value;
    const description = nodes.inputDescription.value;

    env.isDoing = false;
    env.doingTask.summary = summary;
    env.doingTask.description = description;
    env.doingTask.end = end.getTime();
    toggleTaskStatus(env.isDoing);

    if (env.isSignedIn) {

      const args = {
        summary: `${summary} (${env.doingTask.elapsedTime})`,
        description,
        start: start.toISOString(),
        end: end.toISOString()
      };

      let syncMethod;
      if (env.doingTask.isSynced) {
        args.eventId = env.doingTask.id;
        syncMethod = updateEvent;
      } else {
        syncMethod = insertEvent;
      }

      return syncMethod(args)
        .then(res => {
          console.log(res);
          env.doingTask.isSynced = true;
          env.doingTask.id = res.result.id;
        })
        .catch(err => {
          console.log(err);
          env.doingTask.isSynced = false;
          handleRejectedCommon(err);
        })
        .then(() => {
          // finally
          endTaskPostProcCommon();
        });
    } else {
      endTaskPostProcCommon();
    }
  });
}

function handleSyncClick() {
  const syncTaskIndex = this.getAttribute("index");
  const syncTask = env.doneTask.list[syncTaskIndex];

  Queue.add(() => insertEvent({
    summary: syncTask.summary,
    description: syncTask.description,
    start: new Date(syncTask.start).toISOString(),
    end: new Date(syncTask.end).toISOString()
  })
    .then(res => {
      syncTask.isSynced = true;
      syncTask.id = res.result.id;
      listDoneTask();
      localStorage.setItem(lsKeys.doneTask, JSON.stringify(env.doneTask));
    })
    .catch(handleRejectedCommon)
  );

}

function saveSettings() {

  if (
    // When changed from disabled to enabled, or
    (!env.settings.gettingUpcoming.enabled && nodes.enableGettingUpcoming.checked) ||
    // changed getting-upcoming-calendar
    (env.settings.gettingUpcoming.enabled && env.settings.gettingUpcoming.upcomingCalendarId != nodes.upcomingCalendarId.value)
  ) {
    listUpcomingTask();
  } else if (env.settings.gettingUpcoming.enabled && !nodes.enableGettingUpcoming.checked) {
    nodes.containerUpcomingTasks.innerText = "";
  }

  env.settings.colorId = document.settings.event_color.value;
  env.settings.gettingUpcoming.enabled = nodes.enableGettingUpcoming.checked;
  env.settings.gettingUpcoming.upcomingCalendarId = nodes.upcomingCalendarId.value;
  env.settings.gettingUpcoming.upcomingCalendarSummary = nodes.upcomingCalendarId.selectedOptions[0].text;
  env.settings.calendarId = nodes.selectLogCalendarId.value;
  env.settings.calendarSummary = nodes.selectLogCalendarId.selectedOptions[0].text;

  localStorage.setItem(lsKeys.settings, JSON.stringify(env.settings));
  nodes.settingsModal.classList.remove("is-active");
}

function handleAddCalClick() {

  this.classList.add("is-loading");
  const newCalendarSummary = nodes.inputNewCalendar.value;
  insertCalendar({ summary: newCalendarSummary })
    .then(res => {
      if (res.status == 200) {
        nodes.selectLogCalendarId.innerHTML += `<option value="${res.result.id}">${res.result.summary}</option>`;
        nodes.selectLogCalendarId.value = res.result.id;
        nodes.inputNewCalendar.value = "";
      } else {
        throw new Error('The response status is other than "200".');
      }
    })
    .catch(err => {
      console.log(err);
      pushNotification("新しいカレンダーを作成できませんでした。");
      initializeSettings();
    })
    .then(() => {
      this.classList.remove("is-loading");
    })

}

/**
*  Sign in the user upon button click.
*/
function handleAuthClick(event) {
  this.classList.add("is-loading");
  gapi.auth2.getAuthInstance().signIn()
    .then(() => {
      this.classList.remove("is-loading");
    })
    .catch(error => {
      this.classList.remove("is-loading");
    });
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

function myInit() {
  // Listen for sign-in state changes.
  gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

  // Handle the initial sign-in state.
  updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

  const settings = localStorage.getItem(lsKeys.settings);
  if (settings) {
    env.settings = JSON.parse(settings);
  }
  initializeSettings();

  if (env.settings.gettingUpcoming.enabled) {
    listUpcomingTask();
  }

  const doneTask = localStorage.getItem(lsKeys.doneTask);
  if (doneTask) {
    env.doneTask = JSON.parse(doneTask);
    listDoneTask();
  }

  const doingTask = localStorage.getItem(lsKeys.doingTask);
  if (doingTask) {
    env.doingTask = JSON.parse(doingTask);
    env.isDoing = true;
    nodes.inputSummary.value = env.doingTask.summary;
    nodes.inputDescription.value = env.doingTask.description;
    toggleTaskStatus(true);
  } else {
    toggleTaskStatus(false);
  }

  sealObjects();
  initializeStyleHandler();
  nodes.btnAddNewCal.addEventListener("click", handleAddCalClick);
  nodes.btnStart.addEventListener("click", handleStartClick);
  nodes.btnEnd.addEventListener("click", handleEndClick);
  nodes.btnSettingsSave.addEventListener("click", saveSettings);
  nodes.btnAuthorize.addEventListener("click", handleAuthClick);
  nodes.btnSignOut.addEventListener("click", handleSignoutClick);
  nodes.inputSummary.addEventListener("input", handleUnfinishedInput);
  nodes.inputDescription.addEventListener("input", handleUnfinishedInput);
  timer60s();
}