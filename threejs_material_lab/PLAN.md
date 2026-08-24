# Three.js 材质实验室升级实施方案 (Implementation Plan)

## 任务拆解与实施步骤

### Task 1: 升级 UI 控件与交互面板
- 增加规格排版选择器 (`auto`, `3x3`, `4x4`, `5x5`, `3d_stack`)
- 增加空位补齐开关 (`fillEmpty`)
- 增加文字工艺选择 (`laser`, `print`, `foil`)
- 扩充色散 (Dispersion) 与辉光 (Bloom) 调节滑块
- 扩充高级预设色板

### Task 2: 重构影棚级光影管线与后处理
- 引入 `EffectComposer` + `UnrealBloomPass` + `OutputPass`
- 搭建高动态 Studio Softbox 反射环境 (`PMREMGenerator`)
- 搭建 5 层多色温影棚布光系统 (Key + Cool Rim + Warm Fill + Top Sparkle + Ground Bounce)
- 升级镜面微磨砂地面与接触阴影

### Task 3: 材质系统大升级与云朵色彩修复
- 升级水晶材质：开启物理色散 (`dispersion: 0.12`)、`ior: 1.54`、体积衰减吸收
- 升级极光棱镜：`dispersion: 0.28` + `iridescence`
- 升级冰晶、磨砂、烟晶/琥珀、丝绸、羊毛
- **彻底修复云朵材质**：响应 `ui.color`，结合柔和次表面光泽与多球软体拟合

### Task 4: 规格矩阵排版引擎 (A+C 方案)
- 实现智能字数识别与 4×4 / 5×5 矩阵排版
- 实现无字空位纯净晶体底座补齐 (A 方案)
- 实现前后立体双层雕塑堆叠 (C 方案)
- 自动适配相机距离与控制中心

### Task 5: 3D 激光内雕与文字工艺贴图引擎
- 实现 3D 激光内雕效果（位于方块内部深度，微发光半透明磨砂折射）
- 实现奢华烫金与高对比度印刷模式
- 自适应明暗对比度

### Task 6: 联调验证与体验优化
- 启动 Web 服务器进行全功能验证
- 验证所有材质、色卡、排版模式与性能
