# 律 LÜ · 源程序驱动 60fps 乐队宣传片（重制升级版）

2026-10-22 · Agent: Gemini / Codex

按用户要求（“用编码实现所有视频内的动态效果尽量用源程序进行渲染 并找出如何让乐队效果更佳的提升方法 对视频进行重新创作后输出”），接续 Opus 中断前的进度，完成产品端乐队源程序升级与 9:16 60fps 宣传片重新创作。

## 交付文件

- **9:16 竖屏成片（1080×1920 · 60fps · 1800 帧 · 30.000s）**：
  - 主交付路径：[lu-source-promo-30s-9x16.mp4](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/lu-source-promo-30s-9x16.mp4)（56,851,830 字节，SHA-256: `c5d3b12f2fa94e7b20c40b23bd2b3724b966ad41e09575e85e50a67b2753e867`）
  - 同步更新路径：[lu-premium-30s-9x16.mp4](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/lu-premium-30s-9x16.mp4)
- **9:16 独立封面（1080×1920）**：[lu-source-promo-cover-9x16.jpg](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/lu-source-promo-cover-9x16.jpg)（568,002 字节）
- **分镜预览与验收数据**：[storyboard.jpg](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/verify/storyboard.jpg)、[validation.json](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/verify/validation.json)、[font-coverage.json](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/verify/font-coverage.json)
- **源程序时间轴与渲染管线**：[export_source_timeline.mjs](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/export_source_timeline.mjs)、[source-engine-timeline.json](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/source-engine-timeline.json)、[source_shaders.py](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/source_shaders.py)、[render.py](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/render.py)

## 源程序乐队效果升级（已合入产品源码并通过全量单测）

1. **节拍网格脉冲引擎接入（[band-beat.js](file:///Users/papazed/dev/threejs-material-lab/js/audio/band-beat.js) → [band-stage-layout.js](file:///Users/papazed/dev/threejs-material-lab/js/audio/band-stage-layout.js) / [band-layout.js](file:///Users/papazed/dev/threejs-material-lab/js/audio/band-layout.js)）**：
   - 在 `stageLightingAt()` 中注入确定性节拍脉冲 `beat`、小节强拍 `downbeat` 与相位 `beatPhase`。
   - 在 `sampleBandMotion()` 中引入节拍重音对角色演奏动作与乐器摆幅的确定性调制。
2. **烟晶阶梯强拍光波与舞台光束增强（[band-stage.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-stage.js)）**：
   - 为三层烟晶阶梯前缘光谱 Shader 增加 `uBeat` 与 `uDownbeat` 通道，在每个小节强拍触发由中心向两侧扩散的流光扫掠（`sweep`），并联动地面闪光与桁架聚光灯。
3. **屏幕空间高光辉光、全息脚底光环与 3D 动态运镜（[band-glow.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-glow.js) → [band-scene.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-scene.js) / [band-controller.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-controller.js)）**：
   - 修复 [band-glow.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-glow.js) 在 Three.js r166 下的 `FramebufferTexture` 格式兼容性，并在 [band-scene.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-scene.js) 渲染管线末尾接入双尺度高斯辉光，使粒子羽翼、舞台焰火、体积光束与阶梯边缘自然发光，同时保持角色立绘原色清晰不过曝。
   - 新增角色脚底全息脉冲光环（`ring`），并在点按静音（`userMuted`）与长按独奏（`focus`）时拉大角色明暗对比与聚光灯收束度。
   - 在 `fitCamera()` 中支持交互聚焦自动推镜与 `cameraPose` 确定性镜头覆写，并在 [band-controller.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-controller.js) 中暴露 `renderPromoFrame()` 逐帧步进接口。

## 视频重创作亮点与验证结果

- **100% 源程序时间轴与实机 3D 舞台驱动**：由 Node.js 直接运行项目源码导出 1800 帧（60fps）确定性状态（[source-engine-timeline.json](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261022-lu-source-promo/source-engine-timeline.json)），结合实机 WebGL 录制的三大专属 3D 舞台（海贼王船帆舞台、龙珠七星龙珠舞台、火影鸟居灯笼舞台）及源程序 GLSL 着色器（[band-stage.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-stage.js) 阶梯光谱、[band-energy-wings.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-energy-wings.js) 六羽束粒子翼、[band-fountains.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-fountains.js) 物理喷泉与双高空垂柳礼花弹、[band-glow.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-glow.js) 屏幕空间 Bloom）逐帧渲染。
- **验证指标**：
  - 视频流：`1080×1920`，`60/1 fps`，`1800` 帧，`30.000s`，H.264 + AAC 48kHz 双声道。
  - 单元测试：`test/band-*.test.mjs` 全部 12 个测试套件 100% 通过。
  - 二维码实测解码：第 28.0 秒帧经 OpenCV `QRCodeDetector` 实测还原为 `https://aierlanjiu.github.io/threejs-material-lab/?intro=skip&band=pianai`。
