# 律 · 乐队舞台配色与背景升级

日期：2026-10-25。Agent：codex。

## 范围与结果

按用户「舞台配色背景升级」实施小范围视觉调整，仅修改 `js/ui/band-concert-obsidian.js` 与 `js/ui/band-stage.js`。沿用当前 `concertLook=obsidian` 入口；普通方向的原有参数保留。没有修改角色、音频、布局、取景或界面 CSS，没有新增贴图或模型下载。

- 海贼王：深海蓝绿、铜金反射，帆面从灰白降为深青；帷幕与台阶共用海洋色系。
- 龙珠：墨绿台阶、低饱和青绿边光、琥珀金属与背幕高光。
- 火影：靛紫台阶和帷幕、月白冷光及浅暖色高光。
- 背景沿用原图，新增分区调色：阴影/高光分别映射主题色，降低杂色饱和度，淡化两侧、下缘和顶端，保留中央景物与地平线。使用独立屏幕 UV，避免手机纹理裁切改变暗角位置。
- 降低背幕框线、帷幕 sheen，调整台阶透射/粗糙度与地面反射。首轮台阶偏绿，二轮降低饱和度并恢复更清透的材质。

## 验证

- 真实主入口：三主题各在 1280×720 与 390×700 检查并保存截图，人物、歌词与播放器无遮挡。本轮未改变画面几何。
- 主题顺序：海贼王 → 龙珠 → 火影 → 海贼王；角色数量和主题布景正常更新。
- 火影实际播放《偏爱》，进度跳到 35%（约 01:14）并暂停：歌词、舞台与高潮焰火正常显示；跳回开头恢复安静画面。
- 浏览器捕获的 warn/error 日志为空；真实 WebGL 编译及渲染正常。
- 两个修改模块的 `node --check`、`git diff --check` 通过。
- `band-stage`、`band-refinement`、`band-concert-models`、`band-scenography` 四项现有 Node 回归通过，模型摘要与既有确定性动作检查通过。
- 未测实体手机 GPU、温升、录制导出；没有进行完整八维奖项重新验收，不宣称达到奖项级或绝对最优。本轮本地完成，未提交或发布。

## 回退与证据

修改前已保存两个完整源码副本、Git 状态和工作区 binary patch：`output/stage-color-20261025-152300/`。既有未提交改动保留，未删除文件。

截图同目录：`one-piece-desktop.jpg`、`one-piece-mobile.jpg`、`dragon-ball-desktop.jpg`、`dragon-ball-mobile.jpg`、`naruto-desktop.jpg`、`naruto-mobile.jpg`、`naruto-climax.jpg`。

预览：http://127.0.0.1:8765/index.html?intro=skip&band=pianai&concertLook=obsidian

Agent：codex。
