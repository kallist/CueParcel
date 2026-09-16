<!-- 草稿 / DRAFT — 本文尚未发布到任何社区。发布前请先阅读目标社区（V2EX、掘金、少数派等）的版规与自我推广政策，并确认内容与已发布的 1.1.0 版本一致。请不要代替作者发布。 -->
<!-- 作者备注（发布时请删除本行及上一行）：TaskSpec 的 producer.name 出于兼容性仍写作 Page2Agent。 -->

# 把网页里真正有用的那几段，挑出来交给 AI —— CueParcel

往 agent 里直接粘 URL、整页复制，是最常见的一步错棋。导航栏、页脚、无关段落会被一起送进去，真正有用的两段反而淹在中间，模型看不出重点，于是给出一个建立在错误输入上的自信答案。

CueParcel（原名 Page2Agent）是 local-first 的 Chrome / Edge Manifest V3 扩展，MIT 许可，版本 1.1.0。它把"挑上下文"当成一个正经步骤：视觉挑选、打包、检查，然后复制进你已有的 agent。它只**准备和复制**上下文，不调用模型，也不替你运行 agent。

六个能力：**Context Lens** 在页面内可视化挑选，语义区域悬停高亮并实时显示已选内容的 token 估算，点击加入或排除，页面 DOM 全程不被修改。**Context Cart** 把多个页面、挑选区域和文本选择合成一份上下文，各标角色（Task / Reference / Evidence / Example / Selection），只允许一个主来源，可排序、撤销、清空，仅存在于当前会话。**Context Recipes** 不写 prompt，改成选意图：Learn、Compare、Verify、Build、Fix，建议来自 adapter 分析，决定权仍在你。**Semantic Adapter 2.0** 识别 Generic Article、GitHub Issue、GitHub Pull Request、Technical Documentation，置信度不足时诚实回退到 generic。**TaskSpec** 是带 `schemaVersion` "1.0" 的确定性 JSON 契约：sources、roles、provenance、来源事实、仅在原文确实写了时才出现的验收标准、显式 unknowns、生成指令与 token 估算，其他工具不必了解扩展内部即可消费。**Context Receipt + Nutrition Label** 说明 agent 到底会收到什么：总 token 与 source / generated / metadata 拆分，并可展开为 Included / Excluded、生成内容与原文的分离，以及 unknowns，没有虚构的质量评分。

隐私上全部本地运行：没有后端、遥测、analytics、API key、云同步和远程代码；捕获永远由你手动触发。扩展只申请四项权限——`activeTab`、`scripting`、`sidePanel`、`storage`，没有 host permissions，没有 `<all_urls>`，没有 tabs、cookies、history。会话状态只写在 `chrome.storage.session`，关闭浏览器即清空，抓取的页面内容不写入 `chrome.storage.local`。仓库中 765 个单元/集成测试（74 个文件）与 13 个 Playwright 浏览器 E2E 全部通过。

现在还不行的部分也一并说清：CueParcel 目前只通过 GitHub Releases 发布，安装要靠解压 release、在 `chrome://extensions` 开启开发者模式后 Load unpacked，暂未提供浏览器扩展商店安装。提取基于 DOM 启发式，App 化页面、仅脚本渲染的内容、iframe 与 PDF 可能提取不到，GitHub 前端变化也可能让 GitHub adapter 失效。token 数只是某个离线启发式的确定性估算，不等于任何模型的 tokenizer。预览是纯文本，不渲染 Markdown；没有历史记录、账号与同步。已知问题：正文位于 shadow root 内的页面会返回 `NO_CONTENT_FOUND`，仍在跟踪。

## 适合发在哪里

V2EX 的 分享创造 节点、掘金、少数派都可以，但各社区对自我推广的规定差别很大——有的要求特定节点或标签，有的限制发布频率，有的需要账号先有正常的社区参与。发布前请先读各自的版规。这是 side project，不是付费推广。

仓库：https://github.com/kallist/CueParcel
