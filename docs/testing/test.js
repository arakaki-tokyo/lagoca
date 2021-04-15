"use strict";
const style = {
    bold: ["font-weight: bold;", ""],
    red: ["font-weight: bold;color: red;", ""],
    blue: ["font-weight: bold;color: hsl(210,100%,70%)", ""],
};
const myLog = (arg1, arg2) => {
    const arg2Style = arg2 ? style.blue : style.red;
    console.log(`%c${arg1}%c called. \nreturn: %c${arg2}%c`, ...style.bold, ...arg2Style);
};
const testParams = {
    signIn: true,
    eventsGet: true,
    eventsGetRet: {
        result: {
            start: {
                dateTime: "2021-01-22T13:27:43.654Z"
            },
            end: {
                dateTime: "2021-01-22T13:27:43.654Z"
            }
        }
    },
    eventsInsert: true,
    eventsInsertRet: {
        result: {
            id: "abcdefg123456"
        },
    },
    eventsUpdate: true,
    eventsList: true,
    eventsListRet: {
        result: {
            items: [
                {
                    htmlLink: "calendar.google.com",
                    start: {
                        dateTime: "2021-02-13T11:42:39.544Z"
                    },
                    end: {
                        dateTime: "2021-02-13T11:42:39.544Z"
                    },
                    summary: "testsummary1",
                    description: "description1 description1 description1"
                },
                {
                    htmlLink: "calendar.google.com",
                    start: {
                        date: "2021-02-13"
                    },
                    end: {
                        date: "2021-02-14"
                    },
                    summary: "testsummary1",
                    description: "description1 description1 description1"
                }
            ]
        }
    },
    calendarListList: true,
    calendarListRet: {
        result: {
            items: [
                { id: "id_for_test_calendar", summary: "test" },
                { id: "id_for_primary_calendar", summary: "logoca.io@gmail.com", primary: true },
                { id: "id_for_japanese_test_calendar", summary: "テスト" },
                { id: "id_for_log_calendar", summary: "log" },
            ]
        }
    },
    calendarsInsert: true,
    tasksRet: {
        result: {
            items: []
        }
    }
};

const gapi = {
    var: {
        isSignIn: false,
        listener: null
    },
    load: (arg1, arg2) => {
        arg2();
    },
    client: {
        init: (arg) => {
            return Promise.resolve();
        },
        calendar: {
            events: {
                get: (arg) => {
                    myLog("events.get", testParams.eventsGet);
                    return new Promise((resolve, reject) => {
                        if (testParams.eventsGet)
                            resolve(testParams.eventsGetRet);
                        else
                            reject();
                    })
                },
                insert: (arg) => {
                    myLog("events.insert", testParams.eventsInsert);
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            if (testParams.eventsInsert)
                                resolve(testParams.eventsInsertRet);
                            else
                                reject();
                        }, 1000)
                    })
                },
                list: (arg) => {
                    myLog("events.list", testParams.eventsList);
                    return new Promise((resolve, reject) => {
                        if (testParams.eventsList)
                            resolve(testParams.eventsListRet);
                        else
                            reject();
                    })
                },
                update: (arg) => {
                    myLog("events.update", testParams.eventsUpdate);
                    return new Promise((resolve, reject) => {
                        if (testParams.eventsUpdate)
                            resolve(testParams.eventsInsertRet);
                        else
                            reject();
                    })
                },
                delete: (arg) => {
                    myLog("events.delete");
                    return Promise.resolve();
                },
            },
            calendarList: {
                list: () => {
                    myLog("calendarList.list", testParams.calendarListList);
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            if (testParams.calendarListList)
                                resolve(testParams.calendarListRet);
                            else
                                reject();
                        }, 2000)
                    })
                }
            },
            calendars: {
                insert: arg => {
                    myLog("calendars.insert", testParams.calendarsInsert);
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {

                            if (testParams.calendarsInsert)
                                resolve({
                                    status: 200,
                                    result: {
                                        id: `new_calendar_id_of_${arg.summary}`,
                                        summary: arg.summary
                                    }
                                });
                            else
                                reject();
                        }, 1000)
                    })
                }
            }
        },
        tasks: {
            tasklists: {
                list: function () { myLog("tasks"); return Promise.resolve(testParams.tasksRet) },
                insert: function () { myLog("tasks"); return Promise.resolve(testParams.tasksRet) },
                update: function () { myLog("tasks"); return Promise.resolve(testParams.tasksRet) },
                delete: function () { myLog("tasks"); return Promise.resolve(testParams.tasksRet) },
            },
            tasks: {
                list: function () { myLog("tasks"); return Promise.resolve(testParams.tasksRet) },
                insert: function () { myLog("tasks"); return Promise.resolve(testParams.tasksRet) },
                update: function () { myLog("tasks"); return Promise.resolve(testParams.tasksRet) },
                move: function () { myLog("tasks"); return Promise.resolve(testParams.tasksRet) },
                delete: function () { myLog("tasks"); return Promise.resolve(testParams.tasksRet) },
            }
        }
    },
    auth2: {
        getAuthInstance: () => {
            return {
                currentUser: {
                    get: () => {
                        return {
                            getBasicProfile: () => {
                                return {
                                    getImageUrl: () => {
                                        return "/testing/photo.png"
                                    },
                                    getEmail: () => {
                                        return "arakaki.tokyo@gmail.com"
                                    }
                                }
                            }
                        }
                    }
                },
                signIn: () => {
                    if (testParams.signIn) {
                        gapi.var.isSignIn = true;
                        gapi.var.listener(gapi.var.isSignIn);
                    }
                    return new Promise((resolve, reject) => {
                        if (testParams.signIn)
                            resolve();
                        else
                            reject();
                    })
                },
                signOut: () => {
                    gapi.var.isSignIn = false;
                    gapi.var.listener(gapi.var.isSignIn);
                },
                isSignedIn: {
                    get: () => {
                        return gapi.var.isSignIn;
                    },
                    listen: f => {
                        gapi.var.listener = f;
                    }
                }
            }
        }
    }
}