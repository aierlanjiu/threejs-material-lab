# 弈界 · 双世界中国象棋重设计交付报告

## 交付结果

旧“律材质实验室”页面结构已被完整替换，象棋成为页面唯一核心。项目保留原有规则、Wukong、Pikafish、多模式、存档、FEN、ICCS、JSON 和复盘能力，同时新增两套真正不同的产品 UI。

## 玉衡 · 东方藏品局

- 页面采用暖灰米色、烟青玉、朱砂和旧金，桌面使用顶部藏品牌头与三栏棋局结构。
- 棋子改为暖象牙与烟青玉的传统圆形立体棋子，人物肖像不再常驻棋面。
- 雪沐手绘角色用于普通吃子、高价值吃子、连吃、将军和终局事件动画。
- 战果区根据真实吃子历史计算红黑双方积分和吃子数量。

## 先锋 · 英雄战术局

- 页面切换为深靛战术竞技结构，品牌和常用操作进入左侧竖向任务栏。
- 棋子不是人物头像贴图，而是程序化 Three.js 立体装置。
- 将、士、象、马、车、炮、兵分别使用指挥核心、双翼无人机、四足屏障、喷射骑兵、轨道堡垒、能量炮和盾牌先锋的独立几何剪影。
- 棋子拥有阵营装甲、金属、能源玻璃、发光核心和轻微悬浮响应，并继续接受粗糙度、金属度、清漆层与能源响应调节。
- 新增 `assets/xiangqi/boards/hero-tactical.png` 作为英雄战术棋盘材质层，准确网格、九宫和河界仍由 Canvas 程序绘制。

## 响应式与可访问性

- 桌面玉衡为顶部品牌与三栏布局；桌面先锋为左侧任务栏、中央竞技场与右侧战报舱。
- 390px 移动端以棋盘为第一屏主内容，双方状态贴近棋盘，设定、积分和引擎移至下方控制舱。
- 添加跳到棋局链接、可见键盘焦点、40px 最小点击面积、减少动态效果适配和移动端安全区。

## 验证

- `npm run check`：全部模块语法检查通过，16 项象棋规则/FEN/ICCS 测试通过，Wukong 返回合法着法。
- `npm run test:e2e`：1440×1000 与 390×844 无横向溢出；真人落子、AI 回应、悔棋、真实吃子积分、雪沐事件层、FEN、ICCS、JSON、自动续局、双主题、材料调节、AI 自弈全部通过。
- Pikafish 最终样本：8 线程，`bestmove h2e2`，depth 23，nodes 11,306,626，NPS 3,230,464。
- Chromium 最终控制台：桌面 0 错误，移动端 0 错误。

## 视觉证据

- `output/playwright/desktop-1440-final.png`
- `output/playwright/desktop-capture-event.png`
- `output/playwright/desktop-1440-epic.png`
- `output/playwright/desktop-material-controls.png`
- `output/playwright/mobile-390-final.png`
- `output/playwright/mobile-390-epic.png`

## 本地运行

```bash
cd /Users/papazed/dev/threejs-material-lab
python3 server.py 8000
```

访问 `http://127.0.0.1:8000/xiangqi.html`。服务必须保留 COOP/COEP 响应头，以启用 Pikafish 多线程。

