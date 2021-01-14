// global values
const env = {
  calendarId: "primary",
  colorId: "1",
  doingTask: {
    isDoing: false,
    id: "",
    start: null,
    end: null,
    summary: "",
  },
};

// function definition
const $ = (id) => document.getElementById(id);
// design

// proc
// pereodic
function timer60s() {
  function checkDoingTask() {
    listEvent({
      timeMax: new Date().toISOString(),
      timeMin: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      callback: function (res) {
        console.log(res);
        res.result.items.forEach((item) => {
          if (item.start.dateTime == item.end.dateTime) {
            env.doingTask.isDoing = true;
            env.doingTask.id = item.id;
            env.doingTask.start = new Date(item.start.dateTime);
            env.doingTask.end = new Date(item.end.dateTime);
            env.doingTask.summary = item.summary;
            timeDoingTask();
          }
        });
      },
    });
  }
  setTimeout(() => {
    // check if doingTask has been done
    if (env.doingTask.isDoing) {
      getEvent({
        id: env.doingTask.id,
        callback: function (res) {
          if (res.result.start.dateTime != res.result.end.dateTime) {
            env.doingTask.end = new Date(res.result.end.dateTime);
            taskEndCommon();
            checkDoingTask();
          }
        },
      });
    } else {
      checkDoingTask();
    }
    timer60s();
  }, 60_000);
}
// util
class MyDate extends Date {
  strftime(fmt) {
    return fmt
      .replaceAll("%Y", String(this.getFullYear()))
      .replaceAll("%m", ("0" + (this.getMonth() + 1)).slice(-2))
      .replaceAll("%d", ("0" + this.getDate()).slice(-2))
      .replaceAll("%H", ("0" + this.getHours()).slice(-2))
      .replaceAll("%M", ("0" + this.getMinutes()).slice(-2))
      .replaceAll("%S", ("0" + this.getSeconds()).slice(-2));
  }
}
function getEvent({ id, callback = null }) {
  gapi.client.calendar.events
    .get({
      calendarId: env.calendarId,
      eventId: id,
    })
    .then(callback);
}
function listEvent({ timeMax, timeMin, callback = null }) {
  gapi.client.calendar.events
    .list({
      calendarId: env.calendarId,
      timeMax: timeMax,
      timeMin: timeMin,
    })
    .then(callback);
}
function insertEvent({ summary = "", description = "", start, end }) {
  gapi.client.calendar.events
    .insert({
      calendarId: env.calendarId,
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
        colorId: env.colorId,
      },
    })
    .then(function (ev) {
      console.log(ev);
      // do something
      env.doingTask.id = ev.result.id;
      localStorage.setItem("doingTask", JSON.stringify(env.doingTask));
    });
}

function updateEvent({ summary = "", description = "", start, end }) {
  gapi.client.calendar.events
    .update({
      calendarId: env.calendarId,
      eventId: env.doingTask.id,
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
        colorId: env.colorId,
      },
    })
    .then(function (ev) {
      console.log(ev);
      // do something
    });
}

function timeDoingTask() {
  
  function doTime(end){
    const elapsedTime = Math.floor((end.getTime() - env.doingTask.start) / 1000);
    const h = String(Math.floor(elapsedTime / (60 * 60))).padStart(2, "0");
    const m = String(Math.floor(elapsedTime / 60) % 60).padStart(2, "0");
    const s = String(elapsedTime % 60).padStart(2, "0");
    $("elapsed").innerHTML = `${h}:${m}:${s}`;
  }
  if (env.doingTask.isDoing){
    doTime(new Date());
    setTimeout(timeDoingTask, 1000);
  }else{
    doTime(env.doingTask.end);
    return;
  } 
}
function taskEndCommon() {
  env.doingTask.isDoing = false;
  localStorage.removeItem("doingTask");
}
// call by event
function taskStart() {
  // get title
  const summary = $("summary");
  // get now
  const now = new MyDate();
  // save to web strage
  // push to dcal
  insertEvent({
    summary: summary.value,
    start: now.toISOString(),
    end: now.toISOString(),
  });
  // hide start_task
  // show   doing
  env.doingTask.isDoing = true;
  env.doingTask.start = now.getTime();

  timeDoingTask();
}

function taskEnd() {
  taskEndCommon();

  const end = new Date();
  env.doingTask.end = end;
  updateEvent({
    summary: $("summary").value,
    description: $("description").value,
    start: new Date(env.doingTask.start).toISOString(),
    end: end.toISOString(),
  });
}

function myInit() {
  if (localStorage.getItem("doingTask")) {
    console.log(JSON.parse(localStorage.getItem("doingTask")));
    env.doingTask = JSON.parse(localStorage.getItem("doingTask"));
    timeDoingTask();
  }

  timer60s();
}

// event listener
$("start_button").addEventListener("click", taskStart);
$("end_button").addEventListener("click", taskEnd);
