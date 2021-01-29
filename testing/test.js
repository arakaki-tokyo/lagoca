"use strict";
const style = {
    bold: ["font-weight: bold;", ""],
    red: ["font-weight: bold;color: red;", ""],
    blue: ["font-weight: bold;color: hsl(210,100%,70%)", ""],
};
const myLog = (arg1, arg2) => {
    const arg2Style = arg2? style.blue: style.red;
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
            items: []
        }
    },
    calendarListList: true,
    calendarListRet: {
        result: {
            items: [{ summary: "test" }]
        }
    },
    calendarsInsert: true,
};

const gapi = {
    var: {
        isSignIn: true,
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
                        if (testParams.eventsInsert)
                        resolve(testParams.eventsInsertRet);
                        else
                        reject();
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
            },
            calendarList: {
                list: () => {
                    myLog("calendarList.list", testParams.calendarListList);
                    return new Promise((resolve, reject) => {
                        if (testParams.calendarListList)
                        resolve(testParams.calendarListRet);
                        else
                        reject();
                    })
                }
            },
            calendars: {
                insert: arg => {
                    myLog("calendars.insert", testParams.calendarsInsert);
                return new Promise((resolve, reject) => {
                        if (testParams.calendarsInsert)
                            resolve();
                        else
                            reject();
                    })
                }
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
                                        return "at.renew@gmail.com"
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