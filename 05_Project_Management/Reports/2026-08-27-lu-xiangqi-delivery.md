# 弈律 · 3D 中国象棋交付报告

## 交付结果

- 独立入口：`xiangqi.html`；原有 `index.html` 与 `threejs_material_lab/index.html` 未修改。
- 视觉：沿用 LÜ 3.0、RoomEnvironment、柔光与 MeshPhysicalMaterial；棋盘为真正的俯视平放视角，桌面和移动端均完整取景。
- 棋子：圆形倒角立体棋子，28 张原创角色分属两套主题；立绘嵌入透明玻璃/清漆层下，通过轻微 UV 视差与 emissive 呼吸形成“活体表情”，并叠加程序化汉字小徽章。圆柱顶面 UV 已统一旋转 90° 校正，人物与汉字在玩家视角中保持正向。
- 双主题：“律·活体矿物”为雪沐手绘角色 + 珍珠灰蓝矿物树脂棋盘，降低原纯白背景的眩光；“霜铸·史诗奇幻”为原创日铸/霜誓角色 + 黑曜石/蓝冰棋盘。粗糙度、金属度、清漆层和活体脉冲可实时调节。
- 规则：九宫、仕士斜行、象不过河/塞象眼、马蹩腿、车直行、炮架、兵卒过河、飞将、送将过滤、将死与困毙。
- 模式：玩家对 AI、本地双人、AI 自弈；可执红/执黑；练习提示与挑战限制；五档难度。
- AI：L1–L2 使用 Wukong，L3–L5 使用真实 Pikafish WASM + NNUE；固定 8 线程、512MB Hash，加载失败时显式降级 Wukong；AI 表现延迟不少于 700ms。
- 数据：自动续局并保留历史；FEN 载入/复制；ICCS 导入；JSON 导入/导出；逐步复盘。

## 原创图片

- 引擎：Imagen（Codex image generation）。
- 合同：`$IP=none`，无参考图，不引用任何影视、动漫、游戏 IP 或历史名人形象。
- 数量：两套角色共 28 张，并新增 2 张 1280×1600 棋盘材质；Imagen 原始产物均保留在 Codex 生成目录。
- 生成配置、最终提示词与 QA：`output/imagegen/20260827-lu-xiangqi-portraits/` 与 `output/imagegen/20260827-lu-xiangqi-epic/`。

## 开源复用与授权

- 规则逻辑参考 `tsonglew/chess-cn`（MIT）。
- 低档 AI 复用 `maksimKorzh/wukong-xiangqi`（MIT）。
- Pikafish WebAssembly 包装与引擎资产来自 `billzi2016/Chinese-Chess-AI-Pro` / `official-pikafish/Pikafish`（GPLv3）。
- 详细提交号、许可证和权重边界见根目录 `THIRD_PARTY_NOTICES.md` 与 `assets/xiangqi/vendor/licenses/`。
- 当前仅本地、非商业运行；公网或商业发布前必须重新核验 NNUE 权重授权。

## 验证证据

- `npm run check`：所有模块语法检查通过；16 项规则/FEN/ICCS 测试全部通过；Wukong 返回合法着法。
- `npm run test:e2e`：Chromium 1440×1000 与 390×844 无横向溢出；完成玩家落子、AI 回应、双步悔棋、FEN、ICCS、JSON、自动续局、双主题切换、四项材质调节、俯视相机与 AI 自弈。
- Pikafish 真实搜索证据：8 线程；`bestmove h2e2`；depth 23；nodes 10,382,930；NPS 2,966,551（最终验收样本）。
- Playwright 可访问性快照：主控、模式、难度、状态、复盘、设置和数据操作均有可读名称；最终控制台 0 错误、0 警告。
- 截图：`output/playwright/desktop-1440-orientation-fix.png`（立绘转正与珍珠灰蓝背景）、`desktop-1440-epic.png`、`desktop-material-controls.png`、`mobile-390-final.png`、`mobile-390-epic.png`。

## 本地启动

```bash
cd /Users/papazed/dev/threejs-material-lab
python3 server.py 8000
```

访问 `http://127.0.0.1:8000/xiangqi.html`。服务必须保留 COOP/COEP 响应头，Pikafish 多线程才可运行。
