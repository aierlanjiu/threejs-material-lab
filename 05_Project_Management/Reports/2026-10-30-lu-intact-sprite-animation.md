# 完整人物逐帧恢复与索隆补帧样片

Agent: codex · 2026-10-30

## 当前结论

用户否定此前肩肘腕拼接动画：人物歪扭，要求沿用原先完整角色动画，增加帧数和动作。骨骼版本的关节误差、解码和自动化通过不代表视觉目标达成。该版本已退出主站和制作间的角色渲染路径。

- 主站十位角色恢复 `assets/band-pets/one-piece/` 的原四帧，真实贝壳 GLB、站位和交互保留。
- 索隆生成 16 个新的完整人物姿态，普通弹奏与重拍各 8 个；休止使用原版第 0 帧。仅做整帧等比缩放、平移和图集打包，没有拆肢体、骨骼拼接或局部拉伸。
- 索隆是待视觉确认样片，未替换主站角色。其他九位尚未扩帧，不能据此宣称全员动画提升完成。
- 音频未改。《One day》目前九轨仍是此前模板编配，尚不满足用户要求的原曲主唱、乐队伴奏解析与重组；该项继续待完成。

## 可查看结果

- `sprite-animation-review.html`：原版与补帧同高度对照，普通弹奏／重拍／休止、暂停、慢放、拖动时间。
- `output/sprite-animation-20261030/zoro-comparison.mp4`：10 秒无声对比，1280×800、30fps、300 帧；前四秒普通弹奏、接着四秒重拍、最后两秒休止。视频帧率不等于独立姿态数，独立新增姿态为 16。
- `output/sprite-animation-20261030/zoro-comparison.gif`：动画预览。
- `assets/band-pet-actions/one-piece/zoro/`：17 格 lossless WebP、生成原图、动作索引及逐格来源注册记录。
- 旧 `character-rig-review.html` 重定向至完整人物样片，制作间恢复原四帧，避免误展示被否定的版本。

## 验证

- 主站实际浏览器：十人均 `renderMode=sprite-sequence`、`spriteFrameCount=4`、`layered=false`。桌面人物完整，未见此前分件扭曲；全景人物较小，细节判断受当前尺度限制。实际点击播放时间推进，再暂停时间保持。390／320 模拟视口无横向溢出，未记录页面错误。
- 主站证据：`output/character-rig-rebuild-20261030/browser/sprite-return/`。
- 图集：17 格像素不同，其中 16 格为新姿态；所有画格四边安全区透明；原版休止的 alpha 与可见 RGBA 像素保留不变。证据 `output/sprite-animation-20261030/asset-evidence.json`。
- 10 秒 MP4 完整解码通过；各动作使用的实际图集帧见 `video-evidence.json`。
- `npm run check`：21／21 通过，记录 `output/sprite-animation-20261030/tests.txt`。测试通过不替代视觉连贯性验收。
- 新样片浏览器：播放推进、暂停保持、慢放约0.4倍、休止与减少动态取原帧0、390／320布局及页面无错误通过。初版逐帧发现头部回跳，已按点头姿态重排普通与重拍顺序、保留相同整帧像素，并重新导出。首次时序保留在 `output/sprite-animation-20261030/first-timing/`。
- 验证限制：浏览器代理只能逐帧判断跳变，不能代替连续主观视频听看验收。普通与重拍的手部差异仍偏小；动作自然度及用户风格认可未通过，不据帧数或技术测试宣称完成。
- 重排复查：普通与重拍0.25／0.333／0.416／0.5秒及循环边界抽帧，原头部回跳明显减轻，未见明显身体跳位。证据 `output/sprite-animation-20261030/browser/retimed/`；连续主观流畅度仍未确认。
- 为强化手势另作两次原生8帧重拍生成，均残留背景雾色，未纳入可用资产，也未继续重复同一生成方案；不可将其算为新的可用姿态。现样片仍为最初16整帧的重新排序版本。

## 备份与生成

- 改动前 10 个入口／记录文件的物理快照及 SHA-256：`output/sprite-animation-20261030/before/`，含 `git-status.txt`；没有删除旧资产，没有重置其他工作区改动。
- 索隆原始生成：`exec-190ab357-5e2d-48f7-8c0e-817e1ee981f4.png`，已复制到项目 `generated-sheet.png`；提示词保存同级 `generation.json`。
- 打包脚本：`scripts/package-sprite-actions.py`；播放选择器：`js/avatar/sprite-actions.js`；视频渲染：`scripts/render-sprite-comparison.mjs`。
- 未提交、未发布。后续扩展沿用完整人物原版参照，逐人检查左右手、头身比例、乐器接触与连续播放，不再按骨骼几何正确推定美术通过。
