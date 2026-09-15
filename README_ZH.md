<div align="center">

<img src="public/brand/cueparcel-mark-dark.svg" width="72" height="72" alt="CueParcel 标志：一个开口的 C，开口处有一颗蓝色提示圆点">

# CueParcel

**Pick what matters. Pack it for AI.**

把任意网页变成干净、有出处可循的 AI 上下文。
CueParcel 让你可视化地挑选真正有用的内容、组合多个来源、指定任务意图、
在发送前逐项检查，然后复制给任何 agent。

**无后端 · 无遥测 · 无 API key · 本地优先**

[![CI](https://github.com/kallist/CueParcel/actions/workflows/ci.yml/badge.svg)](https://github.com/kallist/CueParcel/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](#隐私与权限)
[![Version](https://img.shields.io/badge/version-1.1.0-informational.svg)](CHANGELOG.md)

[English](README.md) · [简体中文](README_ZH.md)

[**下载 / 快速开始**](#快速开始) · [**看它实际跑起来**](#看它实际跑起来) · [**为什么要用 CueParcel**](#为什么要用-cueparcel) · [**隐私**](#隐私与权限)

<img src="docs/assets/cueparcel-hero.png" width="100%" alt="CueParcel 侧边栏与一个缺陷报告页面并排：Context Lens 已在页面上高亮出 Acceptance Criteria 一节，侧边栏中显示了捕获到的来源、包含一个 Lens 选区和一份文档来源的 Context Cart，以及 recipe 选择区">

</div>

---

> **本 README 里的每一张图都是生产版本扩展的真实截图。**
> 没有任何一张是效果图。这些图是在真实 Chromium 窗口中驱动**已构建的扩展**跑出来的
> （见[复现截图](#复现截图)）。每张图的说明文字都会写清楚它来自哪个页面、哪个 adapter。

## 看它实际跑起来

下面是一段真实的产品录屏：捕获一个缺陷报告 → 用 Context Lens 只挑出其中一节 →
再加入一份文档作为第二个来源 → 选择 **Fix** → 在复制之前检查 **TaskSpec** 与
**Context Receipt**。

<img src="docs/assets/cueparcel-demo.gif" width="100%" alt="操作录屏：捕获一个缺陷报告页面，Context Lens 高亮出 Acceptance Criteria 一节并将其变为一个 Context 来源，随后加入一份文档页面作为第二个来源，接着选择 Fix recipe，最后查看 TaskSpec 与 Context Receipt">

### 三个真实例子

| 把 issue 变成有出处的修复任务书 | 组合多个页面，只比较你选中的部分 | 挑出相关文档，打包给实现用 |
|---|---|---|
| <img src="docs/assets/cueparcel-card-fix.png" alt="侧边栏中显示一个由 Context Lens 选出的来源，标题为 Acceptance Criteria，角色为 Task，adapter 为 Generic Article，capture 为 Context Lens，scope 为 Selected sections"> | <img src="docs/assets/cueparcel-card-compare.png" alt="侧边栏显示 Context Cart 中有两个来源，并且选中了 Compare recipe"> | <img src="docs/assets/cueparcel-card-build.png" alt="侧边栏的 TaskSpec 预览中列出了两个来源各自的 role、adapter、capture 与 scope"> |
| 从报告里挑出验收标准，再补一份文档作为参考来源，选择 **Fix**。 | 把两个页面都加进来源，选择 **Compare**——只有一个来源时它是禁用的。 | 只挑出相关的那几节文档，选择 **Build**。 |

## 为什么要用 CueParcel

| | 只复制 URL | 复制粘贴整个页面 | **CueParcel** |
|---|---|---|---|
| 作用范围可控 | ✗ agent 自己去抓，抓到什么算什么 | ✗ 整页都进去 | **✓ 可视化挑选取区** |
| 多来源 | 一次一个 | 手工拼接 | **✓ Context Cart** |
| 来源角色 | ✗ | ✗ | **✓ Task / Reference / Evidence / Example / Selection** |
| 来源内容与生成内容分离 | ✗ | ✗ | **✓ 每一层都强制分离** |
| 出处信息（provenance） | ✗ | ✗ | **✓ 类型 + 捕获方式 + 范围，三者从不混为一谈** |
| 任务意图 | 每次手写 | 每次手写 | **✓ Learn / Compare / Verify / Build / Fix** |
| 机器可读契约 | ✗ | ✗ | **✓ 带版本号的 TaskSpec JSON** |
| 本地优先 | 取决于 agent | 取决于 agent | **✓ 数据不离开浏览器** |
| 发送前可检查 | ✗ | ✗ | **✓ Agent / Markdown / TaskSpec + Receipt** |

只给一个 URL，等于让 agent 自己去猜上下文。整页粘贴，等于把导航栏、页脚和一堆无关
章节一起塞进去。CueParcel 是中间那条路：**上下文由你选，而且你能看见自己到底选了什么。**

## 快速开始

CueParcel 目前还没有上架任何扩展商店。**Chrome 应用商店版本尚在计划中，还没有上架**，
也还没有可下载的 release —— 第一个 release 正在准备。下面两种方式现在都能用。

### A. 自己构建并加载已解压扩展（现在就能用）

前置条件：**Node.js 24**（见 `.nvmrc`）。

```bash
git clone https://github.com/kallist/CueParcel.git
cd CueParcel
npm ci
npm run build          # -> dist/
```

然后：

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）。
2. 打开右上角的 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择刚生成的 `dist/` 文件夹。
4. 固定 CueParcel：点击工具栏上的扩展（拼图）图标，再点 **CueParcel** 旁边的图钉。

> 固定扩展必须由用户自己操作，扩展无法自己固定自己。当 CueParcel 检测到自己还没被
> 固定时，会显示一张可关闭的简短引导卡片说明这一点；你关掉之后它就不会再打扰你。

之后在任意页面点击 CueParcel 图标：自动开始捕获，并打开侧边栏。
键盘替代方案：**`Alt+Shift+Y`**。

### B. 使用 release 压缩包（等有了 release 之后）

`npm run package:release` 会在仓库根目录生成可直接加载的压缩包：

```bash
npm run package:release     # -> cueparcel-v1.1.0-chromium.zip + SHA256SUMS.txt
```

解压后，按上面第 1–4 步用 **加载已解压的扩展程序** 选择**解压出来的那个文件夹**。
`manifest.json` 就在压缩包的根目录，所以解压出来的文件夹本身就是扩展目录 ——
不要把 Chrome 指向它的上一级目录。

等第一个 GitHub Release 发布后，同一个压缩包会附在那里；在那之前请按上面的方式自己
构建。发布流程记录在 [docs/launch/RELEASE.md](docs/launch/RELEASE.md)。

## 它能理解什么

### V1.1 的六项能力

1. **Context Lens** —— 页面内的可视化挑选模式。语义区块（章节、代码块、表格、列表、
   GitHub issue 区域）在悬停时会被高亮，并实时显示 `selected-content tokens`
   估算值；点一下即可包含或排除。**它不会修改页面 DOM。**
2. **Context Cart** —— 把多个页面、挑选出的选区以及文本选择组合成同一份 agent
   上下文。角色分为 `Task`、`Reference`、`Evidence`、`Example`、`Selection`，
   可指定一个主来源，可重排、撤销、清空。只存在于会话内，不落盘。
3. **Context Recipes** —— 不用写 prompt：直接选你想让 agent 做什么 ——
   `Learn`、`Compare`、`Verify`、`Build`、`Fix`。recipe 会根据 adapter 分析给出
   推荐，但最终由你决定。
4. **Semantic Adapter 2.0** —— 可识别 Generic Article、GitHub Issue、
   GitHub Pull Request 与 Technical Documentation；置信度不足时会诚实地回退到
   Generic，而不是硬套一个类型。
5. **TaskSpec** —— 带版本号、可移植、确定性的 JSON 任务契约：来源、角色、
   出处、由 adapter 实际解析出的来源事实、**只有当来源真的写了**才出现的验收标准、
   明确的未知项、生成给 agent 的指令以及 token 估算。其他工具无需了解 CueParcel
   内部结构即可消费它。
6. **Context Receipt + Nutrition Label** —— 一份紧凑的说明，讲清楚 agent 究竟会
   收到什么：总上下文 token，以及来源 / 生成 / 元数据三者的占比；展开后还能看到
   包含项与排除项、来源与生成内容的区分、未知项。**没有编造出来的质量评分。**

### 三个出处维度，从不混为一谈

"来源是什么"、"怎么捕获的"、"捕获了多少"是三件互相独立的事实。所以一个用
Context Lens 裁过的 GitHub Issue，它依然是一个 GitHub Issue：

```text
Type:    GitHub Issue          ← semantic adapter（这个页面"是什么"）
Adapter: GitHub Issue
Capture: Context Lens          ← 捕获方式（用户是怎么裁剪的）
Scope:   Selected sections     ← 捕获范围（捕获了多少）
```

TaskSpec 里保留同样的拆分（`adapter`、`captureMethod`、`scope`）。

## 使用场景

- **把缺陷报告变成修复任务书。** 从 issue 里挑出验收标准，补上相关文档作为参考来源，
  选择 **Fix**，把结果复制进 agent。
- **对比两个来源。** 捕获两个页面、都加进来，然后选择 **Compare**。CueParcel
  不会用一个来源编造出"对比"——只有一个来源时按钮就是禁用的。
- **把文档打包给实现用。** 只挑出真正相关的那几节文档，选择 **Build**。
- **发送前先确认。** 打开 **Context Receipt**，看清来源与生成内容的占比，
  以及哪些事实被排除了，然后再复制。

## 隐私与权限

- **捕获永远由你触发。** 后台不会自己跑任何东西。
- **一切都在扩展内部本地处理。** 没有后端、没有统计、没有遥测、没有 provider key、
  没有云同步、没有远程代码。
- **四个权限，你不点它就不动。**

  ```text
  activeTab   scripting   sidePanel   storage
  ```

  没有 host permissions，没有 `<all_urls>`，没有 `tabs`、`cookies`、`history`、
  `bookmarks`、`webRequest`、`nativeMessaging`。
- **状态只存在于会话内。** 捕获到的页面内容存放在 `chrome.storage.session`，
  浏览器关闭即清除。每个窗口最多缓存一份已捕获文档，且捕获内容**永远不会**写入
  `chrome.storage.local`。唯一的本地偏好是一个布尔值，记录"固定引导已被关闭"。
- **页面内容一律视为不可信输入。** 来源内容与 CueParcel 生成的指令在每一层都严格
  分离，prompt injection 的信任边界对 cart 中的每一个来源都生效。

以上是对代码行为的陈述，**不是任何安全认证**。

## 工作原理

```text
工具栏操作 → Capture → Semantic Adapter → NormalizedDocument
  → Context Lens / 文本选择 → ContextSource
  → Context Cart → Recipe → TaskSpec → Agent | Markdown | JSON
  → Context Receipt
```

- **Core** —— 领域契约与校验器（`NormalizedDocument`、ContextSource/Cart、
  Recipes、TaskSpec、Receipt/Nutrition）、确定性的 token 估算器，以及来源
  Markdown 序列化。Markdown 只是交付格式，`NormalizedDocument` 才是规范表示。
- **Application** —— TaskSpec 构建与 JSON、agent / markdown 文本、选区片段文档。
- **Adapters** —— Generic Article、GitHub Issue、GitHub Pull Request、
  Technical Documentation（注册表顺序为具体 → 通用，绝不反向）。
- **Extension** —— Service Worker 的捕获编排与 lens 路由、content script 捕获与
  lens 引擎、侧边栏工作台 UI、会话与 cart 存储、工具栏角标与固定引导。

### 由 adapter 实际解析出的来源事实

adapter 真正解析到的事实会进入 TaskSpec，这样消费方不必再去重新解析 URL：
`repository`、`issueNumber` / `pullRequestNumber`、`state`、`labels`、`author`、
`publishedAt`、`baseBranch`、`headBranch`。**DOM 没有提供的事实就保持缺失** ——
不推断、不猜测。

### token 的三个阶段

同一个来源会在三个位置被测量，数字本来就不一样，所以每个界面都会标明自己展示的是
哪个阶段。所有数值都是**估算**，来自同一个确定性的离线启发式算法 ——
不代表任何模型 tokenizer 的结果。

| 阶段 | 显示为 | 出现位置 |
|---|---|---|
| 已挑选内容 | `~296 selected-content tokens` | Context Lens 浮层、选区摘要 |
| 打包后的来源 | `~560 packaged-source tokens` | 来源卡片、Context Cart |
| 整份上下文 | `~836 total-context tokens` | Context Receipt、Nutrition Label |

## 已知限制

CueParcel 会如实说明它做不到什么。下面这些是已知且有记录的限制，不是意外：

- **`activeTab` 授权会失效。** 页面跳转或关闭标签页后就没了，所以捕获总是从目标
  页面上的工具栏操作开始。
- **抽取基于 DOM 与启发式规则。** 类应用页面、纯脚本渲染的页面、iframe 和 PDF
  可能抽不出内容。GitHub 改版可能让 GitHub adapter 失效；Technical Docs 分类器
  刻意保守（宁可回退到 Generic）。
- **Shadow root。** 如果文章内容位于 shadow root 之内，目前会返回
  `NO_CONTENT_FOUND`，而不是给出具名的原因。这一项已在跟踪。
- **token 数是估算值**，来自一个确定性启发式算法，从未声称等同于任何模型
  tokenizer。
- **预览是纯文本**，不是渲染后的 Markdown。
- **没有历史记录、没有账号、没有同步。** 只保留会话级状态。
- **尚未上架任何商店。** Chrome 应用商店与 Edge 加载项都在计划中；今天只能按上面
  的方式以解压包安装。
- **有些界面无法在 CI 中自动化**：原生侧边栏容器、工具栏点击产生的 `activeTab`
  授权、扩展管理页的列表显示，这三项属于人工 QA 范围。

## 开发

```text
npm run lint            ESLint
npm run typecheck       TypeScript 严格检查
npm run test            Vitest（单元 / 集成 / 组件）
npm run test:e2e        构建 + Playwright MV3 扩展 E2E（有头 Chromium）
npm run build           生产构建 + 产物校验
npm run verify          快速确定性门禁（lint + typecheck + test + build）
npm run verify:all      verify + E2E
```

`npm run test:e2e` 使用**仅测试用的 harness**（`dist-e2e/`，已 gitignore）：在生产
构建之上加一个只授予本地 fixture 源（`http://127.0.0.1/*`）host 权限的测试
manifest，因为通过 GUI 自动化点击工具栏无法可靠地产生 `activeTab` 授权。因此 E2E
**不**验证生产环境的 `activeTab` 授权体验，也不验证原生侧边栏容器。

完整贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 测试

**74 个文件、765 个单元 / 集成 / 组件测试，外加 13 个浏览器 E2E 测试，全部通过。**
没有跳过的测试，没有 `continue-on-error`。

- **单元** —— 领域模型、校验器、消息（含全部 lens 消息）、cart reducer、receipt、
  task spec、来源事实、出处维度、工具栏角标、引导流程、会话与缓存、文件名与预览。
- **集成** —— adapter 与 TaskSpec 管线，跑在真实的离线 fixture 上（Generic、
  GitHub Issue 含现代 task list、GitHub PR、Technical Docs，以及"长得像文档站但
  必须保持 Generic"的页面）。
- **组件** —— 侧边栏 V1.1 的各种状态与流程（Testing Library），包含 receipt 展开
  与工具栏 / 引导行为。
- **浏览器 E2E** —— 真实 Chromium 加载已构建的扩展：捕获、Context Lens 选区、
  Cart 多来源、recipe → TaskSpec 映射、文档分类、receipt（紧凑与展开）、token
  阶段、出处维度，以及恢复 / 重复捕获 / 无内容等路径。

有几条测试专门盯住的规则，因为它们一旦被破坏就很难发现、代价又很高：

- **来源内容与生成内容分离。** 如果某个 GitHub Issue 里没有 "Acceptance
  Criteria"，输出会写
  `Source Acceptance Criteria: Not explicitly provided in source.`
  产品绝不会自己发明需求，再当作来源原本的要求呈现出来。
- **不编造验收标准。** 生成的工程要求只能出现在 CueParcel 生成的指令部分。
- **未知就是未知。** DOM 没提供的事实就保持缺失。
- **竞态安全。** 最新一次捕获获胜；过期的捕获永远不会覆盖更新的界面状态。

## 生态边界

CueParcel 产出 TaskSpec 与网页上下文。仓库检索是另一个项目的事：

```text
CueParcel     Web → TaskSpec
ContextForge  TaskSpec + Repository → Repository Context
```

## 品牌与兼容性说明

CueParcel 早期以 Page2Agent 为名开发。现在公开产品、扩展元数据以及面向用户的输出
都是 CueParcel。TaskSpec schema v1.0 有意保留：

```json
"producer": { "name": "Page2Agent", "version": "1.1.0" }
```

`producer.name` 是序列化后的机器可读契约的一部分，外部消费方可能已经在按这个确切
值做分支判断。在没有对协议做版本升级的情况下改掉它，等于一次静默的破坏性变更，
所以它作为一个稳定的序列化标识保留下来。**这不是没清理干净的旧品牌，不要批量替换。**
内部标识（`p2a-*` 类名、`page2agent.*` 存储键、`Page2AgentError` 类型）出于同样的
原因保留。详见 [docs/BRAND.md](docs/BRAND.md)。

## 复现截图

README 中的图片是这样产生的：在真实 Chromium 窗口中驱动**生产构建**，走扩展自己的
捕获管线，然后把帧确定性地合成：

```text
capture:  构建扩展 → 解压加载 dist/ → 驱动工作台 → 2x PNG 帧
compose:  缩放、裁剪、标注这些真实帧（合成器从不自己绘制任何产品 UI）
```

每张图的说明都写明了它来自哪个页面、哪个 adapter。有两点需要如实说明：

- **Fix** 那个例子是在一个演示用的缺陷报告页面上捕获的，所以它的来源卡片显示
  `Generic Article`。在真实的 `github.com` issue 上，同样的流程会显示
  `GitHub Issue` —— 这正是集成测试针对已提交的 issue fixture 所验证的 adapter。
- **本 README 中没有任何一张图声称来自 `github.com`**，因为生成这些图的 harness
  无法提供该源。

## 参与贡献

欢迎提 issue 和 pull request —— 见 [CONTRIBUTING.md](CONTRIBUTING.md)、
[SECURITY.md](SECURITY.md) 以及[路线图](ROADMAP.md)。issue 模板会要求你提供复现
信息；**请不要把私密的页面内容贴到公开 issue 里。**

## 许可证

MIT —— 见 [LICENSE](LICENSE)。

<div align="center">

如果 CueParcel 帮你省下了复制粘贴的功夫，点个 star 能让更多人看到它。

[**★ Star CueParcel**](https://github.com/kallist/CueParcel) · [反馈问题](https://github.com/kallist/CueParcel/issues) · [路线图](ROADMAP.md)

</div>
