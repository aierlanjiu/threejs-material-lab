# 给 Agent 的实现指令：Three.js 逼真材质文字立方体

你要实现一个可直接运行的 Three.js 网页编辑器。目标不是“能看到透明方块”，而是让材质在视觉上接近产品级 3D 渲染：水晶要晶莹、玻璃要有折射厚度、丝绸要有织物 sheen、羊毛要有绒毛层次、云朵要有柔软体积感。

## 1. 技术要求

- 使用 Three.js，优先使用 ES modules。
- 使用 `WebGLRenderer`。
- 颜色空间使用 `SRGBColorSpace`。
- 色调映射使用 `ACESFilmicToneMapping`。
- 开启软阴影。
- 使用 `OrbitControls` 支持鼠标/触摸旋转、缩放。
- 所有材质必须基于 PBR 思路，不允许只用 `opacity` 假装真实材质。
- 文字支持英文、中文、数字；用 CanvasTexture 生成字面贴图即可。
- 立方体必须有圆角/倒角，优先 `RoundedBoxGeometry`。禁止只用完全直角的 `BoxGeometry` 来表现高档水晶。

## 2. 水晶/玻璃的核心要求

水晶质感是否成功，主要取决于以下组合，不是单一参数：

1. **倒角几何**
   - radius 约为方块边长的 5%~10%。
   - bevel/round segments 至少 4。
   - 让边缘能形成连续高光带。

2. **环境反射**
   - 必须有 environment map。
   - 可用 HDRI；若项目不允许外部 HDRI，则至少用 `RoomEnvironment + PMREMGenerator`。
   - `scene.environment` 必须设置。
   - `envMapIntensity` 默认建议 1.8~3.0。

3. **物理玻璃参数**
   使用 `MeshPhysicalMaterial`：
   - `transmission: 0.95~1.0`
   - `ior: 1.45~1.72`
   - `thickness: 0.7~1.5`
   - `roughness: 0.005~0.08`
   - `metalness: 0`
   - `clearcoat: 1`
   - `clearcoatRoughness: 0.005~0.04`
   - `attenuationColor` 跟随用户色泽
   - `attenuationDistance: 2~8`
   - `side: DoubleSide`
   - 不要把 `opacity` 调得很低来模拟透明玻璃；对 transmission 材质通常保持 opacity 接近 1。

4. **灯光**
   至少四层：
   - 柔和环境光/半球光
   - 大面积白色主光
   - 冷色轮廓光
   - 暖色补光
   - 可额外加顶部 sparkle light

5. **地面**
   - 必须有可接收阴影的地面。
   - roughness 约 0.15~0.35。
   - 可有少量 clearcoat。
   - 目的是让玻璃在地面产生高光、阴影和反射对比。

6. **渲染器**
   - ACES Filmic tone mapping
   - exposure 默认 1.0~1.3
   - pixelRatio 最大 2，避免移动端性能爆炸

## 3. 各类材质的目标

### A. 高透水晶
关键词：清澈、厚实、晶莹、边缘亮、内部有颜色衰减。

建议：
- transmission 1.0
- roughness 0.01~0.04
- ior 1.52
- thickness 1.0 左右
- clearcoat 1
- envMapIntensity 2.2~3.0
- attenuationDistance 4~6

### B. 冰晶
关键词：更冷、更白、稍微浑浊、内部有雾感。

建议：
- ior 1.31
- roughness 0.03~0.10
- transmission 0.92~0.99
- thickness 1.1~1.4
- 可加入极轻微 noise bump

### C. 棱镜水晶
关键词：折射感强、彩虹边缘、锐利高光。

建议：
- ior 1.65~1.8
- roughness < 0.02
- transmission 1
- clearcoat 1
- 若 Three.js 版本支持 dispersion，开启少量 dispersion
- 若不支持，可用 iridescence 做视觉近似，但不要声称它等同于真实色散

### D. 磨砂玻璃
关键词：半透明但柔和，不应像塑料。

建议：
- transmission 0.65~0.85
- roughness 0.25~0.5
- ior 1.45
- clearcoat 0.2~0.5
- attenuationDistance 2~4

### E. 丝绸
丝绸不能用玻璃 transmission。

使用 `MeshPhysicalMaterial`：
- roughness 0.2~0.4
- `sheen: 1`
- `sheenRoughness: 0.15~0.35`
- `sheenColor` 比 baseColor 稍亮
- 叠加程序化织纹 normal map / normalScale
- 如果要更高级，可写 anisotropic/brdf shader，但先保证 PBR sheen 正确
- 丝绸高光必须随视角移动，而不是普通塑料亮斑

### F. 毛线 / 羊毛
目标不是“粗糙方块”，而是有短纤维/绒毛边缘。

基础版：
- roughness 0.85~1
- sheen 0.6~0.9
- noise bump/normal
- 加一个略放大的半透明 fuzz shell

高质量版：
- 用 `InstancedMesh` 在表面生成短纤维
- 纤维数量根据 LOD 控制
- 近景显示纤维，远景只保留 fuzz shell
- 不能每帧重建所有纤维

### G. 云朵
高质量云朵不要只做透明白色球。

基础版：
- 多个 sphere/puff 组成 soft cube
- depthWrite false
- 高 roughness
- 低 transmission
- opacity 分层
- 轻微噪声扰动

高质量版：
- 使用 raymarching / volume shader
- 3D noise（FBM / Worley + Perlin）
- density falloff
- light marching
- phase function（至少 Henyey-Greenstein 近似）
- 支持软边缘和内部自阴影
- 云材质性能要提供 quality 档位

## 4. 交互要求

左侧：
- 文本输入
- 材质选择
- 色泽选择
- roughness
- transmission
- IOR
- thickness
- envMapIntensity
- light intensity
- FOV
- 视角重置
- 自动旋转

右侧：
- Three.js 实时预览
- OrbitControls
- 鼠标拖动旋转
- 滚轮缩放
- resize 自适应

中文：
- 用 Canvas 2D 绘制文字到 texture
- 字体 fallback 至少包含：
  `"PingFang SC", "Microsoft YaHei", system-ui, sans-serif`

## 5. 性能要求

- renderer pixelRatio 不超过 2
- 几何体尽量复用
- 共享纹理和材质参数
- rebuild 时正确 dispose 临时材质、贴图、几何
- 文字数量需要限制，例如最多 48 个
- 云朵/羊毛的高级几何提供质量档位
- 动画循环只做必要更新
- 不允许每一帧重新创建 Material / Texture

## 6. 视觉验收标准

水晶：
- 正面不能像“浅色透明塑料”
- 边缘必须明显比面更亮
- 旋转镜头时高光需要移动
- 能看到环境反射和内部衰减
- 有冷暖光色分离
- 玻璃在白底也要保持轮廓清晰

丝绸：
- 高光要宽而柔
- 有织物方向感/细微纹理
- 不是哑光塑料

羊毛：
- 边缘能看到 fuzz
- 表面粗糙，有纤维感
- 不能只靠 noise 颜色贴图

云：
- 外轮廓柔软
- 内部亮度有层次
- 不能是普通半透明白球堆叠的廉价效果；如果基础版只能做到 puffs，要明确作为 fallback

## 7. 代码组织建议

拆成：
- `SceneManager`
- `MaterialFactory`
- `CubeTextBuilder`
- `LightingRig`
- `UIController`

`MaterialFactory` 应提供：
- `createCrystalMaterial(options)`
- `createIceMaterial(options)`
- `createPrismMaterial(options)`
- `createFrostedMaterial(options)`
- `createSilkMaterial(options)`
- `createWoolMaterial(options)`
- `createCloudMaterial(options)`

## 8. 最重要的 Agent 原则

不要优先“堆参数”。

先保证：
**几何倒角 → environment → 灯光 → tone mapping → PBR transmission/thickness/IOR → attenuation → clearcoat → 微表面细节。**

如果水晶仍不够晶莹，按以下顺序排查：
1. 有没有环境贴图？
2. 几何有没有倒角？
3. scene.environment 是否正确？
4. toneMapping / exposure 是否正确？
5. roughness 是否过高？
6. transmission 是否接近 1？
7. thickness 是否为 0？
8. attenuationDistance 是否过短？
9. 白底是否没有任何明暗参照？
10. 是否缺少 rim light / edge highlight？

目标是产品级的“晶莹剔透”，不是 demo 级透明方块。
