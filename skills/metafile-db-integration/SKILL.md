---
name: metafile-db-integration
description: 将 MetaFile 前端项目（React + LocalStorage）与 SQL Server 数据库打通，通过 jetop-service 实现数据持久化。包含完整的数据映射、API 封装、CRUD 实现步骤。
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
metadata:
  trigger: 需要将 MetaFile 前端与 SQL Server 后端打通、替换 LocalStorage 为数据库存储、实现数据持久化
---

# MetaFile 数据库集成指南

## 1. 项目概览

### 前端现状
- 纯 React 19 + TypeScript SPA（Vite 构建）
- 所有数据存 `localStorage`
- 三个 Service 文件：`storageService.ts` / `fileService.ts` / `preferenceService.ts`
- 数据模型：`FileItem`（含 `attributes: Record<string, string[]>`）

### 数据库现状
- SQL Server，库名 `LCSF_XXHGL`
- 已建 5 张表：`D_WJGL_WJ` / `D_WJGL_WH` / `D_WJGL_BQ` / `D_WJGL_WJBQ` / `D_WJGL_YHPH`
- 使用 `jetop-service` 包通过 HTTP POST + FormData 操作数据（区块 ID 模式）
- `.env` 已配置 `VITE_API_BASE_URL` 和 `VITE_AUTH_TOKEN`
- 区块 ID：`76c22773-66cb-a51c-359b-5a2872169266`（对应 `D_WJGL_WJ` 表）

---

## 2. 数据映射

### 2.1 FileItem ↔ D_WJGL_WJ

```typescript
// 前端 FileItem
interface FileItem {
  id: string;
  name: string;
  type: string;        // pdf/docx/xlsx/pptx...
  size: number;        // bytes
  updatedAt: string;   // ISO date
  attributes: Record<string, string[]>;  // { "部门": ["开发部","工程部"], "密级": ["机密"] }
}
```

| FileItem 字段 | 同步方式 | D_WJGL_WJ 字段 |
|---|---|---|
| `name` | 直接同步 | `WJMC` |
| `type` | 直接同步 | `WJLX` |
| `size` | 直接同步 | `WJDX` |
| `updatedAt` | 直接同步 | `GXRQ` |
| `attributes` | 拆解为多表关联 | 见 2.2 |

### 2.2 attributes（核心多对多）↔ 三表关联

```
Record<string, string[]>      D_WJGL_WH + D_WJGL_BQ + D_WJGL_WJBQ
────────────────────────────────────────────────────────────────
{                               D_WJGL_WH:  1 行 ("部门")
  "部门": ["开发部","工程部"],   D_WJGL_BQ:  2 行 ("开发部","工程部")
  "密级": ["机密"]              D_WJGL_WJBQ: 3 行 (文件→标签关联)
}                               
```

具体对应关系：

| FileItem.attributes | 数据库表 | 说明 |
|---|---|---|
| 键名（如 `"部门"`） | `D_WJGL_WH.WHMC` | 维度名称，唯一约束 |
| 键值数组元素（如 `"开发部"`） | `D_WJGL_BQ.BQZ` | 标签值，同维度下唯一 |
| 文件→标签的归属关系 | `D_WJGL_WJBQ` | 三字段：`WJID` → `BQID` + 冗余 `WHID` |

### 2.3 用户偏好 ↔ D_WJGL_YHPH

```typescript
interface AppPreferences {
  dimensionOrder: string[];  // 维度排序，如 ["项目","部门","密级"]
  currentPath: string[];     // 当前浏览路径
  selectedFileId: string | null;
}
```

| AppPreferences | D_WJGL_YHPH 字段 | 说明 |
|---|---|---|
| `dimensionOrder` | `WHPX` | 存 JSON 字符串，如 `["项目","部门","密级"]` |
| `currentPath` | `DQDL` | 存 JSON 字符串 |
| `selectedFileId` | `XZWJID` | 唯一标识符 |

### 2.4 可用维度列表 ↔ D_WJGL_WH

前端代码中的 `availableDimensions` 硬编码数组（`['项目','档案类别','档案分类','状态','年份','文件类型','密级','部门']`），应改为从 `D_WJGL_WH` 表查询，以支持动态维度管理。

---

## 3. 集成策略

### 3.1 架构方案

采用**渐进替换**策略：创建 `apiService.ts` 作为数据访问层，先并行运行（localStorage + API），验证通过后再切换。

```
文件结构变更：
src/
├── services/
│   ├── storageService.ts      ← 保留（localStorage 兜底/缓存）
│   ├── fileService.ts         ← 重构（增加 API 调用）
│   ├── preferenceService.ts   ← 重构（增加 API 调用）
│   └── apiService.ts          ← 新建（jetop-service 封装）
```

### 3.2 区块 ID 映射

| 表 | 区块 ID |
|---|---|
| `D_WJGL_WJ` | `76c22773-66cb-a51c-359b-5a2872169266` |
| `D_WJGL_WH` | 需要从系统查询 |
| `D_WJGL_BQ` | 需要从系统查询 |
| `D_WJGL_WJBQ` | 需要从系统查询 |
| `D_WJGL_YHPH` | 需要从系统查询 |

使用 `get_schema.js` 脚本获取各区块 ID：

```bash
node "<skill_path>/scripts/get_schema.js" "<section-id>" --output table
```

---

## 4. 实现步骤

### Step 1: 创建 apiService.ts

**文件位置**: `src/services/apiService.ts`

封装 `jetop-service` 的四个核心方法：

- `async queryFiles(where?, page?, pageSize?)` → 查询 `D_WJGL_WJ`
- `async insertFiles(files: FileItem[])` → 插入到 `D_WJGL_WJ`
- `async updateFile(file: Partial<FileItem>)` → 更新 `D_WJGL_WJ`
- `async deleteFiles(ids: string[])` → 软删除 `D_WJGL_WJ`

关键实现细节：
- 使用 `jetop-service` 的 `query` / `insert` / `update` / `remove` 方法
- 所有请求通过 `sectionHandler.ashx` 端点
- 鉴权通过 `X-JetopDebug-User` header
- 请求体为 FormData 格式，Base64 编码

代码示例：

```typescript
import { query, insert, update, remove, generateUUID } from 'jetop-service';

const SECTION_FILES = '76c22773-66cb-a51c-359b-5a2872169266';

// 查询文件
export async function queryFiles(where = {}, page = 1, pageSize = 50) {
  const result = await query(SECTION_FILES, {
    where,
    pageIndex: page,
    pageSize
  });
  return result;
}

// 插入文件（自动同步 attributes 到三表）
export async function insertFile(file: FileItem) {
  // 1. 插入 D_WJGL_WJ 主表
  const fileResult = await insert(SECTION_FILES, {
    inserted: [{
      sys_id: file.id,
      WJMC: file.name,
      WJLX: file.type,
      WJDX: file.size,
      GXRQ: file.updatedAt,
    }]
  });

  // 2. 同步 attributes → D_WJGL_WH / D_WJGL_BQ / D_WJGL_WJBQ
  await syncAttributes(file.id, file.attributes);

  return fileResult;
}
```

### Step 2: 实现属性同步（核心逻辑）

`attributes` 的同步是整个集成的关键，需要原子化处理：

```typescript
// 单独的函数：同步文件属性到数据库
async function syncAttributes(fileId: string, attributes: Record<string, string[]>) {
  for (const [dimName, tagValues] of Object.entries(attributes)) {
    // 1. 确保维度存在（upsert D_WJGL_WH）
    const dimId = await ensureDimension(dimName);

    for (const tagValue of tagValues) {
      // 2. 确保标签存在（upsert D_WJGL_BQ）
      const tagId = await ensureTag(dimId, tagValue);

      // 3. 建立文件-标签关联（upsert D_WJGL_WJBQ）
      await ensureFileTag(fileId, tagId, dimId);
    }
  }
}
```

**注意**：`D_WJGL_WH.WHMC` 有唯一约束，`D_WJGL_BQ` 的 `(WHID, BQZ)` 也有唯一约束，插入前需先查询是否存在。

### Step 3: 重构 fileService.ts

将原有的 LocalStorage-only 逻辑改为**双写模式**：

```typescript
export const fileService = {
  // 初始化：优先从 API 加载，失败时降级到 localStorage
  async init() {
    try {
      const apiFiles = await apiService.queryFiles();
      return normalizeFiles(apiFiles.ROWS);
    } catch {
      return this.getFilesLocal(); // 降级
    }
  },

  // 上传文件：本地 + 远程
  async uploadFile(file: FileItem) {
    await apiService.insertFile(file);
    // 同步到本地 state
  },

  // 更新属性：本地 + 远程
  async updateAttributes(fileId, newAttrs) {
    await apiService.syncAttributes(fileId, newAttrs);
    // 同步到本地 state
  },
};
```

### Step 4: 重构 preferenceService.ts

用户偏好（维度排序/路径/选中文件）写入 `D_WJGL_YHPH`：

```typescript
const YHPH_ID = 'current-user'; // 固定用户 ID（未来扩展多用户）

export const preferenceService = {
  async saveDimensionOrder(order: string[]) {
    await apiService.upsertPreference(YHPH_ID, { WHPX: JSON.stringify(order) });
    storageService.setJson(storageKeys.dimensions, order); // 本地备份
  },
};
```

### Step 5: 改造 App.tsx 数据流

```typescript
function App() {
  const [files, setFiles] = useState<FileItem[]>([]);

  // 初始化：从 API 加载
  useEffect(() => {
    fileService.init().then(setFiles);
  }, []);

  // 不再需要 localStorage sync（由 service 层内部处理）
  // 删除原有 useEffect(() => { fileService.saveFiles(files) }, [files])
}
```

### Step 6: 实现动态维度

将 `availableDimensions` 从硬编码改为 API 查询：

```typescript
// 新增：从 D_WJGL_WH 表获取所有维度
export async function fetchDimensions() {
  const result = await query(WH_SECTION_ID, { pageSize: 100 });
  return result.ROWS.map(row => row.WHMC);
}
```

---

## 5. 错误处理策略

| 场景 | 策略 |
|---|---|
| API 调用失败（网络/超时） | 降级到 localStorage，不阻塞用户操作 |
| Token 过期 | 提示用户重新获取 Token |
| 数据冲突 | 以 API 返回为准，覆盖本地 |
| 批量操作 | 使用 `batchUpdate` 保证事务性 |

```typescript
async function withFallback<T>(apiCall: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    console.warn('[DB] API 调用失败，降级到本地:', error);
    return fallback();
  }
}
```

---

## 6. 迁移清单

### 6.1 需要新建的文件
- [ ] `src/services/apiService.ts` — jetop-service 封装
- [ ] `src/types/api.ts` — API 请求/响应类型（需要扩展，新增区块 ID 常量）

### 6.2 需要修改的文件
- [ ] `src/services/fileService.ts` — 增加 API 调用（双写模式）
- [ ] `src/services/preferenceService.ts` — 增加 API 调用
- [ ] `src/App.tsx` — 初始化逻辑改为从 API 加载
- [ ] `src/components/Explorer.tsx` — 分页加载数据（大数据量场景）
- [ ] `src/components/Inspector.tsx` — 标签修改后同步 API
- [ ] `src/components/UploadModal.tsx` — 上传确认后调用 API
- [ ] `src/lib/mock-data.ts` — 移除或降级为备用数据
- [ ] `.gitignore` — 确保 `.env` 不被提交

### 6.3 需要查询的区块 ID
- [ ] `D_WJGL_WH` 的区块 ID（维度管理）
- [ ] `D_WJGL_BQ` 的区块 ID（标签管理）
- [ ] `D_WJGL_WJBQ` 的区块 ID（文件标签关联）
- [ ] `D_WJGL_YHPH` 的区块 ID（用户偏好）

### 6.4 验证清单
- [ ] `npm run build` 编译通过
- [ ] 上传文件 → 数据库新增记录
- [ ] 修改文件属性 → 数据库相应更新
- [ ] 搜索/过滤 → 结果正确
- [ ] 维度排序 → 保存后刷新不丢失
- [ ] 网络断开 → 不崩溃，有降级提示

---

## 7. 回滚方案

如果集成出现问题，可以快速回退到纯 LocalStorage 模式：

1. 在 `.env` 中配置 `VITE_DB_ENABLED=false`
2. `apiService.ts` 根据此开关判断是否执行 API 调用
3. 默认 `true`，异常时自动降级

```typescript
const isDbEnabled = import.meta.env.VITE_DB_ENABLED !== 'false';
```

---

## 附：数据库建表语句参考

完整的 SQL Server 建表脚本见 `database/schema.sqlserver.sql`，包含：

- 5 张业务表 + 完整审计字段
- 外键约束（`D_WJGL_BQ → D_WJGL_WH`，`D_WJGL_WJBQ → D_WJGL_WJ + D_WJGL_BQ`）
- 唯一约束（维度名唯一、同维度标签唯一、文件-标签关联唯一）
- 查询索引（按文件ID、标签ID、维度ID 建立索引）
