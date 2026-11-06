# fdudash

HTML + 本机 Node.js 的复旦个人 dashboard 原型。Tauri 后置。当前仅实现 UIS 密码认证流程、学期读取、本科生课表查询与明确标识的演示模式；真实账号尚待本机联调。

## 启动（全部在 WSL）

```sh
cd /mnt/d/projects/FDU-Utils/fdudash
npm ci
npm test
# 可选：首次浏览器验证
npx playwright install chromium
npm run test:ui
npm start
```

浏览器打开 http://127.0.0.1:5173 。使用其他端口时设置 PORT。服务只绑定本机回环地址，拒绝其他 Host 和跨站请求。不要直接反向代理到公网。

## 当前边界

- 勾选记住账号后，密码使用 Windows DPAPI CurrentUser 加密，保存在 WSL 用户目录 ~/.local/share/fdudash/credentials，文件权限 0600。密文与仓库分离，不使用 localStorage。下次打开页面自动解锁并登录一次，失败不自动重试；Windows 账号变化后不能解锁。取消记住账号仅使用当次凭据。Cookie 只保留在 Node 进程内存，退出登录、重启服务或 30 分钟闲置后清除；退出并忘记账号还会删除已保存密文。本机浏览器与服务进程中的敏感信息仍需要设备本身可信；清空变量不等于保证运行时内存立即擦除。
- 每个浏览器配置独立 CookieJar 与随机凭据文件标识（HttpOnly 持久 Cookie 保存标识）；发往校园系统的 URL 有固定白名单；密码认证失败不自动重试。
- 验证码、双因素认证、旧版 UIS 和研究生课表尚未支持。出现交互认证要求会停止并显示原因。
- 手机浏览器独立连接 UIS 仍受跨域约束。本版不开放局域网访问；手机访问及其本地认证路径后续设计。
- 学期和课程数据结构按 DanXi 当前实现适配；周日起始的教学周映射为周一起始。只查询，不修改校园信息。
- 真实数据仅内存展示，退出清空；没有离线课表缓存。
- 本地保存功能当前针对 WSL + Windows DPAPI，其他系统不可用时不会回退明文存储。清除浏览器 Cookie 会使保存账号的标识丢失，需要重新登录；可手动删除上述凭据目录以清理遗留密文。
- 周课表按截图的 1–14 节（08:00–22:00）布局，课程卡显示名称、教室、起止时间和教师，跨节次课程跨行显示。

## 参考与许可

认证协议、接口和课表字段参考 DanXi-Dev/DanXi commit 3c1f5f026fbc7ca50e151865f813cdb381807abe：lib/repository/fdu/neo_login_tool.dart、time_table_repository.dart、lib/model/time_table.dart。本项目采用 GPL-3.0-or-later，保留 DanXi 参考归属；参考源码位于忽略的 work/DanXi，不纳入项目发布。

长期范围见 docs/project-goals.md。
