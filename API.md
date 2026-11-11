# 盐线行动 API 文档

## 概览

- 运行方式：`npm install --omit=dev` 后执行 `npm start`（等价 `node index.js`）
- 运行环境：Node.js 18+，CommonJS
- 监听地址：从环境变量 `PORT` / `HOST` 读取
- 页面地址：`http://$HOST:$PORT/`
- 实时通信：同端口 WebSocket，玩家路径 `/ws`
- 数据格式：WebSocket 文本帧为 JSON；玩家语音为二进制 PCM 帧
- 国际化：`lang` cookie，可选 `zh-CN` / `en-US`；接口提示文案随语言变化
- 持久化：排行榜写入 `data/leaderboard.json`，通过 `config/storage.js` 原子写入。
- 内容安全：玩家代号与全服大字在服务端统一做敏感词过滤；拆字、全角、零宽字符、符号替代与常见同形字规避同样会被识别。

## 页面

### 首页（游戏）

- 方法：`GET`
- 路径：`/`
- 参数：可选 `?lang=zh-CN` 或 `?lang=en-US`，会同步写入 `lang` cookie
- 说明：多人 3D 港口枪战首页，包含在线人数、战场名单、5 秒复活、全服开麦语音、单独静音与全服大字。游戏内标题页、暂停菜单与战场名单面板均提供 GitHub 仓库链接 `https://github.com/wenzhengshi/fable5-2-salt-online`。
- 缓存：`Cache-Control: no-store`

### 静态资源

- 方法：`GET`
- 路径：`/css/*`、`/js/*`
- 说明：游戏样式、Three.js 游戏 bundle、多人对战、全服开麦语音与大字客户端脚本。

## 内容安全与敏感词拦截

- 生效范围：`join` / `rename` 的玩家代号、`chat` 全服大字，以及从 `data/leaderboard.json` 载入的历史排行榜代号。
- 代号：命中敏感词的实时改会被拒绝，服务端返回 `nameDenied`，原代号保持不变；首次 `join` 命中时会自动分配安全代号，并在 `joined` 中标记 `filtered: true`。
- 大字：命中敏感词时整条消息不会广播，服务端返回 `chatDenied`（`reason: "filtered"`），并计入 1200 ms 冷却；前端会保留本次输入便于修改。
- 排行榜：历史数据中命中敏感词的代号不会加载、展示或继续累加战绩。
- 规避识别：服务端会归一化 Unicode NFKC、大小写、全角字符、零宽/控制字符、变音符号、标点与空格拆字、数字/符号替代（如 `sh1t`、`a$$hole`）和常见西里尔/希腊同形字，并容忍重复字符。
- 过滤类别：`profanity`、`sexual`、`hate`、`violence`、`evasion`、`profanity-zh`、`sexual-zh`。

## 公共 API

### 健康检查

- 方法：`GET`
- 路径：`/api/health`
- 参数：无
- 返回示例：`{"ok":true,"message":"服务正常","lang":"zh-CN","uptimeSeconds":12}`

### 游戏元信息

- 方法：`GET`
- 路径：`/api/game/meta`
- 返回字段：
  - `mode`：`free-for-all`
  - `respawnSeconds`：复活等待秒数，当前为 `5`
  - `online`：当前 WebSocket 在线连接数
  - `websocket`：`/ws`
  - `moderation.enabled`：内容安全过滤是否启用
  - `moderation.names` / `moderation.chat`：代号与大字是否启用过滤
  - `moderation.evasionResistant`：是否启用拆字与同形字规避识别
  - `moderation.categories`：当前过滤类别列表
  - `comms.voice`：`server-pcm-relay`
  - `comms.sampleRate`：`16000`
  - `comms.frameMs`：`20`
  - `comms.globalAudience`：`true`
  - `comms.listenerMicRequired`：`false`
  - `controls`：本地化操作列表
- 返回示例：`{"ok":true,"version":"1.11.0","mode":"free-for-all","respawnSeconds":5,"websocket":"/ws","moderation":{"enabled":true,"names":true,"chat":true,"evasionResistant":true},"comms":{"voice":"server-pcm-relay","sampleRate":16000,"frameMs":20,"globalAudience":true,"listenerMicRequired":false},"controls":[{"keys":"WASD","label":"移动"}]}`

### 排行榜与在线列表

- 方法：`GET`
- 路径：`/api/game/leaderboard`
- 参数：可选 `?limit=1..100`，默认 `20`
- 返回字段：`online`、`respawnSeconds`、`players[]`、`leaderboard[]`
- 说明：战绩在击杀 / 死亡时累加，并异步写回 `data/leaderboard.json`（保留前 300 条）。命中敏感词的历史代号会被过滤，不会出现在在线列表或排行榜中。

### 问候接口

- 方法：`GET`
- 路径：`/api/hello`
- 返回示例：`{"message":"你好，世界！"}`

### 切换语言

- 方法：`POST`
- 路径：`/api/lang`
- Body：`{"lang":"zh-CN"}` 或 `{"lang":"en-US"}`
- 说明：写入有效期一年的 `lang` cookie；非法值回退为 `zh-CN`。

## WebSocket `/ws`

### 连接

- 地址：`ws://$HOST:$PORT/ws`（HTTPS 页面使用 `wss://`）
- 协议：JSON 文本帧用于游戏状态与聊天；二进制帧用于玩家语音
- 心跳：服务端每 30 秒发送 WebSocket ping
- 鉴权：无需登录；连接后获得临时玩家 ID（如 `p12`）

### 客户端 → 服务端（文本）

| `type` | 字段 | 说明 |
| --- | --- | --- |
| `join` | `name`, `spawns[]` | 设置代号与可用出生点；代号命中敏感词时自动分配安全代号，并在 `joined` 中返回 `filtered: true` |
| `spawns` | `spawns[]` | 更新出生点列表，最多 32 个 |
| `chat` | `text` | 全服大字，最长 80 字，冷却 1200 ms；命中敏感词返回 `chatDenied` 且不广播 |
| `voiceState` | `enabled`, `muted`, `speaking` | 同步麦克风开关、静音、说话状态 |
| `rename` | `name` | 修改代号，最长 16 字；命中敏感词返回 `nameDenied` 并保留原代号 |
| `state` | `pos`, `yaw`, `pitch`, `active`, `moving`, `sprint`, `crouch` | 10 Hz 位置与动作状态 |
| `shot` | `origin`, `dir` | 射击特效广播 |
| `hit` | `targetId` | 命中判定，服务端校验距离与保护状态 |
| `died` | 无 | 主动上报死亡 |
| `respawn` | 无 | 请求复活；死亡后至少等待 5 秒 |
| `ping` | `t` | 延迟探测，服务端回 `pong` |

### 客户端 → 服务端（二进制）

- 只有 `voiceState.enabled=true` 且 `muted=false` 时，服务端才接受音频。
- 帧格式：无头部裸 PCM；16000 Hz、单声道、signed 16-bit little-endian。
- 客户端每 20 ms 发送 320 个采样（640 字节）；单帧最大 8192 字节，每秒最多 96 KB。

### 服务端 → 客户端（文本）

| `type` | 字段 | 说明 |
| --- | --- | --- |
| `welcome` | `id`, `name`, `color`, `respawnMs`, `online`, `voiceRelay` | 连接即发送；`voiceRelay` 描述全局语音参数 |
| `joined` | `id`, `name`, `color`, `renamed`, `filtered` | 代号生效或改名成功；`renamed` 表示主动改名，`filtered` 表示原代号被拦截并分配了安全代号 |
| `nameDenied` | `reason` | `filtered`（敏感词）或 `invalid`（空代号）；改代号失败时原代号不变 |
| `snapshot` | `t`, `online`, `players[]`, `roster[]`, `voice[]`, `you` | 10 Hz 状态帧；`voice[]` 只包含已开麦玩家 |
| `voiceState` | `player{id,name,color,enabled,muted,speaking}` | 开麦、静音、说话状态变化 |
| `chat` | `id`, `name`, `color`, `text`, `at` | 全服大字消息 |
| `chatDenied` | `reason`, `retryIn` | `rate`、`empty` 或 `filtered`；敏感词消息不会广播 |
| `kill` | `killer`, `victim`, `at` | 击杀事件 |
| `youDied` | `by`, `respawnIn`, `respawnAt` | 自己倒下 |
| `damaged` | `amount`, `hp`, `from` | 受到伤害 |
| `hitConfirm` | `targetId`, `damage`, `hp`, `killed`, `blocked` | 命中确认 |
| `respawned` | `pos`, `yaw`, `protectedUntil` | 复活成功 |
| `respawnWait` | `ms` | 复活等待剩余毫秒 |
| `notice` | `kind`, `name`, `id`, `previous`, `reason` | 加入 / 离开 / 复活 / 改名通知 |
| `shot` | `id`, `origin`, `dir` | 其他玩家射击特效 |
| `pong` | `t` | 延迟响应 |

### 服务端 → 客户端（二进制）

玩家开麦并发送音频后，服务端把同一帧中继给**除发送者以外的所有在线玩家**，不要求接收方开麦。

- 帧头：5 字节。第 1 字节固定为 `0x56`（`V`），第 2–5 字节为 little-endian `uint32` 发送者数字 ID。
- 帧体：原始 PCM；16000 Hz、单声道、signed 16-bit little-endian。
- 示例：发送者 `p12` 的帧头为 `56 0C 00 00 00`，其后紧跟 PCM 数据。
- 收听端按发送者 ID 分轨缓冲播放；可静音全部语音，也可点击玩家单独静音。
- 服务端不保存、不落盘语音数据。

### 语音流程

```text
玩家 A → /ws {"type":"voiceState","enabled":true,"muted":false}
玩家 A → /ws <binary PCM 640 bytes>（每 20 ms）
服务端 → 玩家 B /ws <binary header + PCM>
服务端 → 玩家 C /ws <binary header + PCM>
玩家 B（未开麦）→ Web Audio 播放
玩家 B → 点击静音 → 本地停止播放，不影响其他玩家
玩家 A → {"type":"voiceState","enabled":true,"muted":true}
服务端 → 停止转发 A 的音频
```

## 错误响应

- 未知 API：`404`，`{"ok":false,"message":"接口不存在"}`
- 非法请求体：`400`，`{"ok":false,"message":"请求格式不正确"}`
- 服务端异常：`500`，`{"ok":false,"message":"服务器暂时不可用，请稍后重试"}`
- WebSocket 非法 JSON / 未知 `type`：静默丢弃
- WebSocket 非法音频帧：静默丢弃
