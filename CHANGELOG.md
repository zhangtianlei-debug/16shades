# Changelog

## v1.1.1 — 2026-09-23

### 中文

- 补齐独立内容发布流程使用的 Wiki 内容源与渲染逻辑，使按 README 启动后的知识页也包含已上线的来源说明与关系实例。
- 保留 34 篇 Wiki、第一期小剧场示例和默认关闭的收录／统计配置。

### English

- Updates the Wiki sources and rendering used by the independent content-publishing workflow, so pages served through the documented startup process also include the deployed references and relationship examples.
- Retains 34 Wiki articles, the first theatre issue as an example, and indexing and analytics disabled by default.

## v1.1.0 — 2026-09-23

### 中文

- 同步已完成发布的「朋友眼中的我」：登录后创建邀请、接收 48 题第三人称反馈、查看和删除反馈；逐题回答不会上传。
- 同步个人合作说明书与人物壁纸。说明书依据本次结果生成四项可编辑建议，壁纸保留标准人物图与精选主题图。
- 补齐朋友反馈、壁纸直达和结果分享的主页面入口，并同步已上线的双语参考来源与关系实例。
- 同步微信网页分享：服务端签名接口仅在设置自己的环境变量后启用；空配置保留浏览器复制链接和系统分享。
- 同步网站与微信账号关联服务：一次性关联码、结果预览与明确保留选择。公开源码只提供可配置实现，不包含小程序工程、账号数据或微信凭据。
- 开放资料入口指向 `16shades-open` 的 v1.0.1 GitHub Release；仓库仍保留 v1.0.0 的自包含示例包。

来源：前端来自 2026-09-22 已完成发布的源码范围；9 月 23 日服务端文件与生产版本 `20260923-miniapp-v201-account-link` 的发布清单逐项核对。生产运行配置、验证文件、统计配置、数据库、备份、内部运维目录与密钥均已排除。

### English

- Synced the released “How friends see me” flow: signed-in invite creation, 48 third-person answers, feedback viewing, and deletion. Item-level answers are not uploaded.
- Synced the personal collaboration note and character wallpapers. The note generates four editable suggestions from the current result, and wallpapers include standard portraits and selected themed images.
- Connected friend feedback, direct wallpaper links, and result sharing to the main flow, and synced the released bilingual references and relationship examples.
- Synced WeChat web sharing. Its server signing endpoint activates only with a deployer’s own environment variables; blank settings retain copy-link and system-share behavior.
- Synced the website-to-WeChat account-link service: one-time codes, result previews, and an explicit keep choice. This repository provides configurable code only; it excludes the mini-program project, account data, and WeChat credentials.
- The Open Materials entry now points to the `16shades-open` v1.0.1 GitHub Release. The repository retains the self-contained v1.0.0 example bundle.

Sources: frontend code corresponds to completed 2026-09-22 releases; the 2026-09-23 server files were checked file-by-file against the `20260923-miniapp-v201-account-link` production release manifest. Production runtime settings, verification files, analytics configuration, databases, backups, internal operations directories, and credentials are excluded.
