# 律：前排三人粒子翼修复

Agent: codex · 2026-10-16

## 结果

三个主题统一为主唱与两位前排搭档配翼，按固定角色身份随队形移动：

| 乐队 | 配翼角色 |
| --- | --- |
| 海贼王 | 路飞、索隆、娜美 |
| 龙珠 | 悟空、贝吉塔、布尔玛 |
| 火影 | 鸣人、佐助、小樱 |

沿用已经批准的纯粒子造型、肩部锚点、根部光晕、高潮三秒保持及消散、其他角色遮挡和窄屏粒子预算。改变站位不会把翼效转给另一位角色。静音成员仍隐藏自己的翼效；翼效作为舞台装饰，不再要求角色具有 MIDI 音符。

## 根因与修改

`js/ui/band-scene.js` 原先只给人声／吉他创建翼效，又在翼效更新和舞台聚焦中要求 `parts[i].events.length`。全曲混音的人声来自原唱波形，其 MIDI 事件正确地为空，因此主唱被排除。

修复前实际《偏爱》在 61.88 秒的全局翼效强度为 1，路飞翼效仍为 0，乌索普翼效为 1；人声事件数为 0，与上述条件一致。两处 MIDI 显示门限均已解除，创建范围改为各主题名册的前三位角色。音频与角色演奏活动计算保持原实现。

## 验证

- 新增 `test/band-front-wings.browser.js`，通过 Playwright CLI `run-code` 执行。旧实现明确失败于三人配置断言，新实现通过。
- 三首实际全曲混音：《偏爱》、CHA-LA HEAD-CHA-LA、Blue Bird。实际高潮分别为 60.79、79.2267、201.0153 秒；原唱均无 MIDI，主唱与两位搭档的翼效均可见。
- 1440×900／390×844 均有三套纯粒子翼，分别使用每套 8688／5808 粒子，并向着色器传入其余全部角色的遮挡区域；截图核对三人的翼从肩部展开、面部可见。
- 五种队形、减少动效、特效关闭、暂停与跳转重建检查通过。
- 语法检查、`band-stage.test.mjs`、`band-pyro-realism.test.mjs`、`perceptual-effects.test.mjs`、`git diff --check` 在当前目录及从已发布提交创建的独立校验目录均通过。独立目录只应用本轮场景补丁和浏览器回归文件。
- 证据：`output/playwright/band-front-wings/` 下的 `before-fix.log`、`after-fix.log`、`result.json`、`isolated-tests.log` 与六张横竖屏截图。实体手机性能未复测。

## 交付状态

已按用户指令发布到 [GitHub Pages](https://aierlanjiu.github.io/threejs-material-lab/index.html?intro=skip&band=pianai&v=39421c8)。

- 源码提交：`39421c822f9052ccdcca59ff60ae0f6b27786b76`，分支 `feat/band-prism-pet-stage`。
- Pages 提交：`7e49dd4be84fe0cc85332a63c9ded8b7f5ae8805`。GitHub 工作流 `38882596560` 构建与部署成功，Pages API 状态为 `built`。
- 发布树为 1,040,341,465 字节，与上一线上树相比仅 `js/ui/band-scene.js` 变化；沿用既有发布过滤规则。原始资产与未提交文件均未删除。
- 公开地址读回的场景模块 SHA-256 为 `fb191b6b3d606cd604005e19e81f50ab77c0c7c0ac4039978ce1fc92798ea4a3`，与源码提交内容逐字节一致。
- 在公开页面重跑三主题真实歌曲、1440／390px、五队形、减少动效／关闭、暂停／跳转回归，全部通过；原唱无 MIDI 时的三套翼效均可见。已核对线上手机画幅截图。此为桌面浏览器移动画幅检查，非实体 iPhone 性能验收。
- 证据：`output/front-three-wings-release/publication.json`、`remote-readback.json`、`live-browser-result.json`、`pages-build.log` 与 `screenshots/`。
- 系统「减弱动态效果」开启时仍按既有约定关闭角色动画、烟火与翼效；iPhone 需要关闭该设置后刷新才能观看。

工作区其他宣传片报告、脚本与进度条目均保留；本轮仅提交场景修复、对应回归测试及本报告／相关进度条目。
