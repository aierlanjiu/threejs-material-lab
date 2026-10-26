# 双风格实时水景与播放栏 · 2026-10-26

Agent: codex。用户授权继续优化；未使用 Stitch、AGY；未提交或发布。

## 交付

- 将奶油棱镜、日落海岛两个平级按钮从左上角移至播放栏独立行，桌面及手机共用，保留选择记忆和播放中切换。
- 移除舞台周围的大面积平地，接入 Three.js 实时水面。奶油棱镜使用低振幅湖水，日落海岛使用较强波纹和暖色高光。舞台与演员实际参与平面倒影；远景仍使用既有背景图。
- 水面使用多方向法线波、视角反射和高光，属于视觉水面着色，并非流体物理模拟或几何海浪。动态绑定歌曲时间，暂停、减少动态和效果关闭时不继续运动。
- 桌面反射纹理512、手机256。镜面相机在风格/布局重建时复用；最终释放水面材质、几何和反射目标。修复初版每次奶油主题重建新增玻璃 transmission 纹理缓存的问题。
- 远景背景图不参与平面反射，避免把图片边界映到水面；手机单独控制水景渐变范围，保留上部山海远景。

## 验证与范围

- 三个 Node 回归、两个模块语法、git diff --check 通过。
- WebGL 测试覆盖2风格×3阵容×2尺寸×5队形；验证演员取景与落脚、水面类型和时间、减少动态/关闭效果、20次切换资源稳定、6种录制画幅和销毁。
- 主页面实际播放《偏爱》时往返切换主题，播放进度继续；暂停正常。320px无横向溢出，两个切换按钮均88×44，DOM位于播放栏中。
- 桌面/390px双风格截图已检查。主页面未捕获控制台 error。
- 实体手机帧率、温升和完整有声导出未测。平面反射增加一次场景绘制，不声称获得60fps或达到“没有任何改进空间”。

## 文件与证据

改动：`js/ui/band-festival-stage.js`、`js/ui/band-controls.js`、`css/lu-control-motion.css`、`test/band-festival.browser.html`。

备份、截图和最终回归结果：`output/festival-water-20261026/`；其中 `baseline/` 保存本轮修改前的4文件和进度索引。

实现参考：[Three.js r166 Reflector](https://github.com/mrdoob/three.js/blob/r166/examples/jsm/objects/Reflector.js)、[WebGLRenderer transmission pass](https://github.com/mrdoob/three.js/blob/r166/src/renderers/WebGLRenderer.js)。
