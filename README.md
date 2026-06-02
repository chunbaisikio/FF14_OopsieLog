# FF14 Oopsie Log

面向固定队复盘的多人协作版 FF14 犯错记录工具。

这版项目已经不是原始的单机 `localStorage` 小工具，而是一个可本地部署、可多人共用的版本，核心特性是：

- 管理员总控台
- 队长独立工作空间
- 成员口令登录
- 队伍进度横向对比
- 本地 SQLite 持久化

## 功能概览

当前版本采用三层角色模型：

- `admin`
  - 不参与具体队伍记录
  - 负责生成 `captain` 邀请码
  - 查看所有 captain 工作空间
  - 查看跨工作空间的进度总览
- `captain`
  - 兑换队长邀请码后，自动获得自己的独立工作空间
  - 在自己的空间内管理副本、队伍、成员和记录
  - 可以邀请 `member`
- `member`
  - 加入某个 captain 的工作空间
  - 使用自己的口令登录
  - 可以在当前工作空间内协作使用

## 架构说明

前端：

- React
- Vite
- TypeScript
- Zustand
- React Router
- Recharts
- Tailwind CSS

后端：

- Express
- SQLite

存储方式：

- 业务数据保存在 `server/data.db`
- 前端状态通过 `/api/store` 同步到当前工作空间
- 每个 captain 工作空间的数据彼此隔离

## 工作空间模型

这版最重要的变化是“管理员空间”和“队长空间”完全分开：

- 管理员登录后进入总控台
- 队长登录后进入自己的独立工作空间
- 成员只能加入某个队长的工作空间
- 管理员通过聚合所有 captain 工作空间的数据，生成全局进度总览

邀请码分两种：

- `captain` 邀请码
  - 只能由管理员生成
  - 一次性使用
  - 兑换后自动创建新的 captain 工作空间
- `member` 邀请码 / 工作区码
  - 在 captain 工作空间内使用
  - `member` 邀请码为一次性
  - 工作区通用邀请码可重复用于成员加入

## 本地开发

安装依赖：

```bash
npm install
```

启动前端开发服务：

```bash
npm run dev
```

启动后端服务：

```bash
npm run server
```

说明：

- 前端开发默认走 Vite
- `vite.config.ts` 已将 `/api` 代理到 `http://localhost:3001`
- 如果你只打开纯静态页面，没有启动后端，会看到“接口返回 HTML 而不是 JSON”的提示

## 本地生产运行

如果你只是想本地完整体验一遍，用这条命令最省事：

```bash
npm start
```

它会先构建前端，再启动 Node 服务。

默认地址：

- [http://127.0.0.1:3001](http://127.0.0.1:3001)

可选环境变量：

```bash
PORT=3101 npm start
DB_PATH=/absolute/path/data.db npm start
HOST=0.0.0.0 npm start
```

## 首次使用流程

### 1. 初始化管理员

第一次启动时，进入页面会看到 `初始化管理员`。

需要填写：

- 工作空间名称
- 管理员显示名
- 管理员口令

初始化完成后，管理员进入总控台。

### 2. 管理员邀请队长

管理员登录后：

- 打开 `队长管理`
- 点击 `生成队长邀请码`
- 将邀请码发给目标队长

### 3. 队长加入并创建工作空间

队长使用 `邀请码入场`：

- 输入队长邀请码
- 填写显示名
- 设置自己的登录口令

提交后，系统会：

- 创建 captain 用户
- 自动创建该 captain 的独立工作空间
- 自动将该 captain 绑定到自己的工作空间

### 4. 队长邀请成员

队长进入自己的空间后：

- 在设置页生成成员邀请码
- 或直接把工作区通用邀请码发给成员

### 5. 成员加入

成员通过 `邀请码入场`：

- 输入一次性成员邀请码，或 captain 空间的工作区通用邀请码
- 填写显示名
- 设置个人口令

完成后即可进入该 captain 的工作空间。

## 页面说明

### 管理员侧

- `队长管理`
  - 生成队长邀请码
  - 查看 captain 工作空间
  - 查看队长口令、工作区码、成员数量
- `进度总览`
  - 按副本查看不同 captain 工作空间下多支队伍的进度对比

### Captain / Member 侧

- `犯错记录`
  - 记录当前副本、阶段、机制下的犯错
- `队伍管理`
  - 管理队伍、成员、基础统计
- `副本管理`
  - 配置副本、阶段、机制、错因
- `记录明细`
  - 查看、导出、编辑历史记录
- `系统设置`
  - 查看当前空间成员
  - 生成成员邀请码
  - 查看工作区通用邀请码
  - 备份 / 导入 / 遥测设置

## 测试

项目内已经补了针对当前多人架构的流程测试。

运行全部流程测试：

```bash
npm run test:workflow
```

拆分运行：

```bash
npm run test:workflow:api
npm run test:workflow:ui
```

说明：

- `test:workflow:api`
  - 会启动临时本地服务
  - 验证 `admin -> captain -> member` 的完整链路
- `test:workflow:ui`
  - 验证管理员导航、进度页权限、错误提示等 UI 关键路径

## 构建

```bash
npm run build
```

构建产物输出到：

- `dist/`

## 数据与持久化

默认数据库位置：

- `server/data.db`

主要表：

- `users`
- `workspaces`
- `workspace_memberships`
- `workspace_invites`
- `captain_invites`
- `workspace_store`

说明：

- `admin` 工作空间只作为总控概念存在
- 真正的业务数据主要沉淀在 captain 工作空间里
- 管理员全局进度页通过聚合 captain 工作空间的 store 数据生成

## 常见问题

### 1. 页面报 `Unexpected token '<'`

通常是因为前端请求到了 HTML 页面而不是 `/api` JSON。

排查方式：

- 确认后端服务已启动
- 优先使用 `npm start`
- 开发模式下同时启动：
  - `npm run server`
  - `npm run dev`

### 2. 为什么管理员看不到普通业务页

这是当前版本的设计：

- 管理员是总控角色
- captain / member 才在业务空间里做实际记录

### 3. 为什么 captain 邀请码和 member 邀请码不同

因为两者职责不同：

- `captain` 邀请码会创建新的独立工作空间
- `member` 邀请码只是在已有 captain 空间内加人

## 仓库建议

如果你后续继续演进，我建议优先做这几件事：

- 把管理员总控页继续拆细
- 为 captain 空间增加更清晰的空间首页
- 为关键接口补更多后端测试
- 引入正式鉴权层，而不只是口令登录
- 为部署补 Docker Compose

## License

沿用仓库内现有 [LICENSE](./LICENSE)。
