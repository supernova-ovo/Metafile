USE [LCSF_XXHGL]
GO

-- ============================================================
-- MetaFile 文件档案管理系统 - 建表脚本
-- 数据库: LCSF_XXHGL
-- 生成日期: 2026/5/6
-- 说明: 仿照 D_BZRWDWH_RY 风格编写，含系统审计字段+扩展属性
-- ============================================================

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- 1. 文件表 D_WJGL_WJ（文件管理_文件）
-- ============================================================
CREATE TABLE [dbo].[D_WJGL_WJ](
	[WJMC] [nvarchar](500) NULL,           -- 文件名称
	[WJLX] [nvarchar](50) NULL,            -- 文件类型 (pdf/docx/xlsx/pptx...)
	[WJDX] [bigint] NULL,                  -- 文件大小 (bytes)
	[GXRQ] [datetime] NULL,                -- 更新时间
	[BZ] [nvarchar](max) NULL,             -- 备注
	[sys_id] [uniqueidentifier] NOT NULL,
	[sys_user] [nvarchar](300) NULL,
	[sys_date] [datetime] NULL,
	[sys_muser] [nvarchar](50) NULL,
	[sys_mdate] [datetime] NULL,
	[sys_valid] [smallint] NULL,
	[sys_batchid] [uniqueidentifier] NULL,
	[sys_epsid] [uniqueidentifier] NULL,
	[XuHao] [nvarchar](50) NULL,
 CONSTRAINT [PK_D_WJGL_WJ] PRIMARY KEY NONCLUSTERED 
(
	[sys_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

ALTER TABLE [dbo].[D_WJGL_WJ] ADD  CONSTRAINT [DF_D_WJGL_WJ_sys_id]  DEFAULT (newid()) FOR [sys_id]
GO
ALTER TABLE [dbo].[D_WJGL_WJ] ADD  CONSTRAINT [DF_D_WJGL_WJ_sys_date]  DEFAULT (getdate()) FOR [sys_date]
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'文件名称' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJ', @level2type=N'COLUMN',@level2name=N'WJMC'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'文件类型' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJ', @level2type=N'COLUMN',@level2name=N'WJLX'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'文件大小(Bytes)' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJ', @level2type=N'COLUMN',@level2name=N'WJDX'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'更新时间' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJ', @level2type=N'COLUMN',@level2name=N'GXRQ'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'备注' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJ', @level2type=N'COLUMN',@level2name=N'BZ'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'文件管理_文件' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJ'
GO

-- ============================================================
-- 2. 维度表 D_WJGL_WH（文件管理_维度）
-- 说明: 存储多维分类体系的维度定义，如 部门/密级/年份/项目/状态/文件类型
-- ============================================================
CREATE TABLE [dbo].[D_WJGL_WH](
	[WHMC] [nvarchar](100) NOT NULL,        -- 维度名称（如 部门、密级、年份、项目、状态、文件类型）
	[WHMS] [nvarchar](500) NULL,            -- 维度描述
	[MRPX] [int] NULL,                      -- 默认排序号
	[sys_id] [uniqueidentifier] NOT NULL,
	[sys_user] [nvarchar](300) NULL,
	[sys_date] [datetime] NULL,
	[sys_muser] [nvarchar](50) NULL,
	[sys_mdate] [datetime] NULL,
	[sys_valid] [smallint] NULL,
	[sys_batchid] [uniqueidentifier] NULL,
	[sys_epsid] [uniqueidentifier] NULL,
	[XuHao] [nvarchar](50) NULL,
 CONSTRAINT [PK_D_WJGL_WH] PRIMARY KEY NONCLUSTERED 
(
	[sys_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[D_WJGL_WH] ADD  CONSTRAINT [DF_D_WJGL_WH_sys_id]  DEFAULT (newid()) FOR [sys_id]
GO
ALTER TABLE [dbo].[D_WJGL_WH] ADD  CONSTRAINT [DF_D_WJGL_WH_sys_date]  DEFAULT (getdate()) FOR [sys_date]
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'维度名称' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WH', @level2type=N'COLUMN',@level2name=N'WHMC'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'维度描述' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WH', @level2type=N'COLUMN',@level2name=N'WHMS'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'默认排序号' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WH', @level2type=N'COLUMN',@level2name=N'MRPX'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'文件管理_维度' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WH'
GO

-- ============================================================
-- 3. 标签值表 D_WJGL_BQ（文件管理_标签）
-- 说明: 每个维度下的具体标签值，如 密级维度下有 公开/内部公开/机密/核心机密/商密
-- ============================================================
CREATE TABLE [dbo].[D_WJGL_BQ](
	[WHID] [uniqueidentifier] NOT NULL,     -- 所属维度ID（关联 D_WJGL_WH.sys_id）
	[BQZ] [nvarchar](200) NOT NULL,         -- 标签值
	[BZ] [nvarchar](500) NULL,              -- 备注
	[sys_id] [uniqueidentifier] NOT NULL,
	[sys_user] [nvarchar](300) NULL,
	[sys_date] [datetime] NULL,
	[sys_muser] [nvarchar](50) NULL,
	[sys_mdate] [datetime] NULL,
	[sys_valid] [smallint] NULL,
	[sys_batchid] [uniqueidentifier] NULL,
	[sys_epsid] [uniqueidentifier] NULL,
	[XuHao] [nvarchar](50) NULL,
 CONSTRAINT [PK_D_WJGL_BQ] PRIMARY KEY NONCLUSTERED 
(
	[sys_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[D_WJGL_BQ] ADD  CONSTRAINT [DF_D_WJGL_BQ_sys_id]  DEFAULT (newid()) FOR [sys_id]
GO
ALTER TABLE [dbo].[D_WJGL_BQ] ADD  CONSTRAINT [DF_D_WJGL_BQ_sys_date]  DEFAULT (getdate()) FOR [sys_date]
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'所属维度ID' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_BQ', @level2type=N'COLUMN',@level2name=N'WHID'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'标签值' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_BQ', @level2type=N'COLUMN',@level2name=N'BQZ'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'备注' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_BQ', @level2type=N'COLUMN',@level2name=N'BZ'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'文件管理_标签' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_BQ'
GO

-- ============================================================
-- 4. 文件-标签关联表 D_WJGL_WJBQ（文件管理_文件标签）
-- 说明: 文件与标签的多对多关联，实现同一文件可挂多个维度标签
-- ============================================================
CREATE TABLE [dbo].[D_WJGL_WJBQ](
	[WJID] [uniqueidentifier] NOT NULL,     -- 文件ID（关联 D_WJGL_WJ.sys_id）
	[BQID] [uniqueidentifier] NOT NULL,     -- 标签ID（关联 D_WJGL_BQ.sys_id）
	[WHID] [uniqueidentifier] NULL,         -- 冗余维度ID，方便按维度查询
	[BZ] [nvarchar](500) NULL,
	[sys_id] [uniqueidentifier] NOT NULL,
	[sys_user] [nvarchar](300) NULL,
	[sys_date] [datetime] NULL,
	[sys_muser] [nvarchar](50) NULL,
	[sys_mdate] [datetime] NULL,
	[sys_valid] [smallint] NULL,
	[sys_batchid] [uniqueidentifier] NULL,
	[sys_epsid] [uniqueidentifier] NULL,
	[XuHao] [nvarchar](50) NULL,
 CONSTRAINT [PK_D_WJGL_WJBQ] PRIMARY KEY NONCLUSTERED 
(
	[sys_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[D_WJGL_WJBQ] ADD  CONSTRAINT [DF_D_WJGL_WJBQ_sys_id]  DEFAULT (newid()) FOR [sys_id]
GO
ALTER TABLE [dbo].[D_WJGL_WJBQ] ADD  CONSTRAINT [DF_D_WJGL_WJBQ_sys_date]  DEFAULT (getdate()) FOR [sys_date]
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'文件ID' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJBQ', @level2type=N'COLUMN',@level2name=N'WJID'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'标签ID' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJBQ', @level2type=N'COLUMN',@level2name=N'BQID'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'冗余维度ID' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJBQ', @level2type=N'COLUMN',@level2name=N'WHID'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'文件管理_文件标签' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_WJBQ'
GO

-- ============================================================
-- 5. 用户偏好表 D_WJGL_YHPH（文件管理_用户偏好）
-- 说明: 存储用户的维度排序、当前路径、选中文件等界面偏好
-- ============================================================
CREATE TABLE [dbo].[D_WJGL_YHPH](
	[YHID] [nvarchar](100) NOT NULL,        -- 用户ID（扩展多用户时使用）
	[WHPX] [nvarchar](max) NULL,            -- 维度排序 JSON，如 ["项目","部门","密级"]
	[DQDL] [nvarchar](max) NULL,            -- 当前路径 JSON
	[XZWJID] [uniqueidentifier] NULL,       -- 选中的文件ID
	[sys_id] [uniqueidentifier] NOT NULL,
	[sys_user] [nvarchar](300) NULL,
	[sys_date] [datetime] NULL,
	[sys_muser] [nvarchar](50) NULL,
	[sys_mdate] [datetime] NULL,
	[sys_valid] [smallint] NULL,
	[sys_batchid] [uniqueidentifier] NULL,
	[sys_epsid] [uniqueidentifier] NULL,
	[XuHao] [nvarchar](50) NULL,
 CONSTRAINT [PK_D_WJGL_YHPH] PRIMARY KEY NONCLUSTERED 
(
	[sys_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

ALTER TABLE [dbo].[D_WJGL_YHPH] ADD  CONSTRAINT [DF_D_WJGL_YHPH_sys_id]  DEFAULT (newid()) FOR [sys_id]
GO
ALTER TABLE [dbo].[D_WJGL_YHPH] ADD  CONSTRAINT [DF_D_WJGL_YHPH_sys_date]  DEFAULT (getdate()) FOR [sys_date]
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'用户ID' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_YHPH', @level2type=N'COLUMN',@level2name=N'YHID'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'维度排序JSON' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_YHPH', @level2type=N'COLUMN',@level2name=N'WHPX'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'当前路径JSON' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_YHPH', @level2type=N'COLUMN',@level2name=N'DQDL'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'选中文件ID' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_YHPH', @level2type=N'COLUMN',@level2name=N'XZWJID'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'文件管理_用户偏好' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'D_WJGL_YHPH'
GO

-- ============================================================
-- 6. 外键约束
-- ============================================================

-- 标签表 -> 维度表
ALTER TABLE [dbo].[D_WJGL_BQ] ADD  CONSTRAINT [FK_D_WJGL_BQ_WHID] FOREIGN KEY([WHID])
REFERENCES [dbo].[D_WJGL_WH] ([sys_id])
GO

-- 文件标签表 -> 文件表
ALTER TABLE [dbo].[D_WJGL_WJBQ] ADD  CONSTRAINT [FK_D_WJGL_WJBQ_WJID] FOREIGN KEY([WJID])
REFERENCES [dbo].[D_WJGL_WJ] ([sys_id])
GO

-- 文件标签表 -> 标签表
ALTER TABLE [dbo].[D_WJGL_WJBQ] ADD  CONSTRAINT [FK_D_WJGL_WJBQ_BQID] FOREIGN KEY([BQID])
REFERENCES [dbo].[D_WJGL_BQ] ([sys_id])
GO

-- 用户偏好表 -> 文件表（选中文件）
ALTER TABLE [dbo].[D_WJGL_YHPH] ADD  CONSTRAINT [FK_D_WJGL_YHPH_XZWJID] FOREIGN KEY([XZWJID])
REFERENCES [dbo].[D_WJGL_WJ] ([sys_id])
GO

-- ============================================================
-- 7. 唯一约束（防止业务数据重复）
-- ============================================================

-- 同一维度下不允许重复的标签名
ALTER TABLE [dbo].[D_WJGL_BQ] ADD  CONSTRAINT [UK_D_WJGL_BQ_WHBQ] UNIQUE NONCLUSTERED 
(
	[WHID] ASC,
	[BQZ] ASC
)
GO

-- 同一个文件不允许重复关联同一标签
ALTER TABLE [dbo].[D_WJGL_WJBQ] ADD  CONSTRAINT [UK_D_WJGL_WJBQ_WJBQ] UNIQUE NONCLUSTERED 
(
	[WJID] ASC,
	[BQID] ASC
)
GO

-- 维度名称唯一
ALTER TABLE [dbo].[D_WJGL_WH] ADD  CONSTRAINT [UK_D_WJGL_WH_MC] UNIQUE NONCLUSTERED 
(
	[WHMC] ASC
)
GO

-- 用户ID唯一
ALTER TABLE [dbo].[D_WJGL_YHPH] ADD  CONSTRAINT [UK_D_WJGL_YHPH_YH] UNIQUE NONCLUSTERED 
(
	[YHID] ASC
)
GO

-- ============================================================
-- 8. 索引（提升查询性能）
-- ============================================================

-- 文件标签按文件ID查询
CREATE NONCLUSTERED INDEX [IX_D_WJGL_WJBQ_WJID] ON [dbo].[D_WJGL_WJBQ]
(
	[WJID] ASC
)
GO

-- 文件标签按标签ID查询
CREATE NONCLUSTERED INDEX [IX_D_WJGL_WJBQ_BQID] ON [dbo].[D_WJGL_WJBQ]
(
	[BQID] ASC
)
GO

-- 文件标签按维度ID查询
CREATE NONCLUSTERED INDEX [IX_D_WJGL_WJBQ_WHID] ON [dbo].[D_WJGL_WJBQ]
(
	[WHID] ASC
)
GO

-- 标签表按维度ID查询
CREATE NONCLUSTERED INDEX [IX_D_WJGL_BQ_WHID] ON [dbo].[D_WJGL_BQ]
(
	[WHID] ASC
)
GO
