// Temporary catalog fixtures until the capability registry is connected.
export const plugins = [
  { id: 'figma', name: 'Figma', monogram: 'Fi', detail: '读取设计稿、生成界面并同步组件映射。', enabled: true, skills: ['设计读取', '生成设计'] },
  { id: 'drive', name: 'Google Drive', monogram: 'G', detail: '连接企业云端文档、表格与演示材料。', enabled: true, skills: ['文档', '表格', '幻灯片'] },
  { id: 'browser', name: 'Browser', monogram: 'Br', detail: '在隔离浏览器中验证页面与自动化流程。', enabled: true, skills: ['页面测试', '截图'] },
  { id: 'sites', name: 'Sites', monogram: 'S', detail: '构建、保存并发布可访问的网站制品。', enabled: false, skills: ['构建', '部署'] },
];

export const skills = [
  { name: 'issue-flow', source: '工作区', detail: '结合 Kibana、Sentry 和本地源码完成一体化问题排查。', dependencies: ['Chrome DevTools', 'Sentry'] },
  { name: 'boss-cr-skill', source: '个人', detail: '执行完整代码评审并生成结构化审查报告。', dependencies: ['Git', 'Review API'] },
  { name: 'backend-tech-docs', source: '个人', detail: '按照企业模板生成后端技术方案和接口说明。', dependencies: ['DingTalk Docs'] },
  { name: 'frontend-design', source: '系统', detail: '为工作台界面提供视觉方向、组件结构与交互约束。', dependencies: ['Design tokens'] },
];
