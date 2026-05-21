![mrui-logo](./otherfile/images/logo.png)

## Mirouter-ui

> 😎 基于小米路由器API的展示面板

[![Docker Pulls](https://img.shields.io/docker/pulls/thun888/mirouter-ui)](https://hub.docker.com/r/thun888/mirouter-ui)
[![HitCount](https://hits.dwyl.com/Mirouterui/mirouter-ui.svg?style=flat)](http://hits.dwyl.com/Mirouterui/mirouter-ui)
[![Release And Docker](https://github.com/Mirouterui/mirouter-ui/actions/workflows/buildapp.yml/badge.svg)](https://github.com/Mirouterui/mirouter-ui/actions/workflows/buildapp.yml)
[![Build DEV version](https://github.com/Mirouterui/mirouter-ui/actions/workflows/buildapp-dev.yml/badge.svg)](https://github.com/Mirouterui/mirouter-ui/actions/workflows/buildapp-dev.yml)



## 🏗️ 部署与运行 (物理原生挂载 + 动态拉取/离线自适应版)

为了根治多页面子路由刷新 404 与多语言翻译包 (JSON) 缺失问题，我们采用全新的 **“物理挂载 + 动态按需下载解包”** 方案。在保证 Git 仓库极度整洁（绝不提交任何碎前端文件）的同时，提供极佳的容器部署与动态热刷新体验。

### 1. 准备配置文件

1. 在项目根目录下新建一个 `data` 文件夹用于存放配置和历史数据库文件。
2. 将根目录下的 `config.yaml` 复制到该目录下：
   * **Linux/macOS (Bash)**: `mkdir -p data && cp config.yaml data/config.yaml`
   * **Windows (PowerShell)**: `mkdir data; copy config.yaml data/config.yaml`
3. 编辑 `data/config.yaml`，填入您的小米路由器 **管理密码** (`password`) 与 **IP 地址** (`ip`)。

### 2. 🚀 Docker 极速部署（推荐 🐳）

您无需手动放置前端静态文件！在项目根目录下直接执行以下命令：

* **第一步：构建本地专属离线镜像**
  ```bash
  docker build --build-arg VERSION=1.0.0 -t mirouter_ui_local .
  ```
* **第二步：一键运行容器（使用 $(pwd) 动态挂载本地 data 目录）**
  ```bash
  docker run -d -p 6789:6789 -v $(pwd)/data:/app/data --restart always --name mirouter-ui-local mirouter_ui_local
  ```

> [!TIP]
> 容器在首次启动时，程序会自动探测到缺失 `static/index.html`，并将自动从您的最新专属链接 `https://file.zhya.top/mi-ui-static.zip` 高速下载并流式解压缩到容器内的 `static/` 物理目录，瞬间实现自适应免配置部署！

访问 `http://localhost:6789` 即可直接打开监控面板。由于采用的是规范的物理磁盘 `http.Dir` 原生文件服务，所有子页面及翻译 i18n 资源文件 100% 完美加载，绝无 404！

---

### 🔄 ✨ 前端一键免重启热更新

若您在以后更新了前端代码，并上传覆盖了您的静态托管地址 `https://file.zhya.top/mi-ui-static.zip`，您**不需要重新构建 Docker 镜像，也不需要重启容器**！

只需直接用浏览器或 curl 访问以下接口：
```text
http://[服务器IP]:6789/systemapi/flushstatic?api_key=[您的ApiKey]
```
后台程序在接收到该请求后，会自动静默从托管地址下载最新的静态包并重新覆盖解包，您刷新浏览器即可看到全新界面！

---

### 🔒 纯局域网离线部署支持

如果您在某些**完全无法接入公网**的物理私有云/局域网环境下运行，本系统同样完美自适应支持：
1. 您只需提前在项目根目录下创建一个 `static/` 物理目录。
2. 将最新的前端文件（如 `index.html` 等碎文件）解压缩放入 `static/` 目录中。
3. 当程序启动时检测到 `static/index.html` 已经存在，便会**直接跳过联网下载**，实现 100% 纯物理离线极速运行！

---



## 状态

![Repobeats analytics](https://repobeats.axiom.co/api/embed/5c772eb2070995571e015079682c17dd72a74e2f.svg "Repobeats analytics image")
