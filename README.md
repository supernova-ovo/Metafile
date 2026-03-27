# MetaFile 🌟

MetaFile 是一个基于 React + TypeScript + Vite 构建的现代化文件属性管理系统原型。它采用了类似 Linear 或 Notion 的专业 SaaS 风格设计，提供了流畅的用户体验和高效的维度/标签管理能力。

## ✨ 核心特性

- **🎨 专业级 UI/UX 设计**：双面板布局，提供充足的视觉呼吸感，搭配平滑的微交互动画。
- **🏷️ 强大的属性管理**：支持自定义维度（如：项目、部门、状态）及标签的管理（新增、重命名、合并、删除）。
- **💾 本地数据持久化**：所有文件元数据、标签维度排序等状态均通过 `LocalStorage` 自动同步保存。
- **📊 实时统计**：直观展示各个标签下关联的文件数量及统计信息。
- **⚡ 极速构建**：基于 Vite 驱动，使用 React 19 和 Tailwind CSS 4 提供现代化的前端开发体验。

## 🛠️ 技术栈

- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/) (图标)

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 📂 项目结构

- `src/components/` - 包含 Explorer（文件浏览）、Inspector（检查器）、Management（属性管理面板）、Sidebar 等核心 UI 组件。
- `src/lib/` - 数据类型定义（types）与工具函数。

---
*本项目作为一个前端原型，展示了现代 Web 应用中复杂状态交互与极简设计的结合。*
