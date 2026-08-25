# Three.js 材质实验室 (Three.js Crystal & Material Lab) 💎

> **高透天然水晶 · 极光色散棱镜 · 物理材质实验 · 3D 激光内雕 · 音乐节拍实时律动 · MP4 母带级录制**

---

## ✨ 核心特性

- 💎 **高级物理 PBR 材质系统**：
  - **高透天然水晶 (Crystal)**：物理色散（Dispersion）、体积衰减（Attenuation）、影棚反射环境（Studio Softbox HDR）、后处理辉光（Bloom）。
  - **极光棱镜 (Prism)**、**北极冰晶 (Ice)**、**透光磨砂 (Frosted)**、**黑曜/琥珀烟晶 (Smoke/Amber)**、**重磅真丝 (Silk)**、**羊绒针织 (Wool)**、**蓬松体积彩云 (Cloud)** 等 12 款触感材质。
- 🎵 **音乐节拍实时律动**：
  - 音频实时 FFT 分析驱动 9 大物理参数、相机 FOV 动态呼吸、滑块 UI 自适应律动。
  - 自定义音乐与大秀乐章动作全量对齐，支持活体表情随旋律自主切换与张嘴歌唱。
- 📐 **智能方阵排版引擎 (MatrixLayoutEngine)**：
  - 自动识别字数并智能匹配方阵（3×3、4×4、5×5）及 3D 双层雕塑堆叠。
  - 未填满网格自动以纯净原材质方块补齐底座。
- ⚡ **3D 激光内雕与工艺系统**：
  - 3D 激光内雕（悬浮于方块内部深度，带微发光与半透明磨砂折射）。
  - 奢华烫金与高对比度印刷模式，自动明暗对比度适配。
- 🎬 **母带级视频录制直出**：
  - 支持录制保存为通用 MP4 (H.264/AAC) 与 WebM 格式。
  - 16Mbps 母带级码率 + 实时录制计时器。

---

## 🚀 快速启动

本项目为纯前端单页架构，无需繁重依赖，直接启动本地 Web 服务器即可：

```bash
# 进入核心目录
cd threejs_material_lab

# 使用 Python 启动本地 HTTP 服务器
python3 -m http.server 8000
```

打开浏览器访问：`http://localhost:8000`

---

## 📂 项目结构

```text
.
├── threejs_material_lab/       # 核心应用源码
│   ├── index.html              # Three.js 单页交互主入口
│   ├── DESIGN_SPEC.md          # 材质实验室升级设计说明书
│   ├── PLAN.md                 # 实施计划与任务拆解
│   ├── AGENT_PROMPT.md         # 架构与 Agent 提示词规范
│   ├── save_avatars.py         # 头像生成与裁切辅助工具
│   └── assets/avatars/         # 矢量与头像资产
├── 音乐/                       # 高品质 Hi-Res 演示音频库
├── .gitignore
└── README.md
```

---

## 🛠️ 技术栈

- **Three.js** (r166) / EffectComposer / UnrealBloomPass
- **Web Audio API** / AnalyserNode
- **MediaRecorder** / WebCodecs / MP4 muxer
- **Tailwind CSS** / SVG Icons
