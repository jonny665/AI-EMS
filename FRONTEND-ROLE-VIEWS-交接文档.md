# 前端角色视图 — 交接文档

## 项目概述

AI-EMS 是 Uniapp + Vue 3 的教育管理系统 PoC。H5 模式无需云服务即可运行。

## 启动方式

```bash
cd d:/GitHub/AI-EMS
npm run dev:h5
```

浏览器访问 `http://localhost:5174/`（端口可能变化，看终端输出）。

### 测试账号（密码统一 `demo123`）

| 角色 | 用户名 |
|---|---|
| 学生 | `student001` |
| 教师 | `teacher001` |
| 管理员 | `admin001` |

## 文件边界（重要！5 个子团队并行开发）

### 我们创建的（可自由修改）

```
components/
├── PageHeader.vue     # 页头：标题 + 用户名 + 退出按钮
├── NavTabs.vue        # 导航按钮组，根据角色自动切换
├── DataCard.vue       # 键值对卡片容器
├── StatusBadge.vue    # 状态标签（颜色自动映射）
├── ProgressBar.vue    # 进度条（颜色自动映射）
└── StatCard.vue       # 统计数字卡片
```

### 我们重构的（可自由修改）

```
pages/student/dashboard.vue   # 学生仪表板
pages/teacher/dashboard.vue   # 教师仪表板
pages/admin/dashboard.vue     # 管理员仪表板
```

### 我们修改的（需谨慎同步）

```
index.html   # 入口 HTML：加了 <title>、uni-input 修复样式、/src/main.js 路径
```

### 严禁修改（其他团队负责）

```
common/api.js           → 架构与集成团队
common/session.js       → 架构与集成团队
pages/leave/            → 业务流程团队
pages/evaluation/       → 业务流程团队
pages/assistant/        → AI 助手团队
pages/login/            → 避免冲突（已还原为原始版本）
pages.json              → 架构与集成团队
App.vue                 → 架构与集成团队
uniCloud-aliyun/        → 架构 + 业务流程团队
```

## 组件使用说明

### PageHeader — 页头

```html
<PageHeader title="页面标题" displayName="用户名" username="账号" @logout="退出回调">
  <!-- 可选：右侧扩展按钮 -->
</PageHeader>
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `title` | 字符串 | 页面标题 |
| `displayName` | 字符串 | 用户显示名 |
| `username` | 字符串 | 登录账号 |
| `@logout` | 事件 | 点击退出时触发（组件内部已处理清除 session + 跳转登录页） |

### NavTabs — 导航按钮组

```html
<NavTabs role="student" current="dashboard" />
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `role` | 字符串 | 用户角色：`student` / `teacher` / `admin` |
| `current` | 字符串 | 当前高亮的标签：`dashboard` / `leave` / `evaluation` / `assistant` |

根据角色自动生成导航按钮，当前页高亮（蓝色背景），点击通过 `uni.navigateTo` 跳转。

### StatCard — 统计数字卡片

```html
<StatCard value="3.6" label="GPA" />
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `value` | 字符串/数字 | 大数字 |
| `label` | 字符串 | 下方小标签 |

### DataCard — 数据卡片容器

```html
<DataCard title="课程名" subtitle="周一 10:00-12:00 · 15学分">
  <StatusBadge status="present" />
</DataCard>
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `title` | 字符串 | 卡片标题 |
| `subtitle` | 字符串（可选） | 副标题 |

插槽：默认插槽放右侧内容，通常嵌入 StatusBadge。

### StatusBadge — 状态标签

```html
<StatusBadge status="absent" />
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `status` | 字符串 | `present`/`approved`（绿色）、`absent`/`rejected`（红色）、`on_leave`（橙色）、`pending`（黄色） |

### ProgressBar — 进度条

```html
<ProgressBar :current="45" :total="120" label="毕业进度" />
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `current` | 数字 | 当前值 |
| `total` | 数字 | 总值 |
| `label` | 字符串 | 左侧标签 |

颜色规则：低于 60% 红色，低于 80% 黄色，80% 以上绿色。

## 数据策略

不修改 `common/api.js` 和任何云函数。所有增强数据在 dashboard 内部自行计算或硬编码。

### 学生仪表板

```js
const STUDENT_PROFILE = {
  major: 'Software Engineering',
  gpa: 3.6,
  creditsEarned: 45,
  totalCredits: 120,
  enrollmentYear: 2024
}
```

- 出勤率 = `attendance.filter(a => a.status === 'present').length / attendance.length * 100`
- 课程名通过 `courses` 数组按 `courseId` 查找

### 教师仪表板

```js
const TEACHER_PROFILE = {
  department: 'Computer Science',
  title: 'Professor',
  studentCount: 45   // 硬编码，API 暂不返回
}
```

- 高危学生 = 按教师课程 ID 过滤考勤 → 按 studentId 分组 → 缺席大于等于 3 次
- 教师课程学生数：硬编码 45

### 管理员仪表板

```js
const SYSTEM_STATS = {
  totalStudents: 2000,
  totalTeachers: 200,
  activeCourses: 45
}
```

- 系统指标来自 `data.metrics`（API 返回）
- 学生/教师总数：硬编码

## uni-input 点击修复

**问题**：UniApp H5 模式下输入框高度只有 0.26px，几乎无法点击。

**原因**：UniApp 将 `<input>` 编译为 `<uni-input>` 自定义组件，内部样式 `height: 1.4em; overflow: hidden` 导致内层 input 塌缩。

**修复位置**：`index.html` 的 `<head>` 中增加了全局样式，用 flex 布局强制内部 input 填满容器。这个修复**只在 index.html 中**，不依赖 App.vue 或登录页的样式。

**注意**：如果要改登录页输入框外观，改 `index.html` 中 `uni-input` 相关样式，不要改 `login.vue` 的 scoped 样式（scoped 样式无法穿透 uni-input 自定义组件）。

## src/ 目录说明

项目根目录和 `src/` 目录各有一份完整源码。**两份必须保持同步。**

- Vite 入口是根目录 `index.html`，它加载 `src/main.js`
- `src/main.js` 引用 `src/` 下的 App.vue、pages、components
- 实际编译的是 `src/` 下的文件

**每次修改根目录文件后，执行同步命令：**

```bash
cp 根目录文件路径 src/对应路径
```

例如：
```bash
cp d:/GitHub/AI-EMS/App.vue d:/GitHub/AI-EMS/src/App.vue
cp d:/GitHub/AI-EMS/pages/student/dashboard.vue d:/GitHub/AI-EMS/src/pages/student/dashboard.vue
```

建议后续和架构团队确认最终目录结构，看能否去掉 `src/` 避免双重维护。

## 验证清单

在浏览器中逐项确认：

1. 登录页输入框可正常点击输入
2. 学生仪表板：GPA 3.6、学分 45/120、毕业进度条 38%、出勤率
3. 教师仪表板：2 门课程、45 学生、高危学生区域、评价快照
4. 管理员仪表板：2000 学生 / 200 教师 / 45 课程、系统指标、快捷操作
5. 导航按钮可跳转到请假 / 评价 / AI 助手页面
6. 越权保护：学生登录后访问 `/pages/admin/dashboard` → 重定向到登录页
7. 退出按钮返回登录页

## 相关文档

- 完整软件设计：项目根目录下的 `CLAUDE.md`
- 项目架构说明：同样在 `CLAUDE.md` 中
