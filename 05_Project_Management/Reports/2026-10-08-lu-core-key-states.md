# 『律核』(LÜ Core) 关键状态设计稿规范

## 1. 核心定义与设计意图

把现有演出状态胶囊（`#performanceCapsule`）升级为全局**唯一视觉入口**。
- **收起状态（Collapsed）**：
  - 手机入口（≤ 760px）：`168px × 48px`
  - 桌面入口（> 760px）：`206px × 48px`
  - 视觉呈现：墨黑底色（`#181820`）、冲击红徽标（`#CE342D` “律”标，`32×32`）、米白发丝边框（`#EDE2CF`）及 4 柱动态声波条。
  - 真实状态感知：
    - 非录制状态：展示真实曲目名称与播放状态（就绪、播放中、已暂停、BPM），跟随音频频谱与乐章。
    - 录制中状态：**持续高亮冲击红边框，闪烁红点（●）与 mm:ss 计时器**。节拍与歌词流变事件**绝不覆盖**录制计时与红点。
  - 环境收拢：顶栏其他多行控件（原平铺播放器、快捷操作、模式栏）及浮动按钮在收起时隐藏，普通手机顶栏由原来的多行（>160px）极大收敛为单行（48px-52px），大幅释放 WebGL 主舞台。
  - 沉浸模式：舞台 100vw × 100dvh 全屏，歌词条居中可见；右上角仅保留胶囊的极简形态（“律 · 沉浸中”，点击或按 Esc/F 安全退出）。

- **展开状态（Expanded · 四面工作台）**：
  - 交互触发：点击胶囊、键盘 Enter/Space 或按快捷键展开。
  - 手机展开高度：限制在 `max-height: 35dvh`，支持内联滚动与平滑操作。
  - 顶部 Tab 导航（Segmented Rail）：
    1. **【播放】(Play)**：播放/暂停/上一首/下一首/停止，当前曲目与乐章，选歌下拉列表，本地音乐导入，时间与进度滑块，实时声波频谱。
    2. **【演出】(Choreo)**：歌词三模式（机械魔方/物理反重力/关闭），6 款波形样本板（水波/巨浪/针雕/涡流/心跳/脉冲），3 档运动强度（沉静/律动/冲击），节拍旋钮（4/8/16/32拍），振幅滑块与声波开关，预设镜头（正面/等轴/俯视）与视角重置，沉浸模式入口。
    3. **【创作】(Create)**：12 款材质样本库与色调取色，矩阵规格（1×1 ~ 8×8、3D魔方、行列层数与队形），角色内容（29位角色表情、注视、眨眼、歌词时钟偏移步进器），深度参数直通（点击直达展开二级检查器 `#inspectorPanel`）。
    4. **【录制】(Record)**：母带导出画幅（横屏 16:9 / 超宽 21:9 / 竖屏 9:16），通用格式（优先 MP4 / WebM），录制触发核心（待机/录制中/封装/导出成功与失败），录制状态读秒与实时反馈。
  - **防干扰约束**：音乐节拍（beat pulse）和动态歌词（lyric roll）刷新时，保持当前选中的工作台 Tab 面固定不变，严禁切走用户操作焦点。

---

## 2. 状态映射表

| 状态 | 胶囊视觉 (入口) | 四面工作台 (展开) | 辅助组件行为 |
|---|---|---|---|
| **待机收起 (Idle Collapsed)** | `168×48` (移动) / `206×48` (桌面)；墨黑底、米白框、红标“律”；文字“律 · 就绪” | 收起隐藏 (`display: none` / `pointer-events: none`) | 顶栏其他控件隐藏；普通手机顶栏单行化 |
| **播放收起 (Playing Collapsed)** | 真实歌曲名（如《游京》）；4 柱音频频谱跳动；时间/BPM 轮转 | 收起隐藏 | 舞台专注渲染，无多余浮动控件阻挡 |
| **录制收起 (Recording Collapsed)** | 冲击红框，冲击红呼吸圆点 `●` + 动态计时 `00:15`；状态字“正在录制” | 可根据需要收起或展开 | 无论音频打拍/歌词更新，录制红点与计时不被冲掉 |
| **展开-播放面 (Expanded Play)** | 胶囊呈现 `aria-expanded="true"`，高亮激活态 | 激活播放面：展示母带中枢、控制按钮、时间轨与导入 | 手机高度 ≤ 35dvh；不重叠舞台主视区 |
| **展开-演出面 (Expanded Choreo)**| 同上，Tab 切换至“演出” | 激活演出面：歌词三模式、6 波形、3 强度、节拍、振幅、镜头 | 支持组内滑动或原位切换 |
| **展开-创作面 (Expanded Create)**| 同上，Tab 切换至“创作” | 激活创作面：材质库、色调、矩阵预设、角色活体、深度检查器入口 | 点击“深度参数”平滑联动检查器 |
| **展开-录制面 (Expanded Record)**| 同上，Tab 切换至“录制” | 激活录制面：画幅（16:9 / 21:9 / 9:16）、格式、录制/停止主控 | 点击开始录制后胶囊与按钮状态联动 |
| **沉浸模式 (Immersive)** | 极简微型胶囊浮于右上（`118×36`），红标“律” + “返回”，点击即退出 | 收起隐藏 | 舞台 100vw × 100dvh 全屏，歌词条居中保留 |

---

## 3. DOM 复用与不可变更契约

1. **零冗余 ID 契约**：所有控件复用现有节点：
   - `#performanceCapsule`, `#playPauseBtn`, `#recordToggle`, `#prevTrackBtn`, `#nextTrackBtn`, `#stopTrackBtn`
   - `#timeDisplay`, `#timeProgressSlider`, `#playlistSelect`, `#audioUpload`, `#audioVisualizer`
   - `#kineticModeSwitcher`, `#wavePatternGroup`, `#intensityTierGroup`, `#morphFreqGroup`, `#beatDialGraphic`
   - `#waveAmpSlider`, `#waveMotionToggle`, `.preset-cam-group`, `#resetCam`, `#immersiveToggle`
   - `#materialSamples`, `#materialTones`, `#gridPresetGroup`, `#contentModeGroup`, `#lyricOffsetInput`
   - `#videoAspectSelect`, `#videoFormatSelect`, `#recordStatusAnnouncement`
   - `#workbenchDock`, `#inspectorPanel`
2. **动效性能与可访问性**：
   - 动效限于 `transform` 与 `opacity`（150ms-220ms 短促平滑）。
   - 支持 `prefers-reduced-motion: reduce`（时长归零）。
   - 支持按键操作：`Escape` 收起面板并焦点返回至胶囊；`ArrowLeft`/`ArrowRight` 切换 Tab；`Space`/`Enter` 激活。
   - 视频录制使用离屏画布 `recording-compositor.js`，绝不混入控件 DOM。
