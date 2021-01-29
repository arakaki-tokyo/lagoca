## State diagram
タスクの遷移パターン
| No. | Summary       |                                                              |
| --- | ------------- | ------------------------------------------------------------ |
| 1   | ② → ④         | 正常系                                                       |
| 2   | ② → ③ → ④     | 同期スタート・非同期エンド、周期処理で同期                   |
| 3   | ① → ② → ④     | 非同期スタート、周期処理で同期・同期エンド                   |
| 4   | ① → ② → ③ → ④ | 非同期スタート、周期処理で同期・非同期エンド、周期処理で同期 |
| 5   | ① → ④         | 非同期スタート・同期エンド                                   |
| 6   | ① → ③ → ④     | 非同期スタート・非同期エンド、ユーザアクションで同期         |

![](img/state_transition.png)


## Sequence diagram
### start sequence
#### 1. click start-button

##### 処理
- グローバルオブジェクトの更新
- viewの更新
- API call
- ローカルストレージにdoingTaskをセット

##### タスクの状態
APIの応答によって以下のいずれかとなる。
- ①Unsynced
- ②Synced

![](img/start_sequence-page2.png)

#### 2. fetch G-cal
##### 処理
- グローバルオブジェクトの更新
- viewの更新
- ローカルストレージにdoingTaskをセット

##### タスクの状態
同期済みの実行中タスクを取得するため②Syncedである。
![](img/start_sequence-page3.png)

#### 3. read local-strage
##### 処理
- グローバルオブジェクトの更新
- viewの更新

##### タスクの状態
保存されたタスクの状態によって以下のいずれかとなる。
- ①Unsynced
- ②Synced

![](img/start_sequence-page4.png)

### start sequence




| function               | promise |
| ---------------------- | ------- |
| handleClientLoad       | -       |
| initClient             | -       |
| initializeStyleHandler | -       |
| toggleTaskStatus       | -       |
| pushNotification       | -       |
| timer60s               | o       |
| checkDoingTask         | o       |
| updateSigninStatus     |         |
| getEvent               |         |
| listEvent              |         |
| insertEvent            |         |
| updateEvent            |         |
| listCalendar           |         |
| insertCalendar         |         |
| handleRejectedCommon   |         |
| timeDoingTask          |         |
| doTime                 | -       |
| initializeSettings     |         |
| addDoneTaskList        | -       |
| listDoneTask           | -       |
| handleStartClick       | o       |
| handleEndClick         | o       |
| saveSettings           |         |
| handleAuthClick        |         |
| handleSignoutClick     |         |
| myInit                 |         |





| table      | table    | table                                                       | 実装  | check | 観点                   | memo                         |
| ---------- | -------- | ----------------------------------------------------------- | :---: | :---: | ---------------------- | ---------------------------- |
| -          | normal   | ログイン→カレンダー変更→スタート→終了                       |   o   |   x   | row                    | row                          |
| -          | abnormal | カレンダー変更→Gカレ上でカレンダー削除                      |   o   |   x   | 周期処理で通知出す     | row                          |
| initialize | normal   | 終了済みタスクの表示                                        |   x   |  row  | row                    | 同期できなかったタスクの表示 |
| start task | abnormal | スタート → エラー条件発生                                   |   o   |  row  | 周期処理で通知         | row                          |
| start task | abnormal | エラー条件 → スタート → エラー条件解消                      |   o   |  row  | 周期処理で同期         | row                          |
| done task  | abnormal | エラー条件 → スタート → エラー条件解消 → 周期処理前にエンド |   o   |  row  |                        | row                          |
| end task   | abnormal | エラー条件 → スタート → 終了                                |   x   |  row  | 未同期ステータスで終了 | row                          |
| row        | row      | row                                                         |  row  |  row  | row                    | row                          |
| row        | row      | row                                                         |  row  |  row  | row                    | row                          |
| row        | row      | row                                                         |  row  |  row  | row                    | row                          |
| row        | row      | row                                                         |  row  |  row  | row                    | row                          |