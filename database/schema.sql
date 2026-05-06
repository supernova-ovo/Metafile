-- ============================================================
-- MetaFile 数据库 Schema
-- 当前: SQLite
-- 目标迁移: SQL Server（见每段注释说明）
-- ============================================================

-- 启用外键约束（SQLite 需单独启用）
-- SQL Server: 默认启用
PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. 文件表
-- ============================================================
-- SQL Server:
--   id       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID()
--   name     NVARCHAR(500) NOT NULL
--   type     NVARCHAR(50) NOT NULL
--   size     BIGINT NOT NULL
--   created_at  DATETIME2 NOT NULL DEFAULT GETDATE()
--   updated_at  DATETIME2 NOT NULL DEFAULT GETDATE()
--   deleted_at  DATETIME2 NULL
CREATE TABLE IF NOT EXISTS files (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name       TEXT NOT NULL,
    type       TEXT NOT NULL,
    size       INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);

-- ============================================================
-- 2. 维度表（部门/密级/年份/项目/状态/文件类型...）
-- ============================================================
-- SQL Server:
--   id       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID()
--   name     NVARCHAR(100) NOT NULL UNIQUE
--   display_order INT NOT NULL DEFAULT 0
--   created_at  DATETIME2 NOT NULL DEFAULT GETDATE()
CREATE TABLE IF NOT EXISTS dimensions (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name          TEXT NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 3. 标签值表
-- ============================================================
-- SQL Server:
--   id       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID()
--   dimension_id UNIQUEIDENTIFIER NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE
--   value    NVARCHAR(200) NOT NULL
--   created_at  DATETIME2 NOT NULL DEFAULT GETDATE()
--   UNIQUE(dimension_id, value)  →  UNIQUE(dimension_id, value)
CREATE TABLE IF NOT EXISTS tags (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    dimension_id  TEXT NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
    value         TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(dimension_id, value)
);

CREATE INDEX IF NOT EXISTS idx_tags_dimension_id ON tags(dimension_id);

-- ============================================================
-- 4. 文件-标签关联表（核心多对多）
-- ============================================================
-- SQL Server:
--   id       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID()
--   file_id  UNIQUEIDENTIFIER NOT NULL REFERENCES files(id) ON DELETE CASCADE
--   tag_id   UNIQUEIDENTIFIER NOT NULL REFERENCES tags(id) ON DELETE CASCADE
--   created_at  DATETIME2 NOT NULL DEFAULT GETDATE()
--   UNIQUE(file_id, tag_id)
CREATE TABLE IF NOT EXISTS file_tags (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id    TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id     TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(file_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_file_tags_file_id ON file_tags(file_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_tag_id ON file_tags(tag_id);

-- ============================================================
-- 5. 用户偏好表
-- ============================================================
-- SQL Server:
--   id       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID()
--   user_id  NVARCHAR(100) NOT NULL UNIQUE
--   dimension_order NVARCHAR(MAX) NOT NULL DEFAULT '[]'  (JSON text)
--   current_path    NVARCHAR(MAX) NOT NULL DEFAULT '[]'  (JSON text)
--   selected_file_id UNIQUEIDENTIFIER NULL REFERENCES files(id)
--   updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
CREATE TABLE IF NOT EXISTS user_preferences (
    id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id          TEXT NOT NULL UNIQUE,
    dimension_order  TEXT NOT NULL DEFAULT '[]',
    current_path     TEXT NOT NULL DEFAULT '[]',
    selected_file_id TEXT REFERENCES files(id),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 种子数据：初始化默认维度
-- ============================================================
INSERT OR IGNORE INTO dimensions (id, name, display_order) VALUES
    ('dim-project',    '项目',       1),
    ('dim-category',   '档案类别',   2),
    ('dim-class',      '档案分类',   3),
    ('dim-status',     '状态',       4),
    ('dim-year',       '年份',       5),
    ('dim-filetype',   '文件类型',   6),
    ('dim-security',   '密级',       7),
    ('dim-department', '部门',       8);

-- ============================================================
-- 种子数据：初始化默认标签值
-- ============================================================
INSERT OR IGNORE INTO tags (id, dimension_id, value) VALUES
    -- 密级
    ('tag-open',        'dim-security', '公开'),
    ('tag-internal',    'dim-security', '内部公开'),
    ('tag-confidential','dim-security', '机密'),
    ('tag-core',        'dim-security', '核心机密'),
    ('tag-business',    'dim-security', '商密'),
    -- 年份
    ('tag-y2023',       'dim-year', '2023'),
    ('tag-y2024',       'dim-year', '2024'),
    ('tag-y2025',       'dim-year', '2025'),
    -- 状态
    ('tag-active',      'dim-status', '进行中'),
    ('tag-done',        'dim-status', '已完成'),
    ('tag-planning',    'dim-status', '立项阶段'),
    ('tag-exited',      'dim-status', '已退出'),
    -- 档案类别
    ('tag-sk',          'dim-category', '实控投资管理档案（SK）'),
    ('tag-cg',          'dim-category', '参股投资管理档案（CG）'),
    ('tag-qk',          'dim-category', '前期开发档案（QK）'),
    -- 档案分类
    ('tag-zx',          'dim-class', '战新类（ZX）'),
    ('tag-ct',          'dim-class', '传统能源类（CT）'),
    -- 文件类型
    ('tag-pdf',         'dim-filetype', 'PDF'),
    ('tag-docx',        'dim-filetype', 'DOCX'),
    ('tag-xlsx',        'dim-filetype', 'XLSX'),
    ('tag-pptx',        'dim-filetype', 'PPTX');
