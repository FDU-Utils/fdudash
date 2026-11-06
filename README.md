# fdudash

HTML + 本机 Node.js 的复旦个人 dashboard 原型。Tauri 后置。当前实现 UIS 密码认证、本地加密记住账号、按周本科生课表、eLearning 只读课程与作业列表和明确标识的演示模式；UIS 与 eLearning 已完成本机真实账号验证。

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

## 每周课表与 eLearning

- 课表提供上一周、下一周、本周、周选择与周一至周日日期范围。只渲染所选教学周，合并同周重复课程；同周真实冲突按整组安排并排，不遮挡。日期按北京时间计算。
- 登录 UIS 后点击“连接并读取课程”，本机复用会话；若需要独立票据，使用已保存的本机账号建立 eLearning 会话一次。只读取活动课程与作业列表，不提交作业或修改课程；按 Canvas 分页读取完整列表。
- eLearning 实际访问已验证；自动测试使用虚构课程，个人课程、凭据、会话均不写入仓库。

## 作业列表与多教室安排

- 同一教学班、同一天、同一节次的多教室记录合并成一张课表卡，保留所有教室；不同教学班不合并。
- 点击侧栏 eLearning 作业，或直接打开 /#elearning，登录恢复后自动读取各课程与作业。手动刷新可重新查询；切换侧栏不会重复请求已加载的数据。
- 作业按课程分组，未完成展开，已完成默认折叠。已提交、已批改或豁免归入已完成；缺交、零分缺交和要求重新提交仍在未完成中。无需在线提交的安排单独折叠，未知状态明确标注。截止时间按北京时间显示，逾期不等于完成。
- 自动读取 Canvas 分页；某门课程无权限或读取失败时单独显示错误，不将其误报成无作业。只读，不提交、修改或标记任何作业。
- API 参考：https://developerdocs.instructure.com/services/canvas/resources/assignments 与 https://developerdocs.instructure.com/services/canvas/resources/submissions 。
