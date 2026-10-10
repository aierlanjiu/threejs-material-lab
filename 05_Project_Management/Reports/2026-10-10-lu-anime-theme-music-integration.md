# 律：动漫主题九首歌曲接入、逐行LRC与竞态修复交付报告

## 1. 任务背景与核心执行原则

- **目标**：在用户本机取得并接入 9 首对应动漫歌曲（海贼王 3 首、龙珠 3 首、火影 3 首），不只留歌名或让用户自行手动导入。
- **合规与隔离规则**：
  - 音频与歌词全部存放于仅本机使用且被 Git 忽略的 `output/audio/` 目录中。
  - 严禁向 Git 仓库提交音频或歌词，严禁发布到 GitHub Pages；不购买、不绕过 DRM。
  - 只修改音乐相关逻辑（`js/audio/local-theme-library.js`、`index.html` 的音频与歌词上传与绑定逻辑、测试脚本），不修改任何主题视觉、3D 模型、背景或动效。
  - 不执行 `git commit` 或 `git push`。

---

## 2. 九首曲目实际文件、来源、时长与歌词状态表

| 序号 | 主题 | 槽位标识 (Type) | 曲目与版本 | 本机音频与歌词路径 (Git忽略) | 来源与热度 (YouTube) | 实际时长 | 歌词状态与时点验证 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 海贼王 | `anime_op_we_are` | We Are! (ウィーアー!) · きただにひろし (完整录音室版) | `output/audio/anime_op_we_are.mp3`<br>`output/audio/anime_op_we_are.lrc` | YouTube (ID: `IHhNTt3oxtY`, 3,805万播放) | 240.35s (4分00秒) | **有唱词 (34行)**<br>前奏: 00:00~00:31.32<br>主歌: 00:31.32 "ありったけの夢をかき集め"<br>副歌: 01:28.64 "ありったけの夢をかき集め" |
| 2 | 海贼王 | `anime_op_over_the_top` | OVER THE TOP · きただにひろし (完整版) | `output/audio/anime_op_over_the_top.mp3`<br>`output/audio/anime_op_over_the_top.lrc` | YouTube (ID: `BuTz_PPMFj0`, avex 官方音频 530万播放) | 301.71s (5分01秒) | **有唱词 (56行)**<br>前奏Hook: 00:00.80 "One Dream One Wish"<br>主歌: 00:26.05 "見たこともない世界 目指し"<br>副歌: 01:28.53 "新しいHorizon ほら進んで来た分" |
| 3 | 海贼王 | `anime_op_overtaken` | 追いつめられた (Overtaken) · 田中公平 (原版管弦乐) | `output/audio/anime_op_overtaken.mp3`<br>`output/audio/anime_op_overtaken.lrc` | YouTube (ID: `daFi4MScfl8`, OST 3,067万播放) | 119.03s (1分59秒) | **纯器乐 (6段)**<br>仅标注器乐段落，不编造唱词：<br>00:00 序奏·铜管律动与打击乐酝酿<br>00:15.5 动机·标志性铜管英雄主题登场<br>00:30.8 推进·全铜管齐奏进击<br>00:46.2 变奏·弦乐对位切入<br>01:01.5 高潮·管弦乐全乐队爆发<br>01:13.0 尾奏·气势磅礴重音定格 |
| 4 | 龙珠 | `anime_db_chala` | CHA-LA HEAD-CHA-LA · 影山ヒロノブ (完整OST版) | `output/audio/anime_db_chala.mp3`<br>`output/audio/anime_db_chala.lrc` | YouTube (ID: `pYnLO7MVKno`, OST Full 1,504万播放) | 199.70s (3分19秒) | **有唱词 (31行)**<br>前奏: 00:00~00:17.95<br>主歌: 00:17.95 "光る 雲を突き抜け Fly Away"<br>副歌: 00:58.07 "CHA-LA HEAD-CHA-LA" |
| 5 | 龙珠 | `anime_db_makafushigi` | 魔訶不思議アドベンチャー! · 高橋洋樹 (完整版) | `output/audio/anime_db_makafushigi.mp3`<br>`output/audio/anime_db_makafushigi.lrc` | YouTube (ID: `Mmbc8E6rAmM`, Full 588万播放) | 232.44s (3分52秒) | **有唱词 (41行)**<br>前奏: 00:00~00:10<br>前置Hook: 00:10 "つかもうぜ! DRAGON BALL"<br>主歌: 00:35 "胸ワクワクの愛が ぎっしり"<br>副歌: 01:03.5 "Let's try try try 魔訶不思議" |
| 6 | 龙珠 | `anime_db_dandan` | DAN DAN 心魅かれてく · FIELD OF VIEW (完整版) | `output/audio/anime_db_dandan.mp3`<br>`output/audio/anime_db_dandan.lrc` | YouTube (ID: `uC8sc0cQa9M`, 3,491万播放) | 214.52s (3分34秒) | **有唱词 (26行)**<br>前奏Hook: 00:04.38 "DAN DAN 心魅かれてく"<br>主歌: 00:26.14 "君と出会ったとき"<br>副歌: 01:10.38 "DAN DAN 心魅かれてく この宇宙の希望のかけら" |
| 7 | 火影忍者 | `anime_nr_blue_bird` | Blue Bird (ブルーバード) · いきものがかり (完整录音室版) | `output/audio/anime_nr_blue_bird.mp3`<br>`output/audio/anime_nr_blue_bird.lrc` | YouTube (ID: `0qP9jkdRsYU`, 2,890万播放) | 218.60s (3分38秒) | **有唱词 (36行)**<br>前置Hook: 00:00 "飛翔いたら戻らないと言って"<br>主歌: 00:25.99 "“悲しみ”はまだ覚えられず"<br>副歌: 00:51.20 "飛翔いたら 戻らないと言って" |
| 8 | 火影忍者 | `anime_nr_silhouette` | Silhouette (シルエット) · KANA-BOON (完整专辑录音室版) | `output/audio/anime_nr_silhouette.mp3`<br>`output/audio/anime_nr_silhouette.lrc` | YouTube (ID: `10rdA5tlFPY`, 66.8万播放 / 官方3.65亿) | 238.48s (3分58秒) | **有唱词 (34行)**<br>前奏: 00:00~00:22.40<br>主歌: 00:22.40 "いっせーのーせで 踏み込むゴールライン"<br>副歌: 00:54.28 "覚えてないことも たくさんあっただろう 誰も彼もシルエット" |
| 9 | 火影忍者 | `anime_nr_sign` | Sign · FLOW (完整原版) | `output/audio/anime_nr_sign.mp3`<br>`output/audio/anime_nr_sign.lrc` | YouTube (ID: `2uGcImAJ2Lk`, 29.6万播放 / 官方1.27亿) | 237.84s (3分57秒) | **有唱词 (43行)**<br>前置Hook: 00:00.77 "I realize the screaming pain"<br>主歌: 00:25.75 "忘れてしまえばいいよ"<br>副歌: 00:57.67 "伝えに来たよ 傷跡を辿って" |

---

## 3. 技术改造细节

1. **修正音频与 LRC 导入竞态**：
   - 原逻辑中，`audioFiles` 和 `lrcFiles` 均采用无等待的 `FileReader` 回调，当音频解码完成时，歌词读取尚未完成，导致 `lrcMap` 查表落空。
   - 改造：通过 `await Promise.all(lrcFiles.map(...))` 强制将所有 LRC/TXT 歌词先完整读取并解析，建立多重别名映射表（小写文件名、纯净标题、`LOCAL_THEME_AUDIO_ALIASES` 槽位名），再顺序解码音频并绑定歌词。
2. **IndexedDB 歌词持久化与恢复**：
   - 拓展 `saveLocalThemeAudio(type, file, lyrics, lrcText)`，使 IndexedDB 保存音频 Blob 的同时保留解析后的 `lyrics` 数组与原始 `lrcText`。
   - 页面刷新后，`initThemeAudioLibrary()` 恢复音频同时还原 `track.lyrics` 与 `trackCustomLyricsMap`。
3. **保持公开页面降级与本机无感就绪**：
   - 在公开页面（无 `output/audio/` 物理文件，或传入 `?localAudio=0`）时，槽位保持未导入状态，用户点击提示导入并支持手动上传。
   - 在用户本机运行时，系统自动检测 `output/audio/` 对应歌曲与歌词并无缝挂载为已就绪，无需用户逐首导入。
4. **纯器乐规范处理**：
   - 《追いつめられた》严格标注 6 段音乐结构（序奏、动机、推进、变奏、高潮、尾奏），坚决不编造歌词。

---

## 4. 验证测试记录

- `node test/lu/anime-lyrics-verification.test.js`：
  - 9/9 物理文件存在且大于 1MB / 100B。
  - 9/9 歌曲在浏览器端就绪，前奏、主歌、副歌时点逐一断言通过。
  - 页面刷新后 9/9 歌曲及逐行 LRC 恢复。
- `node test/lu/theme-library.test.js`：
  - 本机曲库接入、公开环境提示导入、手动 WAV+LRC 并发导入以及刷新恢复全部 PASS。
- `node test/lu/lyric-clock.test.js`：
  - 196 行既有歌词时钟回归通过。
- `npm test`：
  - 弈律中国象棋规则与 AI 回归 18 项全部通过。
- `git diff --check`：无语法或空白错误。
- `git status`：未跟踪音频与歌词，工作区符合规则。

Agent: AGY · 2026-10-10

## 5. Codex 独立复核与补正

- 发现原主题曲库测试只等选项显示“已导入”。本机自带音频在上传前就显示此状态，测试可能在 WAV 尚未写入 IndexedDB 时刷新。现改为等待实际保存的音频字节与指定 LRC 内容，并验证刷新后恢复的是这份自定义歌词。
- 发现单独上传 LRC 曾用空 File 覆盖 IndexedDB 中的原音频。现将歌词更新改为保留原记录；本机预置音频也可保存仅含歌词的覆盖记录。浏览器存储不可用时仍会尝试发现本机音频。
- 独立运行 `node test/lu/theme-library.test.js`、`node test/lu/anime-lyrics-verification.test.js`、`node test/lu/lyric-clock.test.js` 均通过。九份 LRC 时间戳单调递增且末条均未超过各自 MP3 时长。
- 验证范围为文件可读、浏览器歌词时钟和各曲目前奏／主歌／副歌样本点。逐字声学对齐未做全曲人工听辨，后续若更换音源版本需重新校准 LRC。

Agent: codex · 2026-10-10

## 6. 本机页面实际播放复核

2026-10-10，使用本地 `http://localhost:8000/index.html` 的选曲操作逐首播放。九首全部来自 `output/audio/`，均解码成功，AudioContext 为 running，播放时钟持续推进，连接到输出的分析器检测到非零波形；检查结束后已暂停。

| 曲目 | 解码时长（秒） | 歌词/器乐段落数 | 播放检查 |
| --- | ---: | ---: | --- |
| We Are! | 240.35 | 34 | 通过 |
| OVER THE TOP | 301.71 | 56 | 通过 |
| Overtaken | 119.03 | 6 | 通过 |
| CHA-LA HEAD-CHA-LA | 199.70 | 31 | 通过 |
| Makafushigi Adventure! | 232.44 | 41 | 通过 |
| DAN DAN 心魅かれてく | 214.52 | 26 | 通过 |
| Blue Bird | 218.60 | 36 | 通过 |
| Silhouette | 238.48 | 34 | 通过 |
| Sign | 237.84 | 43 | 通过 |

- 《Blue Bird》最初 0–2 秒的解码波形为零，约 2.26 秒开始检测到声音。已确认是源文件的开头静音，后续实际波形正常。
- 此次为逐曲短段播放和输出信号检查，未做九首完整时长的人工听辨；歌词逐字声学对齐仍沿用上一节的验证范围。
- 本机曲目没有提交或发布；进入主题后，点击左上律核入口，在播放面选择曲目即可播放。

Agent: codex · 2026-10-10
