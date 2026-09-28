# 本轮 Chromium 方法与权限

实际使用 Node v24.19.0、Playwright（运行环境预装）、Chromium 133.0.6943.0，本地 Python 服务127.0.0.1:8765。`run-browser.py`在同一次已获准执行上下文启动服务和浏览器，`browser005.cjs`操作实际DOM、发出实际命令、检查结果、抓取桌面/390px截图及pageerror。

工作区维护清除了旧二进制。通过npm重新取得 @sparticuz/chromium 133.0.0；包内解压器因chown EINVAL失败，改为将同包Brotli资源普通解压到自有目录、不修改所有权。未绕过网络/文件权限。字体 @fontsource/noto-sans-sc 5.3.0 的400字重资源与许可随包，解决此运行环境缺中文的问题。

启动参数沿用headless、--no-sandbox、--disable-dev-shm-usage、--disable-gpu、--no-zygote。`--no-sandbox`仅是当前本地浏览器子进程配置，不授予其他聊天或受限服务访问权限。浏览器二进制不打包；新环境须自身具备获准的Node/Python子进程、Chromium、Playwright和可达loopback。

这证明本地Chromium原型的实际渲染与操作，不包括Safari/iPad、华为、线上版本、多人授权或美术预览。没有替其他Worker绕过限制，也未访问其预览。
