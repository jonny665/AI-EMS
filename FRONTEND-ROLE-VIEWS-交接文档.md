# 前端角色视图 — 交接文档

## 一、任务背景

CS Group 11 的 Frontend Role Views 子任务（2 人），负责学生/教师/管理员三种角色的仪表板及流程界面。项目为 Uniapp + Vue 3，H5 模式无需云服务即可运行。截止 **2026 年 6 月 8 日** PoC 提交。

5 个子团队并行开发，必须严格隔离文件边界。

---

## 二、已完成工作

### 2.1 新建 6 个共享组件（`components/`）

| 组件 | 用途 |
|---|---|
| `PageHeader.vue` | 统一页头：标题 + 用户信息 + 退出按钮 |
| `NavTabs.vue` | 角色感知导航按钮组，当前页高亮 |
| `DataCard.vue` | 键值对展示卡片容器 |
| `StatusBadge.vue` | 状态标签，颜色根据状态自动映射 |
| `ProgressBar.vue` | CSS 进度条，颜色根据百分比自动映射 |
| `StatCard.vue` | 统计数字卡片（大数字 + 标签） |

### 2.2 重构 3 个仪表板

| 页面 | 实现内容 |
|---|---|
| **学生仪表板** | 学业概览（GPA 3.6、学分 45/120、出勤率）、毕业进度条、我的课程、最近考勤、请假记录 |
| **教师仪表板** | 教学概览（课程数 2、学生数 45、待审批 0）、任教课程、高危学生（缺席≥3 次）、待审批请假、评价快照 |
| **管理员仪表板** | 系统概览（学生 2000、教师 200、课程 45）、系统指标、待处理请假、快捷操作 |

### 2.3 数据策略

**不修改 `common/api.js` 和任何云函数。** 所有数据来源：

- **动态数据**（来自 `get-dashboard-data` 云函数 fallback）：课程、考勤、请假、评价摘要、指标
- **前端计算**：出勤率（present 数 / 总数）、高危学生（按教师课程过滤→按学生分组→缺席≥3）
- **硬编码常量**：GPA、学分、学生/教师总数等云函数未返回的字段

这些硬编码值在架构团队扩展 `get-dashboard-data` 返回结构后，可直接替换为真实数据，无需改动组件结构。

### 2.4 基础设施

- `package.json` + `vite.config.js`：H5 命令行开发环境
- `index.html`：入口 HTML，包含 UniApp H5 输入框点击修复
- `CLAUDE.md`：项目架构说明
- `src/` 目录：UniApp CLI 要求的目录结构（见第五节）

---

## 三、边界合规自查

### 我们修改的文件（全部在专属范围内）

| 文件 | 操作 | 是否合规 |
|---|---|---|
| `pages/student/dashboard.vue` | 重构 | ✅ 我们专属 |
| `pages/teacher/dashboard.vue` | 重构 | ✅ 我们专属 |
| `pages/admin/dashboard.vue` | 重构 | ✅ 我们专属 |
| `components/`（6 个文件） | 新建 | ✅ 我们专属 |
| `index.html` | 加 `<title>`、uni-input 修复样式、`/src/main.js` 路径 | ✅ 入口文件，非任何子团队专属 |

### 严禁修改的文件（已确认未改动）

| 文件 | 归属团队 | 状态 |
|---|---|---|
| `common/api.js` | 架构与集成 | ✅ 未修改 |
| `common/session.js` | 架构与集成 | ✅ 未修改 |
| `pages/leave/` | 业务流程 | ✅ 未修改 |
| `pages/evaluation/` | 业务流程 | ✅ 未修改 |
| `pages/assistant/` | AI 助手 | ✅ 未修改 |
| `pages/login/` | 避免冲突 | ✅ 已还原为原始版本 |
| `pages.json` | 架构与集成 | ✅ 未修改 |
| `App.vue` | 架构与集成 | ✅ 已还原为原始版本 |
| `uniCloud-aliyun/` | 架构 + 业务流程 | ✅ 未修改 |

### 额外创建的非代码文件（不影响其他团队）

- `CLAUDE.md`：项目开发指南
- `FRONTEND-ROLE-VIEWS-交接文档.md`：本交接文档
- `package.json` / `package-lock.json` / `vite.config.js`：构建配置
- `src/`：UniApp CLI 要求的源码副本

**结论：没有越界，没有做不该做的。**

---

## 四、现存问题

### 4.1 leaveRequests 字段不对齐（需架构团队配合）

三个仪表板都引用了 `item.studentName`、`item.courseName`、`item.date`、`item.reason`，但：

- 数据库 `leave_requests` schema 中对应字段为 `student_id`、`reason_type`、`start_at`、`end_at`
- 云函数 fallback 返回空数组 `[]`，所以目前页面显示"无记录"
- 当数据库有真实请假数据时，字段名不匹配会导致数据无法显示

**解决方向**：需架构团队在云函数中做关联查询——`student_id` → `studentName`、课程关联 → `courseName`、`start_at`/`end_at` → `date`、`reason_type`/`reason_detail` → `reason`。

### 4.2 snake_case 与 camelCase 命名不一致（需架构团队配合）

| 层级 | 示例字段 |
|---|---|
| 数据库 schema | `course_code`、`attendance_date`、`course_offering_id` |
| 云函数 demo 数据 | `code`、`date`、`courseId` |
| 前端引用 | `course.code`、`item.date`、`item.courseId` |

目前前端与云函数 demo 数据对齐（都使用 camelCase），但如果架构团队切换到真实数据库查询，需在云函数中做字段映射，否则所有数据丢失。

### 4.3 硬编码值有待替换（需架构团队扩展云函数）

| 硬编码值 | 值 | 对应数据库表 | 说明 |
|---|---|---|---|
| `STUDENT_PROFILE.gpa` | 3.6 | `grades` 聚合 | 云函数未接入 |
| `STUDENT_PROFILE.creditsEarned` | 45 | `grades` 聚合 | 云函数未接入 |
| `STUDENT_PROFILE.totalCredits` | 120 | `training_plans` | 云函数未接入 |
| `TEACHER_PROFILE.studentCount` | 45 | 选课关联查询 | 云函数未返回 |
| `SYSTEM_STATS.totalStudents` | 2000 | `students` 表 count | 云函数未返回 |
| `SYSTEM_STATS.totalTeachers` | 200 | `teachers` 表 count | 云函数未返回 |

这些值在 `data()` 中以常量形式定义，架构团队扩展 `get-dashboard-data` 返回值后，将 `this.profile.gpa` 改为 `this.data.profile.gpa` 即可无缝替换。

### 4.4 src/ 目录双重维护

根目录和 `src/` 各有一份完整源码，修改文件后需要同步。原因：UniApp CLI 要求源码在 `src/` 下，Vite 从 `src/` 编译。建议后续和架构团队确认能否统一目录结构。

---

## 五、启动与开发

### 启动

```bash
cd d:/GitHub/AI-EMS
npm run dev:h5
```

浏览器访问终端输出的地址（通常 `http://localhost:5174/`）。

### 测试登录

当前不保留示例账号；管理员测试请使用你导入的 `admin001` 账户。

### 文件同步

根目录和 `src/` 两份源码必须保持同步。修改根目录文件后执行：

```bash
cp d:/GitHub/AI-EMS/根目录文件 d:/GitHub/AI-EMS/src/对应路径
```

---

## 六、组件使用速查

### PageHeader

```html
<PageHeader title="页面标题" displayName="用户名" username="账号" />
```

Props：`title`（字符串）、`displayName`（字符串）、`username`（字符串）

### NavTabs

```html
<NavTabs role="student" current="dashboard" />
```

Props：`role`（`student`/`teacher`/`admin`）、`current`（`dashboard`/`leave`/`evaluation`/`assistant`）

### StatCard

```html
<StatCard value="3.6" label="GPA" />
```

Props：`value`（字符串/数字）、`label`（字符串）

### DataCard

```html
<DataCard title="课程名" subtitle="周一 10:00-12:00 · 15学分">
  <StatusBadge status="present" />
</DataCard>
```

Props：`title`（字符串）、`subtitle`（字符串，可选）。默认插槽放右侧内容。

### StatusBadge

```html
<StatusBadge status="absent" />
```

Props：`status`（字符串）
- `present` / `approved` → 绿色
- `absent` / `rejected` → 红色
- `on_leave` → 橙色
- `pending` → 黄色

### ProgressBar

```html
<ProgressBar :current="45" :total="120" label="毕业进度" />
```

Props：`current`（数字）、`total`（数字）、`label`（字符串）
颜色规则：<60% 红色、<80% 黄色、≥80% 绿色

---

## 七、uni-input 点击修复

UniApp H5 模式下 `<input>` 被编译为 `<uni-input>` 自定义组件，内部样式导致真实 input 高度塌缩至 0.26px。修复位于 `index.html` 的 `<style>` 标签中（使用 flex 布局强制内部 input 填满容器）。

**注意**：不要改 `login.vue` 或 `App.vue` 的样式来修输入框——scoped 样式无法穿透 `<uni-input>` 组件。

---

## 八、验证清单

1. 登录页输入框可正常点击输入
2. 学生仪表板：GPA 3.6、学分 45/120、毕业进度 38%、出勤率
3. 教师仪表板：2 门课程、45 学生、高危学生区域、评价快照
4. 管理员仪表板：2000 学生 / 200 教师 / 45 课程、系统指标、快捷操作
5. 导航按钮可跳转到请假 / 评价 / AI 助手页面
6. 越权保护：学生访问 `/pages/admin/dashboard` → 重定向到登录页
7. 退出按钮返回登录页
