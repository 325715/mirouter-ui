![mrui-logo](./otherfile/images/logo.png)

## Mirouter-ui

> 😎 基于小米路由器API的展示面板

[![Docker Pulls](https://img.shields.io/docker/pulls/thun888/mirouter-ui)](https://hub.docker.com/r/thun888/mirouter-ui)
[![HitCount](https://hits.dwyl.com/Mirouterui/mirouter-ui.svg?style=flat)](http://hits.dwyl.com/Mirouterui/mirouter-ui)
[![Release And Docker](https://github.com/Mirouterui/mirouter-ui/actions/workflows/buildapp.yml/badge.svg)](https://github.com/Mirouterui/mirouter-ui/actions/workflows/buildapp.yml)
[![Build DEV version](https://github.com/Mirouterui/mirouter-ui/actions/workflows/buildapp-dev.yml/badge.svg)](https://github.com/Mirouterui/mirouter-ui/actions/workflows/buildapp-dev.yml)



## 部署与运行 (100% 纯离线嵌入版)

由于该版本已经实现了**前端静态资源嵌入（`go:embed`）**与**外部依赖本地化（`vendor`）**的全面改造，您无需外部网络即可实现一键编译与离线 Docker 部署。

### 1. 准备配置文件

1. 在项目根目录下新建一个 `data` 文件夹用于存放配置和历史数据库文件。
2. 将 `config.example.yaml` 复制到该目录下并重命名为 `config.yaml`：
   * **Linux/macOS (Bash)**: `mkdir -p data && cp config.example.yaml data/config.yaml`
   * **Windows (PowerShell)**: `mkdir data; copy config.example.yaml data/config.yaml`
3. 编辑 `data/config.yaml`，填入您的小米路由器 **管理密码** (`password`) 与 **IP 地址** (`ip`)。

### 2. Docker 部署（推荐 🐳）

在项目根目录下直接执行以下一单行命令即可完成离线构建与一键部署：

* **第一步：构建本地专属离线镜像**
  ```bash
  docker build --build-arg VERSION=1.0.0 -t mirouter_ui_local .
  ```
* **第二步：一键运行容器（使用 $(pwd) 动态挂载本地 data 目录）**
  ```bash
  docker run -d -p 6789:6789 -v $(pwd)/data:/app/data --restart always --name mirouter-ui-local mirouter_ui_local
  ```

访问 `http://localhost:6789` 即可直接打开由本地二进制程序加载渲染的精美监控面板！

---



## 状态

![Repobeats analytics](https://repobeats.axiom.co/api/embed/5c772eb2070995571e015079682c17dd72a74e2f.svg "Repobeats analytics image")
