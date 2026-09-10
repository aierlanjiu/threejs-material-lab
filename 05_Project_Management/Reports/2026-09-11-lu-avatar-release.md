# OneWorks 联动与高清头像发布

Agent: codex · 2026-09-11

## 修复与范围

- 使用 OneWorks 官方公共解析器计算动画帧，再 setDefinition 与 capture；解决旧图集 64 格实为同一画面的问题。新图集 2048×2048，每帧 256×256，8 角色 × 3 组应用自编动作。不宣称包含官网完整动画库。
- 表面头像仅投向正面，消除玻璃正反重复头像；修正透明帧混合，取消头像缩略图的方形 CSS 投影，补少量颜色以降低二次照明损失。角色仍为官方渲染图像贴合方块，不是官网几何体直接导入 Three.js。
- 材质选项样本使用 336px 离屏渲染、4 倍多重采样，再缩小到展示尺寸；加入真实参与渲染的底面、定向光和阴影图，保留细纹理。
- 本地工作室明确是官方组件集成页，不冒充官网自动同步。新增角色 JSON 导入/导出、保存并返回舞台、透明方形舞台输出；返回恢复材质颜色、主要参数、阵列、镜头。音乐不会自动续播。

## 验证

- 全 24 组图集逐帧检查：每组 47–53 个不同帧，64 格存在停顿帧属正常；全部宽 2048px；每组均有透明像素，所有帧边缘非透明像素数量为 0。
- 工作室往返：编辑兔子开心表情后返回，角色 rabbit、内容 avatar、材质 silk、颜色 #b97868、角色背景 transparent，运行错误 0。
- 1440px 桌面与 375px 手机检查，手机页面宽等于视口。八角色混排采样及截图已完成。像素检查触发的 Canvas2D 读回优化提示来自测试脚本，不是应用错误。
- git diff 空白检查与桥接脚本语法检查通过。主页面与工程副本校验一致。

## 发布边界

- 仅提交 LÜ 主页面、工程副本、studio 资产及本报告；保留工作区象棋文件和混合 progress.md，不夹带提交。
- 发布目标：现有 aierlanjiu/threejs-material-lab 的 master 与 gh-pages。是否发布成功以本次任务最终线上验证为准。
- 尚未覆盖所有材质、音乐曲目、用户自定义多角色并发性能；官网跨域数据不会自动同步，角色文件迁移仅接受公共定义 JSON。

## 本地证据

- output/playwright/avatar-motion-qa.js 与 avatar-motion-final.png
- output/playwright/avatar-release-qa.js、material-samples-release.png、avatar-mobile-release.png
- output/playwright/editor-roundtrip-release.png
