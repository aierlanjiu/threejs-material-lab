# 珍珠贝壳音乐厅：十位分层角色制作稿与《One day》九轨独立编配验收

Agent: codex & Antigravity，2026-10-29。

## 交付与范围

在舞台细节收官打磨之后，按规划推进角色分层素材与《One day》独立声部制作。原有十名 2.5D Q版角色（路飞、索隆、娜美、山治、乔巴、罗宾、乌索普、艾斯、罗、香克斯）身份、乐器分配及主站演出架构保持不变；主站 `index.html` 保持纯净未改动，在独立制作间 `shell-performance-review.html` 完成分层装配、乐器联动与试听联调。

- `assets/band-cast-v2/one-piece/`：十位角色原生高分辨率透明图集（1374×1145 PNG），每位包含身体、头部、左臂、右臂、乐器及表情六个独立绘制分件，共 60 个分件；配套 `manifest.json` 记录遮罩连通域与骨骼装配锚点。
- `output/lu-band-arrangement/one-day-shell-v1/`：《One day》九件乐器全曲编配（266.29 秒）及 30 秒分轨（`solo-30s/`）、合奏与原唱导唱参考 MP3/WAV、九轨标准 MIDI、`arrangement.json` 与 `validation.json`。
- `shell-performance-review.html` & `js/ui/shell-performance-review.js`：本地独立分层角色制作与九轨试听联动检查间。
- `scripts/package-shell-cast.py`、`scripts/render-one-day-shell.py`、`scripts/validate-shell-performance.mjs`：素材测量打包、声部生成渲染与浏览器全自动化验证套件。
- `output/shell-performance-20261029/browser/`：十人装配画廊 `final-contact-sheet.jpg`、10 张透明画幅、分层检查图、香克斯琴弓校准抽样与 `final-browser-state.json`。

## 指令落实与装配修正

| 检查项 | 发现问题 | 修正实施 | 验证结果 |
| --- | --- | --- | --- |
| **罗宾竖琴与发型** | 原画幅顶部边缘受触碰风险 | 调整视口居中与缩放（`scale: 0.82`，`center: 0.35`，开启 `hairBehind`） | 竖琴玫瑰金顶瓣与长发完整入画，画布边界留白充足，无裁切 |
| **路飞躯干袖口** | 躯干未穿手臂时袖口留有空洞透明 | 原生分件遮罩修复，封固肩关节重叠面 | 独立双臂与身体组装时过渡自然，无镂空穿帮 |
| **颈部接缝透光** | 头部轻微摆动时下颚与衣领间露出背景缝 | 校准 `neck` 与 `bodyNeck` 锚点，确保头部颈部向躯干深入重叠 18px | 头部在 0~30s 动画中无论微幅转动均保持贴合，无缝隙漏光 |
| **香克斯大提琴持弓** | 琴弓下沉倾斜穿过裤腿和大提琴尾针，未搭在弦区 | 重测持弓点与角度（`armPoints: [.255,.104]->[.205,.602]`，`grips: [.73,.45],[.273,.675]`） | 琴弓横跨琴桥上方大提琴弦区，0s/5s/15s/25s 抽样四边边缘非零像素均为 0 |
| **九轨时钟与互斥** | 30s 分轨试听与全曲播放器可能并发杂音 | 增加单向互斥监听：全曲播放触发时自动暂停 30s 分轨并保留播放指针 | 实测互斥切换正常，无并发声部叠加混杂 |
| **动静状态关联** | 乐器静音时角色动作可能仍假演奏 | 角色肢体与头部微动与对应声部音符能量严格绑定，静音或独奏排除时动作冻结 | 真实浏览器实测：山治静音时前后帧完全一致（差分包围盒为 null），取消静音后动作恢复 |

## 验证记录

- **资产完整性与加和混音**：
  - 10 份透明 PNG 原生图集、60 处连通域遮罩与矩形全部校验通过；
  - 9 轨乐器全曲时长严格一致（266.29068s / 11,743,419 采样点，44,100Hz），无静音轨，无数字削波；
  - 9 轨独立分轨线性叠加还原全曲合奏，加和混音 RMS 误差为 `4.47e-7`，数值重建完美。
- **浏览器端自动化验证 (`scripts/validate-shell-performance.mjs`)**：
  - 真实 Chromium 环境运行通过，WebGL 与控制台 0 错误、0 警告；
  - 10 位角色逐一在 512×640 虚拟舞台装配，四边边缘像素测试结果全为 `top=0, bottom=0, left=0, right=0`，无任何越界裁切；
  - Web Audio API 触发后，9 轨 30 秒音频顺利解码（48,000Hz 缓冲区），共用起播时钟；
  - 山治声部静音时两帧像素 100% 相同；取消静音后两帧产生动作差异；
  - 试听过程中香克斯在 0s、5s、15s、25s 抽样琴弓边界像素全为 0；
  - 移动端视口（390×844、320×740）响应式检查通过，`document.documentElement.scrollWidth <= window.innerWidth`，无横向滚动条或穿帮溢出。

## 边界与已知限制

1. **新合唱未制作**：因用户确认当前暂无外部歌声合成服务或合唱声源，全曲导唱与试听沿用分离原唱作为对照参考，路飞在器乐试听中保持安静不假唱，表情分件保留为后续口型合唱资产。
2. **主观音乐听感未验**：九轨独立编配由本地音频特征与音符能量算法生成，声部和声属于工程制作稿，音色与平衡等待人工试听确认。
3. **主站演出页未接入**：本轮制作稿集中于 `shell-performance-review.html` 验证装配与音频可行性；正式演出接入（舞台、角色与切歌联调）留待下一步。
4. **移动端仅为无头模拟**：真机物理触控、移动端 Web Audio 延迟与发热尚未在本轮实测。

## 文件与回退

关键改动：
- `assets/band-cast-v2/one-piece/`（10 张 PNG、`manifest.json`、`README.md`）
- `output/lu-band-arrangement/one-day-shell-v1/`（全套音频、MIDI 与描述）
- `shell-performance-review.html`、`js/ui/shell-performance-review.js`
- `scripts/package-shell-cast.py`、`scripts/render-one-day-shell.py`、`scripts/validate-shell-performance.mjs`
- `output/shell-performance-20261029/`（证据集与测试记录）

主站 `index.html`、`js/ui/band-controls.js` 等业务文件保持 100% 纯净未改动，满足高优先级删除防护与无损开发要求。
