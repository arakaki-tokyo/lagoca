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
    isSynced: false,
    id: null,
    start: null,
    end: null,
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
}
const $ = (id) => document.getElementById(id);
const nodes = {

  authorizeBtn: $('authorize_button'),
  bgSettings: $("bg_settings"),
  inputCalendarSummary: $("calendar_id"),
  inputDescription: $("description"),
  closeSettings: $("close_settings"),
  doneArea: $("done"),
  elapsed: $("elapsed"),
  enableGettingUpcoming: $("enable_getting_upcoming"),
  endButton: $("end_button"),
  isNotSigneInArea: $("isnot_signedin"),
  isSignedInArea: $("is_signedin"),
  notification: $("notification"),
  notificationText: $("notification_text"),
  openSettings: $("open_settings"),
  settingsCancelButton: $("settings_cancel_button"),
  settingsModal: $("settings_modal"),
  settingsSaveBtn: $("settings_save_button"),
  signOutBtn: $('signout_button'),
  startButton: $("start_button"),
  inputSummary: $("summary"),
  upcomingCalendarId: $("upcoming_calendar_id"),
  userEmail: $("user_email"),
  userImg: $("user_img")
};

[Queue, env, lsKeys, nodes].forEach(obj => Object.seal(obj));
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
};






// function definition
// design
function initializeStyleHandler() {

  // open settings
  nodes.openSettings.addEventListener("click", () => {
    nodes.settingsModal.classList.add("is-active");
  });

  // close settings
  [nodes.closeSettings, nodes.bgSettings, nodes.settingsCancelButton].forEach(e => {
    e.addEventListener("click", () => {
      nodes.settingsModal.classList.remove("is-active");
      initializeSettings();
    })
  });

  // enable or disable getting up-coming events
  nodes.enableGettingUpcoming.addEventListener("input", function () {
    nodes.upcomingCalendarId.disabled = !this.checked;
  })
};

function toggleTaskStatus(isDoing) {
  if (isDoing) {
    nodes.startButton.classList.add("is-hidden");
    nodes.endButton.classList.remove("is-hidden");
    timeDoingTask();
  } else {
    nodes.endButton.classList.add("is-hidden");
    nodes.startButton.classList.remove("is-hidden");
    nodes.inputSummary.value = "";
    nodes.inputDescription.value = "";
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
        env.doingTask.start = (new Date(resDoingTask.start.dateTime)).getTime();
        env.doingTask.end = (new Date(resDoingTask.end.dateTime)).getTime();
        nodes.inputSummary.value = env.doingTask.summary = resDoingTask.summary;
        nodes.inputDescription.value = env.doneTask.description = resDoingTask.description;
        toggleTaskStatus(true);
        localStorage.setItem(lsKeys.doingTask, JSON.stringify(env.doingTask));
      }
    })
    .catch(err => {
      handleRejectedCommon(err);
    })
};

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
};

function timer60s() {
  if (!env.isSignedIn) return;

  Queue.add(periodicProc);
  setTimeout(timer60s, 60_000);
};
// util
class MyDate extends Date {
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
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSigninStatus(isSignedIn) {
  env.isSignedIn = isSignedIn;
  if (isSignedIn) {
    const userBasicProfile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
    nodes.userImg.setAttribute("src", userBasicProfile.getImageUrl());
    nodes.userEmail.innerHTML = userBasicProfile.getEmail();

    nodes.isSignedInArea.classList.remove("is-hidden");
    nodes.settingsSaveBtn.classList.remove("is-hidden");
    nodes.isNotSigneInArea.classList.add("is-hidden");
  } else {
    nodes.isSignedInArea.classList.add("is-hidden");
    nodes.settingsSaveBtn.classList.add("is-hidden");
    nodes.isNotSigneInArea.classList.remove("is-hidden");
  }
}

function getEvent({ eventId }) {
  return gapi.client.calendar.events.get({
    calendarId: env.settings.calendarId,
    eventId
  });
}

function listEvent({ timeMax, timeMin }) {
  return gapi.client.calendar.events.list({
    calendarId: env.settings.calendarId,
    timeMax,
    timeMin
  });
}

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

function listCalendar() {
  return gapi.client.calendar.calendarList.list();
}

function insertCalendar({ summary }) {
  return gapi.client.calendar.calendars.insert({
    summary,
    discription: "created by LoGoCa"
  });
}

function handleRejectedCommon(err) {
  console.log(err);
  if (err.status == 400) {
    // do nothing
  } else if (err.status == 404) {
    pushNotification("Googleカレンダーにアクセスできませんでした。<br>カレンダー名を確認してください。");
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
  nodes.upcomingCalendarId.value = env.settings.gettingUpcoming.upcomingCalendarSummary;

  nodes.upcomingCalendarId.disabled = !nodes.enableGettingUpcoming.checked;
  nodes.inputCalendarSummary.value = env.settings.calendarSummary;
  document.settings.event_color.value = env.settings.colorId;
};

function addDoneTaskList(doneTask) {
  env.doneTask.list.unshift(doneTask);
  if (env.doneTask.list.length > env.doneTask.maxIndex)
    env.doneTask.list.pop();
}

function listDoneTask() {
  let HTML = "";
  env.doneTask.list.forEach(task => {
    HTML += `
    <div class="card" style="width:130px;display:inline-block;">
      <header class="card-header is-size-7">
        <p class="card-header-title p-1">${task.summary}</p>
      </header>
      <div class="card-content p-0">
        <time class="px-1 is-size-7">${new MyDate(task.start).strftime("%m/%d %H:%M")} ~ ${new MyDate(task.end).strftime("%H:%M")}</time>
        <textarea class="textarea has-fixed-size is-size-7" readonly tabindex="-1" style="pointer-events: none;">${task.description}</textarea>
      </div>
      <div class="card-footer">
        <button class="restart_button card-footer-item button is-small is-primary is-outlined is-rounded">restart</button>
      </div>
    </div>
    `
  })
  nodes.doneArea.innerHTML = HTML;

}

function endTaskPostProcCommon() {
  // update doneTaskList
  addDoneTaskList({ ...env.doingTask });
  // update doneTaskList view
  listDoneTask();
  // set updated-doneTaskList to localStorage
  localStorage.setItem(lsKeys.doneTask, JSON.stringify(env.doneTask));
  // remove doingTask from localStorage
  localStorage.removeItem(lsKeys.doingTask);
}
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

function saveSettings() {
  env.settings.gettingUpcoming.enabled = nodes.enableGettingUpcoming.checked;
  env.settings.colorId = document.settings.event_color.value;

  const newCalendarSummary = nodes.inputCalendarSummary.value;
  if (newCalendarSummary == env.settings.calendarSummary) {
    // do nothing
  } else if (newCalendarSummary == "default") {
    env.settings.calendarId = "primary";
    env.settings.calendarSummary = newCalendarSummary;
    localStorage.setItem(lsKeys.settings, JSON.stringify(env.settings));
  } else {
    listCalendar()
      .then(res => {
        let i;
        for (i = 0; i < res.result.items.length; i++) {
          if (res.result.items[i].summary == newCalendarSummary)
            break;
        }
        if (i == res.result.items.length) {
          insertCalendar({ summary: newCalendarSummary })
            .then((res) => {
              if (res.status == 200) {
                env.settings.calendarId = res.result.id;
                env.settings.calendarSummary = newCalendarSummary;
                localStorage.setItem(lsKeys.settings, JSON.stringify(env.settings));
              } else {
                throw new Error('The response status is other than "200".');
              }
            })
            .catch(err => {
              console.log(err);
              pushNotification("新しいカレンダーを作成できませんでした。");
              initializeSettings();
            })
        } else {
          env.settings.calendarId = res.result.items[i].id;
          env.settings.calendarSummary = newCalendarSummary;
          localStorage.setItem(lsKeys.settings, JSON.stringify(env.settings));
        }
      })
      .catch(err => {
        console.log(err);
        pushNotification("Googleカレンダーにアクセスできませんでした。");
        initializeSettings();
      })
  }

  nodes.settingsModal.classList.remove("is-active");
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
    initializeSettings();

    if (env.settings.gettingUpcoming.enabled) {

    }
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

  initializeStyleHandler();
  nodes.startButton.addEventListener("click", handleStartClick);
  nodes.endButton.addEventListener("click", handleEndClick);
  nodes.settingsSaveBtn.addEventListener("click", saveSettings);
  nodes.authorizeBtn.addEventListener("click", handleAuthClick);
  nodes.signOutBtn.addEventListener("click", handleSignoutClick);
  timer60s();
}