# FF14 Oopsie - 用户数据兼容与版本发布手册

由于本项目是一个强依赖前端本地存储（`localStorage`）的单页应用，且已公开发布，用户的团队数据、副本模板和犯错记录都保存在他们的浏览器中。
**任何对 `store.ts` 数据结构的破坏性更改（如删除字段、修改嵌套类型）都可能导致老用户的页面白屏或数据丢失！**

在每次进行包含数据结构改动的新版本发布前，必须严格遵守以下 SOP（标准作业程序）。

---

## 1. 核心数据兼容原则

### 1.1 只增不减，只软不硬
- **新增字段**：可以直接在接口中添加，但必须是**可选的（`?`）**，或者在组件渲染时提供默认值后备（`foo.bar || '默认值'`）。
- **删除字段**：**绝对不要**直接删除旧字段。即使该字段不再使用，也应在类型定义中保留并标记为 `/** @deprecated */`，防止旧数据反序列化时出现未知的结构冲突。
- **重命名字段**：不能直接重命名。必须保留旧字段，新增新字段，并在读取时做兼容处理：`const name = newData.newName || oldData.oldName`。

### 1.2 Zustand 默认合并机制
我们使用的 `zustand/middleware/persist` 默认会进行浅层合并（Shallow Merge）。
这意味着当你向初始状态（Initial State）添加新的顶级属性时，它会自动与用户的旧存储合并。**但是，嵌套对象或数组内的结构改变，不会自动补全！**

例如：
```typescript
// 用户的旧数据中 Team 只有 id 和 name
// 如果你在代码里期望 Team 必须有 errorLevels 数组
// 渲染时使用 team.errorLevels[0] 就会导致 Cannot read properties of undefined 报错导致白屏！

// ❌ 错误写法
const topLevel = team.errorLevels[0];

// ✅ 兼容写法 (提供后备初始值)
const errorLevels = team.errorLevels || ['团灭', '机制错'];
const topLevel = errorLevels[0];
```

---

## 2. Zustand 迁移函数 (Migrate Function)

当遇到**非改不可的结构性变化**（例如数据结构彻底重构）时，必须启用 Zustand 的版本控制和迁移机制。

在 `store.ts` 的 `persist` 配置中，你可以这样写：

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ... state and actions
    }),
    {
      name: 'ff14-oopsie-storage',
      version: 1, // 👈 每次有破坏性改动时，将 version + 1
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // 将 V0 的数据格式转换为 V1
          persistedState.teams = persistedState.teams.map((team: any) => ({
            ...team,
            celebrationAllowance: team.celebrationAllowance ?? 1, // 补齐必填缺漏字段
          }));
        }
        // 如果有多个版本，可以使用 switch 穿透或连续 if
        return persistedState;
      },
    }
  )
);
```

---

## 3. 发版前必做清单 (Pre-Release Checklist)

每次在运行 `npm run build` 和 `wrangler pages deploy` 前，请务必执行以下测试：

### [ ] 步骤 1：获取线上生产数据
1. 打开部署在 Cloudflare 上的线上生产地址（例如 `https://ff14-oopsie.pages.dev`）。
2. 在线上环境进行一些常规操作（新建队伍、打几个勾、修改几条设置）。
3. 前往“系统设置”，点击**导出数据备份**，下载一份 `.json` 文件。

### [ ] 步骤 2：在本地开发环境“污染测试”
1. 启动本地开发服务：`npm run dev`。
2. 前往本地的“系统设置”，点击**导入数据**，选择刚才从线上下载的 `.json` 文件。
3. **验证以下场景是否崩溃（白屏）**：
   - 切换到不同的队伍。
   - 打开 Tracker 面板，拖拽一下机制，添加一条新记录。
   - 查看图表是否正常渲染。
4. 如果一切正常，说明你的新代码对老数据完美兼容。

### [ ] 步骤 3：模拟新老用户边界
- **老用户升级**：按 `F12` 打开控制台 -> `Application` -> `Local Storage`。确认线上拉下来的旧存储在刷新后能正常运行新代码。
- **全新用户**：在控制台执行 `localStorage.clear()`，然后刷新页面，确认没有任何数据的新用户也能正常初始化并使用应用。

---

## 4. 极端情况预案（逃生舱）

如果真的发生了不可逆的灾难性更新，导致部分老用户的页面一打开就立刻 React 报错并白屏，他们将连“系统设置”里的“清空数据”按钮都点不到。

**开发建议**：
在 `main.tsx` 或根组件外层包裹一个 `ErrorBoundary`（错误边界）。
当应用捕获到致命的渲染错误时，不要显示全白屏幕，而是渲染一个紧急按钮：
> “应用遇到严重的本地数据冲突。请尝试 [导出当前损坏数据备份] ，然后 [强制重置本地缓存并重启]。”

（注：目前项目暂未实装 ErrorBoundary，如后续迭代有大型重构，建议优先实装此功能。）
