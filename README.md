# MetaFile 🌟

`MetaFile` 是一个基于 **React 19 + TypeScript + Vite + Tailwind CSS 4** 构建的现代化文件属性与多维度标签管理系统。项目界面设计汲取了 Linear、Notion 等主流 SaaS 系统的专业极简风格，兼具丰富的色彩搭配、流畅的交互动画及响应式布局，提供一流的用户体验（UI/UX）。

---

## 🎨 核心特性

- **✨ 现代化 UI/UX 与微交互**：
  - 双面板/三面板布局，保留充足的呼吸感。
  - 支持**侧边栏（Sidebar）**、**文件浏览器（Explorer）**和**属性检查器（Inspector）**。
  - 顺畅的拖拽（Drag & Drop）文件上传与状态过渡动画。
- **🏷️ 多维度标签管理系统（Dimensions & Tags）**：
  - 支持自定义文件维度（如：项目、部门、密级、年份、状态等）。
  - 支持标签的实时重命名、颜色映射、新建、合并与物理删除，并且属性可在面板间双向同步。
- **📂 虚拟文件系统树（Virtual Directory Tree）**：
  - 根据用户自定义的**维度层级顺序（Dimension Order）**动态重组文件结构。
  - 自动将扁平的文件列表聚合为层级分明的虚拟文件夹，支持深层嵌套导航。
- **⚡ 后台异步任务队列（Job Queue）**：
  - 基于 Zustand 驱动的后台异步并发上传队列。
  - 支持进度条展示、重试机制、错误捕获与上传状态悬浮窗（JobQueueOverlay）。
- **💾 本地持久化与多数据库适配**：
  - **前端离线存储**：采用 `sql.js` (WebAssembly SQLite) 进行浏览器端的数据存取，支持快速重置（Reset）。
  - **服务端同步**：自动通过 `apiClient` 同步数据至 **Jetop CMS** 业务后端，保证本地与远端数据的高度一致性。
  - **Schema 兼容**：附带完整的 SQLite（本地）及 SQL Server（生产）迁移脚本。

---

## 🛠️ 技术栈

- **核心框架**：[React 19](https://react.dev/) + [TypeScript 5.9](https://www.typescriptlang.org/)
- **构建工具**：[Vite 8](https://vitejs.dev/)
- **样式方案**：[Tailwind CSS 4](https://tailwindcss.com/) (极简、现代化的 CSS 框架)
- **状态管理**：[Zustand 5](https://github.com/pmndrs/zustand)
- **数据库**：[sql.js 1.14](https://sql.js.org/) (SQLite WASM)
- **图标库**：[Lucide React](https://lucide.dev/)

---

## 📂 项目结构

```bash
Metafile/
├── database/                   # 数据库模式与初始化脚本
│   ├── init.js                 # SQLite 数据库初始化脚本
│   ├── metafile.db             # SQLite 二进制数据库文件 (本地忽略)
│   ├── schema.sql              # SQLite 数据库建表及种子数据 Schema
│   └── schema.sqlserver.sql    # 生产 SQL Server 数据库 Schema 迁移参考
├── src/
│   ├── components/             # UI 组件库
│   │   ├── core/               # 核心底层组件 (ErrorBoundary, JobQueue, Preview)
│   │   ├── Sidebar.tsx         # 维度排序、重置等功能侧边栏
│   │   ├── Explorer.tsx        # 文件列表浏览、搜索、筛选面板
│   │   ├── Inspector.tsx       # 文件属性检查器与多维度标签编辑面板
│   │   ├── Management.tsx      # 维度及标签全生命周期管理面板
│   │   ├── UploadModal.tsx     # 文件拖拽上传/批量属性编辑弹窗
│   │   └── DeleteFileModal.tsx # 文件确认删除弹窗
│   ├── services/               # 业务服务层 (API 通讯与本地数据库对接)
│   │   ├── core/
│   │   │   └── apiClient.ts    # 基于 fetch 的自定义 API 封装 (含加密/FormData/Token)
│   │   ├── apiService.ts       # 维度、关联关系 API
│   │   ├── fileService.ts      # 文件 CRUD 及本地/远程数据同步逻辑
│   │   ├── preferenceService.ts# 用户偏好 (维度顺序、当前路径) 初始化与保存
│   │   └── jobQueue.ts         # 上传任务并发控制队列
│   ├── store/                  # Zustand 状态管理
│   │   ├── useFileStore.ts     # 文件元数据状态
│   │   ├── useJobStore.ts      # 后台任务状态
│   │   └── selectors.ts        # 状态树衍生选择器 (例如虚拟树构建)
│   ├── types/                  # TypeScript 类型定义
│   ├── lib/                    # 静态模拟数据及辅助工具
│   ├── App.tsx                 # 单页入口与全局交互总控
│   └── main.tsx                # React 挂载入口
├── .env.example                # 环境变量配置模板 (敏感凭证请在此配置)
├── vite.config.ts              # Vite 配置文件
└── tsconfig.json               # TypeScript 配置文件
```

---

## 🚀 快速开始

### 1. 准备环境配置文件

为了保证敏感身份凭证的安全，项目中的 `.env` 文件已加入 Git 忽略列表。请在本地复制 `.env.example` 并重命名为 `.env`：

```bash
cp .env.example .env
```

打开 `.env` 文件，根据说明填写您的 API 服务地址以及从浏览器请求头中复制的 **X-JetopDebug-User** 身份验证令牌（`VITE_AUTH_TOKEN`）。

### 2. 安装依赖

推荐使用 `npm` 进行依赖安装：

```bash
npm install
```

### 3. 初始化本地 SQLite 数据库

在首次启动项目前，需要通过 Node.js 脚本创建并初始化本地 SQLite 数据库文件：

```bash
npm run db:init
```

*如果后续需要清空并重置数据库，可以运行：*
```bash
npm run db:reset
```

### 4. 启动开发服务器

```bash
npm run dev
```
项目将在本地启动开发服务器，您可以在浏览器中打开终端输出的地址（默认为 `http://localhost:5173`）进行体验。

### 5. 编译与打包

```bash
npm run build
```
编译完成后，静态文件将输出至 `dist` 目录中。

---

## 🛡️ 安全与提议建议

- **请勿提交您的 `.env` 文件**：该文件包含开发调试用的后端 Token。
- **数据库同步**：在离线状态下，所有属性修改与上传操作将暂存在本地 SQLite 数据库中，连网并配置有效 Token 后将自动同步至 `test1.tepc.cn` 后端接口。
