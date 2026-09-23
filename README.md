# 16暗影 / 16 Shades

[中文](#中文) · [English](#english)

[官网](https://shades16.com) · [在线测评](https://shades16.com/prototype) · [About / 开放入口](https://shades16.com/about) · [开放资料 v1.0.1](https://github.com/zhangtianlei-debug/16shades-open/releases/tag/v1.0.1)

当前源码版本：**v1.1.0**。本版按 2026-09-23 已上线的网站服务版本整理，新增朋友眼中的我、个人合作说明书、人物壁纸、微信网页分享和网站／微信账号关联的公开网站代码；生产运行配置、搜索验证、统计标识、私有账号数据与凭据均未包含。完整变更见 [CHANGELOG.md](CHANGELOG.md)。

## 中文

这是「16暗影」网站的可独立构建源码：包含双语前端、16 角色结果页、测评流程、本地账号 API、内容读取器和当前正式网页素材。v1.1.0 依据 2026-09-23 已上线的服务端发布清单和 2026-09-22 已完成发布对应的前端源码整理；本地运行不会发布网站、提交搜索引擎、发送统计数据或连接生产数据库。

### 本地运行

需要 Node.js 22.13 或更新版本及 pnpm。安装依赖后运行：

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm content:publish
pnpm preview:build
```

在浏览器打开 [http://localhost:3106/prototype](http://localhost:3106/prototype)。本地账户和内容状态只会写入被忽略的 `var/` 目录。若只开发页面，可运行 `pnpm dev`；不要把 `.env`、`var/`、`dist/`、`.wrangler/` 或 `node_modules/` 提交到仓库。

若部署衍生站，先修改 `app/site-contact.ts` 中的运营者、联系邮箱和备案信息，使用自己的真实资料；该文件保留原站的公开展示资料以便源码还原，并不授权衍生站冒用这些身份信息。

`content-source/` 和 `scripts/publish-content.mjs` 提供可本地发布的双语示例内容：构建后运行 `pnpm content:publish`，再用预览服务访问 `/content/v1/index.json`、Wiki 与第一期小剧场。当前只包含第一期小剧场及包内 `public/theater/001/` 图片。后续剧集由线上内容发布流程单独管理，未包含在本源码版本或其开放许可中。

### 自建站部署配置

本源码的 `release.json` 与 `app/search/config.json` 均保留为空值或关闭状态：没有生产域名或搜索验证值，搜索收录默认关闭。部署者若有自己的正式 HTTPS 域名，可自行填写两处相同的域名，并仅在确认网站内容和爬虫策略后把 `indexingEnabled` 改为 `true`。`.env.example` 中的统计开关和 32 位站点标识也为空值或关闭；默认配置不会加载第三方统计脚本。

[shades16.com](https://shades16.com) 链接提供在线体验、内容来源说明和历史参考；本地运行使用本仓库的代码与配置。

### 许可范围

代码按 [MIT License](LICENSE) 开放。分类框架、固定 48 题表单及其英译按 [CC BY 4.0](LICENSES/CC-BY-4.0.txt) 开放，精确文件和混合 JSON 字段见 [CC BY 范围](LICENSES/CC-BY-4.0-SCOPE.md)。角色、动画、品牌、视觉素材、人物及其他未列入 CC BY 范围的创作内容均保留全部权利。完整边界见 [NOTICE](NOTICE)，依赖说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## English

[Website](https://shades16.com) · [Online assessment](https://shades16.com/en/prototype) · [About / open entry](https://shades16.com/en/about) · [Open Materials v1.0.1](https://github.com/zhangtianlei-debug/16shades-open/releases/tag/v1.0.1)

Current source release: **v1.1.0**. This version follows the website service deployed on 2026-09-23. It adds the public web code for friend impressions, the personal collaboration note, character wallpapers, WeChat web sharing, and website-to-WeChat account linking. Production runtime settings, search verification, analytics identifiers, private account data, and credentials are excluded. See [CHANGELOG.md](CHANGELOG.md) for the full scope.

This is an independently buildable source release for the 16 Shades website. It includes the bilingual frontend, sixteen character result pages, quiz flow, local account API, content reader, and the current production web assets. Version 1.1.0 is prepared from frontend source corresponding to completed 2026-09-22 releases and the deployed 2026-09-23 service manifest. Local use does not publish a site, submit pages to search engines, send analytics, or connect to a production database.

### Run locally

Use Node.js 22.13+ and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm content:publish
pnpm preview:build
```

Open [http://localhost:3106/prototype](http://localhost:3106/prototype). Local accounts and content state are written only to the ignored `var/` directory. Use `pnpm dev` for page development. Do not commit `.env`, `var/`, `dist/`, `.wrangler/`, or `node_modules/`.

Before deploying a derivative site, replace the operator, contact email, and filing information in `app/site-contact.ts` with your own real details. The file retains the original site's public display details for source fidelity; it does not authorize a derivative to use that identity.

`content-source/` and `scripts/publish-content.mjs` provide locally publishable bilingual example content: after building, run `pnpm content:publish`, then use the preview server to visit `/content/v1/index.json`, the Wiki, and theatre issue 001. Only issue 001 and its bundled `public/theater/001/` images are included. Later theatre issues are managed by the live-content workflow and are not included in this source release or its open licenses.

### Deployment configuration

`release.json` and `app/search/config.json` intentionally have blank or disabled production settings. There is no production domain or search verification token, and indexing is off. A deployer may enter their own HTTPS domain in both files, then enable indexing only after reviewing the site and crawler policy. The analytics switch and 32-character site identifier in `.env.example` are also blank or disabled; the default configuration keeps third-party analytics disabled.

[shades16.com](https://shades16.com) links provide the live experience, content attribution, and historical references. Local operation uses this repository’s code and configuration.

### Licensing

Original code is under the [MIT License](LICENSE). The framework, fixed 48-item form, and its English translations are under [CC BY 4.0](LICENSES/CC-BY-4.0.txt); see the exact paths and mixed-file fields in the [CC BY scope](LICENSES/CC-BY-4.0-SCOPE.md). Characters, animation, brand, visuals, personas, and other creative material not listed in that scope remain all rights reserved. See [NOTICE](NOTICE) for the exact boundary and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency notes.
