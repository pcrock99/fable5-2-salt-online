# 盐线行动 API 文档

## 概览

- 运行方式：`npm install --omit=dev` 后执行 `npm start`（等价 `node index.js`）
- 监听地址：从 `.env` 的 `PORT` / `HOST` 读取
- 页面地址：`http://$HOST:$PORT/`
- 实时对战：同端口 WebSocket，路径 `/ws`
- 数据格式：JSON（WebSocket 使用 JSON 文本帧）
- 国际化：`lang` cookie，可选 `zh-CN` / `en-US`；所有接口的提示文案随语言变化
- 持久化：仅通过 `config/storage.js` 读写本地 `data/` 目录中的 JSON 文件（排行榜：`data/leaderboard.json`）

## 页面

### 首页（游戏）

- 名称：首页
- 方法：`GET`
- 路径：`/`
- 参数：可选查询参数 `?lang=zh-CN` 或 `?lang=en-US`，会同步写入 `lang` cookie
- 说明：渲染 `views/index.ejs`，加载多人在线 3D 港口枪战、语言切换、在线人数、战场名单与复活界面。
- 缓存：`Cache-Control: no-store`

### 静态资源

- 名称：游戏资源
- 方法：`GET`
- 路径：`/css/*`、`/js/*`
- 参数：无
- 说明：提供游戏样式、Three.js 游戏 bundle、多人对战客户端（`/js/multiplayer.js`）、无限弹药补丁、自由航行模式与客户端 i18n 脚本。

## API

### 健康检查

- 名称：健康检查
- 方法：`GET`
- 路径：`/api/health`
- 参数：无
- 返回示例：`{"ok":true,"message":"服务正常","lang":"zh-CN","uptimeSeconds":12}`
- 说明：返回服务状态、当前语言与运行时长。

### 游戏元信息

- 名称：游戏元信息
- 方法：`GET`
- 路径：`/api/game/meta`
- 参数：无
- 返回字段：
  - `mode`：固定为 `free-for-all`（自由混战）
  - `respawnSeconds`：复活等待秒数，当前为 `5`
  - `online`：当前 WebSocket 在线连接数
  - `websocket`：实时对战路径，固定为 `/ws`
  - `controls`：本地化键鼠操作列表（含 `Tab` 战场名单）
- 返回示例：`{"ok":true,"lang":"zh-CN","title":"盐线行动","version":"1.1.0","engine":"WebGL / Three.js (bundled)","mode":"free-for-all","respawnSeconds":5,"online":3,"websocket":"/ws","controls":[...]}`
- 说明：返回本地化标题、版本、引擎、对战模式与操作列表。

### 排行榜与在线列表

- 名称：排行榜
- 方法：`GET`
- 路径：`/api/game/leaderboard`
- 参数：可选查询参数 `?limit=1..100`，默认 `20`
- 返回字段：
  - `online`：在线连接数
  - `respawnSeconds`：复活等待秒数
  - `players`：当前在线玩家（`id`、`name`、`color`、`kills`、`deaths`、`streak`、`alive`、`active`）
  - `leaderboard`：累计战绩（`name`、`kills`、`deaths`、`bestStreak`、`updatedAt`），按击杀降序
- 返回示例：`{"ok":true,"lang":"zh-CN","online":2,"respawnSeconds":5,"players":[{"id":"p1","name":"RAVEN-42","color":"#ffb347","kills":3,"deaths":1,"streak":2,"alive":true,"active":true}],"leaderboard":[{"name":"RAVEN-42","kills":3,"deaths":1,"bestStreak":2,"updatedAt":1730000000000}]}`
- 说明：战绩在击杀 / 死亡时累加，并异步写回 `data/leaderboard.json`（保留击杀数最高的 300 条）。

### 问候接口

- 名称：问候
- 方法：`GET`
- 路径：`/api/hello`
- 参数：无
- 返回示例：`{"message":"你好，世界！"}`
- 说明：返回当前语言下的问候语，用于连通性检查。

### 切换语言

- 名称：切换语言
- 方法：`POST`
- 路径：`/api/lang`
- Body：`{"lang":"zh-CN"}` 或 `{"lang":"en-US"}`
- 返回示例：`{"ok":true,"message":"语言已切换","lang":"zh-CN"}`
- 说明：写入 `lang` cookie（有效期一年，`SameSite=Lax`）并返回本地化确认文案。非法值回退为 `zh-CN`。

## WebSocket 实时对战

### 连接

- 地址：`ws://$HOST:$PORT/ws`（HTTPS 页面使用 `wss://`）
- 协议：JSON 文本帧，单帧上限 16 KB
- 心跳：服务端每 30 秒发送 WebSocket ping，客户端应正常回应 pong；客户端可发送应用层 `ping` 测延迟
- 限流：单连接每秒最多 160 条消息，超出部分丢弃
- 服务端快照频率：10 Hz（每 100 ms 一帧）

### 对战规则

- 模式：自由混战（free-for-all），所有其他玩家均为敌人，各自独立作战
- 生命值：100；单次命中伤害 34（3 次命中击倒）
- 复活：被击倒后等待 **5 秒**，由客户端发送 `respawn` 后在距敌人最远的出生点重新进入战场
- 保护：复活后 2 秒无敌，期间被命中会返回 `hitConfirm.blocked = true`
- 命中校验：服务端校验双方存活、在线状态与距离（90 米内），客户端仅做表现层判定
- 名牌与坐标：快照只包含处于战场中（`active && alive`）的玩家

### 客户端 → 服务端

| `type` | 字段 | 说明 |
| --- | --- | --- |
| `join` | `name`(string, 1-16), `spawns`(array<{x,y,z}>) | 加入战场并设置代号与出生点，服务端返回 `joined`，重名自动追加 `#2` 等后缀 |
| `spawns` | `spawns`(array<{x,y,z}>) | 场景就绪后更新可用出生点（最多 32 个），不触发加入提示 |
| `rename` | `name`(string) | 修改代号，返回新的 `joined` 并向其他人广播 `notice.rename` |
| `state` | `pos`{x,y,z}, `yaw`, `pitch`, `active`, `moving`, `sprint`, `crouch` | 上报位置与动作，建议 10 Hz；`active=false` 时不出现在其他人的视野中 |
| `shot` | `origin`{x,y,z}, `dir`{x,y,z} | 上报枪口位置与方向，服务端转发给其他在线玩家用于曳光弹表现（限速约 18 发/秒） |
| `hit` | `targetId`(string) | 上报本地命中，服务端扣血并返回 `hitConfirm`；目标被击倒时广播 `kill` |
| `died` | 无 | 被 AI 或其他非 PvP 原因击倒时上报，服务端记录死亡并启动 5 秒复活计时，返回 `deathAck` |
| `respawn` | 无 | 请求复活；计时未结束时返回 `respawnWait`，否则返回 `respawned` |
| `ping` | `t`(number) | 应用层延迟探测，服务端原样返回 `pong` |

### 服务端 → 客户端

| `type` | 字段 | 说明 |
| --- | --- | --- |
| `welcome` | `id`, `name`, `color`, `respawnMs`, `online` | 连接建立后立即发送，分配临时代号与专属颜色 |
| `joined` | `id`, `name`, `color` | 加入成功或改名成功后的确认 |
| `snapshot` | `t`, `online`, `players[]`, `roster[]`, `you` | 10 Hz 状态帧；`players` 仅含战场上可见玩家（`id`、`name`、`color`、`x`、`y`、`z`、`yaw`、`pitch`、`hp`、`moving`、`sprint`、`crouch`、`shield`） |
| `kill` | `killer`{id,name,color}\|null, `victim`{id,name,color}, `at` | 击倒播报，用于击杀信息流与排行榜 |
| `notice` | `kind`(`join`/`leave`/`return`/`rename`), `name`, `id`, 可选 `previous` | 玩家进入 / 离开 / 复活 / 改名提示 |
| `shot` | `id`, `origin`{x,y,z}, `dir`{x,y,z} | 其他玩家的射击，用于绘制曳光弹 |
| `damaged` | `amount`, `hp`, `from`{id,name,color,pos} | 你被 PvP 命中，客户端据此扣血与显示受击方向 |
| `hitConfirm` | `targetId`, 可选 `damage`, `hp`, `killed`, `blocked` | 命中确认；`blocked=true` 表示目标处于复活保护 |
| `youDied` | `by`{id,name,color}\|null, `respawnIn`, `respawnAt` | 你被击倒，客户端展示 5 秒复活倒计时 |
| `deathAck` | `respawnIn`, `respawnAt` | 收到 `died` 后的确认，含服务端复活时间戳 |
| `respawnWait` | `ms` | 复活请求过早，附带剩余毫秒数 |
| `respawned` | `pos`{x,y,z}, `yaw`, `protectedUntil` | 复活成功，客户端在该位置重生并获得短暂保护 |
| `pong` | `t` | 对应用层 `ping` 的响应，用于计算延迟 |

### 交互示例

```text
客户端 → {"type":"join","name":"RAVEN-42","spawns":[{"x":-6,"y":0,"z":18}]}
服务端 → {"type":"joined","id":"p3","name":"RAVEN-42","color":"#5fd0ff"}
服务端 → {"type":"snapshot","t":1730000000000,"online":2,"players":[...],"roster":[...],"you":{...}}
客户端 → {"type":"hit","targetId":"p1"}
服务端 → {"type":"hitConfirm","targetId":"p1","damage":34,"hp":32,"killed":false}
客户端 → {"type":"died"}
服务端 → {"type":"deathAck","respawnIn":5000,"respawnAt":1730000005000}
客户端 → {"type":"respawn"}
服务端 → {"type":"respawned","pos":{"x":-6,"y":0,"z":18},"yaw":2.14,"protectedUntil":1730000007000}
```

## 错误响应

- 未知 API：`404`，`{"ok":false,"message":"接口不存在"}`
- 非法请求体：`400`，`{"ok":false,"message":"请求格式不正确"}`
- 服务端异常：`500`，`{"ok":false,"message":"服务器暂时不可用，请稍后重试"}`
- WebSocket 非法 JSON / 未知 `type`：静默丢弃，不返回错误帧
