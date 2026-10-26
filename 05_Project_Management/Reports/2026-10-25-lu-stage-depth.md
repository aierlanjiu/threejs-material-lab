# 律 · 舞台背景与空间融合第二轮

日期：2026-10-25。Agent：codex。

## 实施

承接用户「继续升级」，继续在已授权的舞台配色与背景范围精修，修改 `js/ui/band-stage.js` 与 `js/ui/band-concert-obsidian.js`，只作用于 obsidian 方向。

- 背幕横向从 23.2×8.2 扩展到 27.8×9.6，竖向从 11.6×11.2 扩展到 13.4×12.6；保留原中心位置、主题图与比例裁切。景物延伸至帷幕后方，取消背幕细框显示，减少嵌入式屏幕感。
- 在原分区调色后增加边缘透明融合及轻微地平线空气感。采用背幕原始 UV 而非裁切后纹理 UV，手机边缘融合保持稳定；背景不写深度，保留深度测试。
- 现有地面材质加入局部暖冷反光，颜色来自各主题，按世界坐标确定性取样；没有新增灯光、纹理、几何或后处理通道。初轮远处压暗产生横向接缝，复审后已移除，只保留局部反光。
- 原角色、演员布局、相机、音乐响应和播放器保持原实现。沿用既有主题资产，本轮没有生成或替换位图。

## 验证

- 三主题均在 1280×720 和 390×700 的真实主入口检查，六张最终图片以 `final-` 开头。背幕、帷幕及舞台衔接正常，人物和歌词未被背景覆盖。
- 完成海贼王→龙珠→火影→海贼王主题往返；最终恢复桌面海贼王预览。
- 火影实际播放、跳转 35%（约 01:14）和暂停，检查高潮焰火与透明背景/玻璃舞台遮挡，未见背景覆盖角色或烟花。该截图位于移除地面远处压暗之前，文件 `naruto-climax.jpg`，不能作为最终地面亮度的证据。
- 两个模块语法检查与 `git diff --check` 通过；`band-stage`、`band-refinement`、`band-concert-models`、`band-scenography` 四项 Node 回归通过，最后修正后重跑通过。
- 最后浏览器捕获的 warn/error 日志为空。截图中间出现一次视口重置过渡帧，已重新等待界面状态并补拍龙珠桌面最终图，过渡帧不作为验收。
- 未新增动画；未实测实体手机 GPU/温升、完整导出、全部队形或普通方向实景。无新增下载或绘制通道不等于性能零成本，背景 alpha blending 的实际设备性能仍需实测。

## 证据与状态

备份和本轮独立差异：`output/stage-depth-20261025-163618/baseline/`、同目录 `*.patch` 与 `git-status.txt`。

最终六张图片：`final-one-piece-desktop.jpg`、`final-one-piece-mobile.jpg`、`final-dragon-ball-desktop.jpg`、`final-dragon-ball-mobile.jpg`、`final-naruto-desktop.jpg`、`final-naruto-mobile.jpg`。

预览：http://127.0.0.1:8765/index.html?intro=skip&band=pianai&concertLook=obsidian

本轮本地完成，未提交、发布。此次完成的是背景与空间衔接改进，不代表整体页面已达到奖项标准。

Agent：codex。
