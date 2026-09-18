# CODEX 专项交接交付规范：吉祥物骨骼高精度重绑与权重防穿模精修指南
> **文档版本**：v1.0.0 · Production Release  
> **交接对象**：Codex / 3D Technical Artist / Blender Rigging Specialist  
> **关联项目**：`threejs-material-lab` (荔 / LI · 陪伴工作室)  
> **涉及模型资产**：
> - `assets/mascots/blender/hoodie-lychee.glb` (荔小卫 · 卫衣态)
> - `assets/mascots/blender/astro-lychee.glb` (荔小星 · 宇航态)
> - 源 Blender 工程文件 / glTF 2.0 导出管线

---

## 一、交付背景与核心问题诊断

前端工作室已成功接入 21 根骨骼的实时生物动力学驱动引擎（闲置呼吸、欢快招手、宇航敬礼、月球大跳、沿 Y 轴地表桶滚翻等）。但在前端动态驱动过程中，暴露了当前原始绑定资产（Blender Rig）在骨骼拓扑与蒙皮权重上的若干结构性硬伤：

### 1. 手臂关节严重残缺与重叠（Missing Joints & Redundant Zero-Length Bones）
通过实机 DevTools 对 `hoodie-lychee.glb` 骨骼拓扑树进行反向解析：
```json
{
  "ClavicleL": { "pos": [0.18, 0.53, 0], "rot": [-1.633, 0.079, -1.816] },
  "ArmL":      { "pos": [0, 0.486, 0],    "rot": [-2.846, -0.691, -1.723] },
  "UpperArmL": { "pos": [0, 0, 0],        "rot": [-0.02, 0.075, -0.052] },
  "LowerArmL": { "pos": [0, 0.446, 0],    "rot": [-3.072, 1.12, 1.95] },
  "HandL":     { "pos": [0, 0.483, 0],    "rot": [-0.038, -0.369, -0.274] }
}
```
**诊断结论**：
1. `ArmL` 与 `UpperArmL` 在空间坐标上**完全重叠（相对位置 `[0, 0, 0]`）**，属于废弃冗余骨，造成旋转死锁；
2. 缺少**肘部极向骨（Elbow Pole Target）**与**前臂扭转骨（Forearm Twist Bone）**；
3. `LowerArmL` 的静息姿态存在非正交烘焙倾角（`rot: [-3.072, 1.12, 1.95]`），前端驱动其沿局部主轴旋转时，骨骼会产生类似“拧麻花”（Candy-wrapper effect）的畸变；
4. 导致目前手臂在招手、深蹲、侧滚翻等动作中，**手肘无法独立做真实的单轴铰链弯曲，手臂只能作为一根硬木棍整体斜向摆动**。

---

### 2. 五大严重穿模问题实测清单（Mesh Clipping & Weight Issues）

| 序号 | 穿模位置 | 涉及网格对象 (Mesh Name) | 面数/顶点数 | 穿模诱因诊断 | 解决规范要求 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **①** | **大臂内侧穿胸** | `Hoodie_Body` | 99,742 顶点 | 躯干与袖子连在同一大网格中，腋下与大臂内侧顶点权重过渡生硬，手臂内收或向后摆动时直接刺入肋骨和腹部。 | 重绘腋下权重渐变，袖内侧微缩放留出 8mm 几何安全间距，或加入胸部辅助形变骨。 |
| **②** | **抽绳刺穿胸口** | `DrawcordL`<br>`DrawcordR` | 4,118 顶点<br>4,228 顶点 | 抽绳目前**没有任何独立骨骼**，被生硬蒙皮在 `Spine` / `Body` 上。当身体前屈、弯腰、侧倾时，抽绳完全不弯曲，笔直刺入卫衣胸口。 | 为左右抽绳各新增 3 节骨骼链（`Drawcord_01~03.L/R`），赋予平滑蒙皮，前端可直接挂接弹簧次级动力学。 |
| **③** | **玉石手掌穿袖口** | `Hand_SurfaceL/R`<br>`Hoodie_Body` (袖口) | 1,453 顶点<br>(局部约 1,200) | `Hand_Surface` 是独立网格，袖口是 `Hoodie_Body` 的一部分。手腕弯曲时，袖口网格顶点滞后，玉手直接穿破布料边缘。 | 将袖口内圈与手腕基座顶点的骨骼权重（`LowerArm` vs `Hand`）做归一化对齐，保证腕关节弯曲时袖口与手掌同步位移。 |
| **④** | **靴口穿刺裤腿** | `Boots`<br>`Hoodie_Body` (下摆) | 28,642 顶点 | 深蹲（`bounce` 蓄力）或侧滚翻抱膝时，大腿小腿大幅弯曲，厚重靴筒边缘穿入小腿后侧与卫衣下摆。 | 重绘膝关节与靴筒交界处权重，适度优化靴口内收斜率，避免折叠挤压穿模。 |
| **⑤** | **下巴穿透兜帽领** | `Face_1`<br>`Hood_Shell` | 15,560 顶点<br>129,058 顶点 | 低头（`nod` 或 `roll` 团身）时，玉质下巴与脸颊穿破兜帽领圈前檐。 | 优化 `Head` 骨骼旋转中心至颈部自然铰接点，适度提升领口碰撞边界。 |

---

## 二、Codex 骨骼拓扑重构规范（Rigging Architecture Spec）

请在 Blender 中对骨架（Armature）进行重构，并严格遵守以下**命名规范（Humanoid / Rigify 兼容）**与**层级拓扑（Hierarchy）**：

### 1. 完整骨骼层级树规范（Bone Hierarchy）
```text
Root (原点 [0, 0, 0]，位于两脚底接触面正中央)
└── Hips / Pelvis (盆骨中心，驱动身体重心平移)
    ├── Spine (腰腹段，呼吸起伏主控)
    │   └── Chest (胸腔，连接锁骨与领口)
    │       ├── Neck (颈部微动)
    │       │   └── Head (头部主控，旋转中心位于后枕骨自然转点)
    │       │       ├── Leaf_Antenna_01 (荔枝叶芽基座)
    │       │       │   └── Leaf_Antenna_02 (叶尖次级摆动)
    │       │       └── Visor_Root (宇航态专属：面罩与头盔辅助定位)
    │       ├── Clavicle.L (左锁骨，控制耸肩、展肩)
    │       │   └── UpperArm.L (左大臂，严禁重叠骨！旋转轴正交对齐)
    │       │       └── LowerArm.L (左前臂/肘关节，纯单轴弯曲 + 扭转)
    │       │           └── Hand.L (左手腕/手掌，控制招手与撑地)
    │       │               ├── Thumb.L (可选：大拇指微动)
    │       │               └── Fingers.L (可选：掌指微动)
    │       ├── Clavicle.R (右锁骨)
    │       │   └── UpperArm.R (右大臂)
    │       │       └── LowerArm.R (右前臂/手肘)
    │       │           └── Hand.R (右手腕/手掌)
    │       ├── Drawcord_01.L (左抽绳根部，位于领口出绳孔)
    │       │   └── Drawcord_02.L (左抽绳中段)
    │       │       └── Drawcord_03.L (左抽绳尾端/金属头)
    │       └── Drawcord_01.R (右抽绳根部)
    │           └── Drawcord_02.R (右抽绳中段)
    │               └── Drawcord_03.R (右抽绳尾端)
    ├── Thigh.L (左大腿 / 髋关节)
    │   └── Calf.L (左小腿 / 膝关节，单轴后折)
    │       └── Foot.L (左踝关节 / 双脚触地平直)
    │           └── Toe.L (左脚尖，起跳蹬地绷脚尖)
    └── Thigh.R (右大腿)
        └── Calf.R (右小腿)
            └── Foot.R (右踝关节)
                └── Toe.R (右脚尖)
```

### 2. 手臂骨骼放置与局部坐标轴（Roll / Local Axis Alignment）
在 Blender 编辑模式（Edit Mode）下：
1. **删除现有的多余骨骼**：彻底清除原 `ArmL`/`ArmR`，仅保留清晰唯一的 `UpperArm.L/R`；
2. **手臂伸展方向**：骨骼正向沿大臂到小腿方向延伸（Tail 指向下一个 Head）；
3. **正交对齐（Roll Angle Alignment）**：
   - 确保 `UpperArm` 与 `LowerArm` 的局部坐标系严格规整：
     - **局部 Y 轴**：沿骨骼主干长度方向指向下一级关节；
     - **局部 X 轴**：定义为手肘的主要**屈伸铰链轴（Hinge Bend Axis）**；
     - **局部 Z 轴**：定义为侧展与微调轴；
   - 这样前端无论使用 `poseBone('LowerArm.L', [[X, angle]])` 还是 IK 约束，手肘弯曲方向绝对纯粹稳定，绝不再扭曲拧麻花。

---

## 三、蒙皮权重绘制与防穿模施工规范（Weight Painting Guidelines）

### 1. 权重绘制原则（Skinning Rules）
1. **单顶点受骨骼数上限（Max Influences）**：
   - glTF 2.0 工业标准要求：**每个顶点最多受 4 根骨骼影响**；
   - 在 Blender 中蒙皮后，必须执行一次：`Weights` $\to$ `Limit Total` (Limit: 4) 并执行 `Normalize All`（确保所有影响权重之和严格等于 $1.0$）。
2. **渐变平滑度（Weight Gradient Falloff）**：
   - 手肘（`UpperArm` 与 `LowerArm` 交界处）、膝盖（`Thigh` 与 `Calf` 交界处）采用双环平滑权重渐变，避免锐角折叠导致几何体积塌陷（Volume Loss）。
3. **保持 Dual Quaternion 效果的形状键补正（Corrective Shape Keys）**：
   - 若在 90 度深屈肘时仍有轻微体积收缩，请为 `Hoodie_Body` 烘焙一组由旋转驱动的辅助形态键（Pose Space Morph Key）。

### 2. 专项穿模消除实操（Fixing Clipping Issues）
1. **大臂内侧 vs 躯干**：
   - 在 T-pose / A-pose 下，确保腋下有至少 **5~10mm 的物理网格间隙**；
   - `UpperArm.L` 的权重严格截断在肩窝外侧轮廓线，**严禁渗透进腹部或胸侧肋骨网格**；
2. **抽绳蒙皮（Drawcords）**：
   - `DrawcordL` 网格从领口向下依次赋予 `Drawcord_01.L` (0.33) $\to$ `Drawcord_02.L` (0.33) $\to$ `Drawcord_03.L` (0.34) 的线性过渡权重；
   - 抽绳根部与领口出绳孔建立紧密跟随，完全切断抽绳对 `Spine` 的直接硬权重；
3. **手掌基座 vs 袖口边缘（Wrist & Cuff）**：
   - 提取 `Hand_SurfaceL` 的腕部闭合截面边缘环顶点，与 `Hoodie_Body` 袖口内衬边缘环顶点的权重进行严格数值镜像绑定（两组顶点对 `LowerArm.L` 与 `Hand.L` 的权重分配保持一致：例如均为 0.70 / 0.30），确保转腕时袖口与手掌同步平滑位移，绝不交错穿出；
4. **靴口与小腿（Boots & Calf）**：
   - 靴筒上方加厚环状结构完全赋予 `Calf` 骨骼，靴底完全赋予 `Foot` 骨骼，脚尖软折痕处平滑过渡至 `Toe`。

---

## 四、CMF 材质工坊与表情形态键保留清单（Preservation Checklist）

前端工作室依赖**多网格独立材质槽（Multi-Material Slot System）**与**面部形态键（Facial Shape Keys）**实现 6 大 CMF 工坊质感切换与语音唇形同步。**重绑或重构模型网格时，严禁合并网格或破坏形态键！**

### 1. 必须完整保留的独立网格（Mesh Primitives）
模型必须由以下分离的网格对象构成（不得执行 Join 合并）：
1. `Face_1`（核心：温润白玉面庞，次表面散射材质）
2. `Face_2`（核心：黑曜石高折射率眼球镜片）
3. `Mouth_Interior`（口腔内壁红润材质）
4. `Hood_Shell`（兜帽外壳，CMF 主烘焙贴图承载体）
5. `Hoodie_Body`（卫衣身体、袖子与裤身）
6. `Hand_SurfaceL` / `Hand_SurfaceR`（左/右手温润玉石表面）
7. `DrawcordL` / `DrawcordR`（左/右活性绿抽绳与金属束头）
8. `Boots`（高光果胶潮鞋）
9. `Leaf_Antenna_Surface`（头顶荔枝鲜叶天线）
10. `Pocket_LI_Stitch`（腹部袋鼠兜立体刺绣标）
11. `Visor`（宇航态专属：全透光学玻璃面罩，`transmission: 1.0`）

### 2. 必须保留的面部形态键（Facial Shape Keys）
网格 `Face_1` 与 `Face_2` 必须保留以下 5 组 Morph Targets（名称大小写严格一致）：
- `blink` (闭眼/眨眼)
- `smile` (弯月萌眼微笑)
- `curious` (好奇睁大双眼)
- `shy` (害羞眼睑半合)
- `mouth_open` (张嘴，语音与唇形律动主控)

网格 `Mouth_Interior` 必须保留：
- `mouth_open` (张嘴同步腔体开合)

---

## 五、Blender glTF 2.0 导出参数黄金配置

在 Blender 导出 `.glb` 时，请严格检查并勾选以下参数：

```text
File -> Export -> glTF 2.0 (.glb)

[Include]
  - Selected Objects: 勾选（先选中模型各 Mesh 与 Armature）
  - Custom Properties: 勾选

[Transform]
  - +Y Up: 勾选（Three.js 标准坐标轴）

[Geometry]
  - Apply Modifiers: 勾选（若有镜像或表面细分）
  - UVs: 勾选
  - Normals: 勾选
  - Tangents: 勾选（重要：切线用于 CMF 织物与各向异性计算）
  - Vertex Colors: 勾选
  - Shape Keys: 勾选（重要：保留面部表情）

[Armature]
  - Export Deformation Bones Only: 勾选（过滤掉 Blender 专用的 IK 极向手柄与控制器，仅导出变形骨）
  - Add Leaf Bones: 取消勾选（禁止无意义的末端虚骨增加额外体积）

[Animation]
  - Animation: 勾选（若内置了基础待机动画）
  - Shape Key Animations: 勾选
  - Sampling Rate: 30 或 60
```

---

## 六、验收基准与前端自动化测试用例（Acceptance Criteria）

重绑资产交付后，前端工作室将运行自动化遥测测试，验收标准如下：

1. **骨骼加载检验**：
   - 控制台执行 `window.getActiveMascot().bones`，必须无冗余重叠骨，肘关节、腕关节、抽绳骨全部识别；
2. **手肘 90 度弯曲无穿模测试**：
   - 旋转 `LowerArm.L` 沿局部 $X$ 轴弯曲 $90^\circ$（$-1.57\text{rad}$），手肘呈现自然折角，袖口与小臂无尖锐萎缩塌陷；
3. **招手姿态检验**：
   - 触发 `wave` 动作，手掌做 $\sin(t \times 16)$ 高频摆动，玉石手掌完全稳定在袖口外侧，无任何穿入袖布现象；
4. **深蹲与抱膝检验**：
   - 触发 `bounce`（深蹲蓄力）或 `roll`（侧滚翻抱膝），靴筒与小腿无交叉穿刺，大臂内侧与肋骨无穿插；
5. **面部形态键与材质测试**：
   - 切换 6 款 CMF 材质，面部依然呈现白玉微透质感，眨眼与说话口型开合流畅。
