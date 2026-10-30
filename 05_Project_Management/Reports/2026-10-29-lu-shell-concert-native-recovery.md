# 珍珠贝壳音乐厅：本机原生模型恢复与验收

Agent: codex，2026-10-29。

## 本轮范围与成果

继续此前因执行环境受阻的舞台模型阶段。已生成并重新打开原生 `shell-concert.blend`，核对可编辑结构，使用Apple M4 Metal完成两张Cycles渲染。GLB保留原版；独立浏览器预览完成首次桌面及手机视口验证，并针对手机取景过小做局部修正。

本轮不将现有四帧角色称为新的高清角色，不将舞台检查页称为正式演出集成；歌词合唱和九件乐器独立声部仍待后续阶段。

## 执行环境根因

同一台 `papadeMac-mini.local` 对照：普通命令沙箱内Metal默认设备为空，loopback绑定被拒绝；获准在沙箱外执行时Metal可用，loopback绑定成功，Blender 5.1.2后台启动与退出成功。此前仅凭“0个Metal设备”无法推断本机显卡故障。本轮按命令申请执行权限，没有修改全局沙箱配置、系统权限、用户代理或已打开的Blender场景。

## 关键文件与改动

- `assets/models/band-shell-concert/shell-concert.blend`：原生场景，4,604,261字节；六片独立厚壳、十个演员锚点、122条可编辑曲线、11盏灯、三台相机、11张已打包文件图像。
- `assets/models/band-shell-concert/manifest.json`：原生状态为ready，记录文件摘要及结构、渲染、相机边界证据。`generatedWithoutRendering`描述保存源文件的构建步骤；后续渲染结果另存于`renderVerification`。
- `scripts/build-shell-concert.py`：放大渲染海面；远景岛屿采用单顶点山顶、正向面和水下岸线，避免原圆盘边缘与退化中心；两台验收相机退距，保证整座舞台入镜。共享舞台几何源未改。
- `js/ui/shell-concert-preview.js`与`shell-concert.html`：竖屏相机退距系数由1.62/aspect改为0.98/aspect，桌面宽屏取景保持原值；重新打包相同GLB和十位角色。
- `assets/models/band-shell-concert/README.md`：更新实际交付、重建方法、沙箱原因与验证边界。
- `output/shell-concert-20261029/local-native-recovery/`：本轮复核脚本、JSON证据、Cycles渲染、浏览器截图和备份。

## 验证结果

- 独立进程重新打开最终`.blend`，225个舞台节点与共享几何源逐一核对：层级、位置、网格顶点与面数量一致；六个壳体控制、十个锚点、十位预览角色存在；122条曲线仍可编辑；11张文件图像已打包。
- 两台相机的舞台包围盒投影全部位于画面内。正面归一化范围约X=0.162–0.827、Y=0.070–0.915；斜侧面约X=0.214–0.767、Y=0.076–0.890。
- Cycles / Apple M4 Metal，1440×810、48 samples：正面与斜侧面均完成实际PNG渲染，并人工查看最终画面。此为材质与构图预览，远景保持简化场景。
- `python3 scripts/validate-shell-concert.py`通过，原生状态ready；GLB仍为4,200,132字节、164,256三角面、225节点、六壳体与十锚点，顶点/法线/索引和摘要均通过。
- JS语法、Python语法、重新打包HTML内嵌模型摘要、十份角色资源以及`git diff --check`通过。
- 首次浏览器真实WebGL验收：1440×900正／侧／背、角色显隐、拖动旋转、滚轮缩放、方向键／加减号／Home均有效；390×844与320×740无横向溢出，控制台无错误或警告。实际截图发现竖屏模型偏小，已修正退距，最终复验状态见下文。

### 最终浏览器复验

修正后最终版本通过：390×844和320×740的正／侧／背六张截图均已实际查看，贝壳、舞台和前置圆台完整入镜，控件不遮挡模型；scrollWidth分别等于390与320。390背面左侧约8px余量，未裁切。1440×900正面复验通过。三种尺寸stageReady=true、模型摘要与十位角色正确，console/page error均为空。

初轮内置浏览器连接在后续复验时不可用，原生应用连接也未恢复，已停止等待。最终回归改用项目已安装Playwright启动隔离无头Chromium，WebGL为SwiftShader软件渲染；没有安装软件或修改用户浏览器配置。手机检查为视口模拟，未声称实体手机、真实GPU帧率或触屏双指实测通过。首轮实际浏览器已验证拖动、滚轮、角色显隐与键盘行为；最终回归聚焦本次改变的相机取景。

## 证据与备份

- 原生结构／渲染：`output/shell-concert-20261029/local-native-recovery/native-verification.json`。
- 完整入镜：同目录`native-framing.json`。
- 实际渲染：同目录`cycles-front.png`、`cycles-three-quarter.png`。
- 浏览器截图与最终数值记录：同目录`browser/`，包括`browser-validation.json`、`mobile-390-front.jpg`、`mobile-320-front.jpg`；旧390截图保存在`mobile-390-front-before.jpg`。
- 初始Git状态、十份已有文件摘要及原模型目录副本：同目录`baseline-20261029-080006/`。
- 首轮原生文件、渲染与修正前建模脚本：同目录`first-native-render/`。

原GLB SHA-256保持`947a0995f8c15e15b47a2885beba13c493005b8d72190212a9c05ca7a5d3d081`。本轮没有发布、提交、推送或修改正式演出页；其他已有未提交业务源码经摘要核对保留。

## 参与Agent

- codex：定位执行限制、原生构建、结构与相机验证、Cycles渲染、局部取景修正、资产说明及记录。
- Computer Use（GPT-6.1 Terra，xhigh）：真实浏览器交互、桌面与两个手机视口、截图与控制台检查。
