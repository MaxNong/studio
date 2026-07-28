// Interactions for the standalone design prototype.
const taskRows = document.querySelectorAll('.sidebar-task');
const taskTitle = document.querySelector('#taskTitle');
const textarea = document.querySelector('#composerInput');
const sendButton = document.querySelector('#sendButton');
const toast = document.querySelector('#toast');
const runnerButton = document.querySelector('#openRunner');
const runnerName = document.querySelector('#runnerName');
const connectionState = document.querySelector('#connectionState');
const userMenuButton = document.querySelector('#userMenuButton');
const userMenu = document.querySelector('#userMenu');
const appShell = document.querySelector('.app-shell');
const taskView = document.querySelector('#taskView');
const knowledgeView = document.querySelector('#knowledgeView');
const pluginsView = document.querySelector('#pluginsView');
const skillsView = document.querySelector('#skillsView');
const taskInspector = document.querySelector('#taskInspector');
const inspectorToggle = document.querySelector('#inspectorToggle');
const taskMoreButton = document.querySelector('#taskMoreButton');
const routeItems = document.querySelectorAll('[data-route]');
const brandHome = document.querySelector('#brandHome');
const settingsEntry = document.querySelector('#settingsEntry');
const settingsDialog = document.querySelector('#settingsDialog');
const settingsClose = document.querySelector('#settingsClose');
const settingsPanelTitle = document.querySelector('#settingsPanelTitle');
const skillPreview = document.querySelector('#skillPreview');
const skillPreviewClose = document.querySelector('#skillPreviewClose');
const skillPreviewTitle = document.querySelector('#skillPreviewTitle');
const contentViews = { knowledge: knowledgeView, plugins: pluginsView, skills: skillsView };
const routeTitles = { knowledge: '知识库', plugins: '插件', skills: '技能' };

const selectedTaskTitle = () => document.querySelector('.sidebar-task.selected')?.dataset.task || '任务';

const navigate = route => {
  const contentView = contentViews[route];
  Object.values(contentViews).forEach(view => {
    view.hidden = true;
  });

  if (contentView) {
    appShell.classList.add('knowledge-route');
    taskView.hidden = true;
    contentView.hidden = false;
    taskInspector.hidden = true;
    taskTitle.textContent = routeTitles[route];
    taskMoreButton.hidden = true;
    window.location.hash = route;
  } else if (route === 'tasks') {
    appShell.classList.remove('knowledge-route');
    taskView.hidden = false;
    taskInspector.hidden = false;
    taskTitle.textContent = selectedTaskTitle();
    taskMoreButton.hidden = false;
    window.location.hash = '';
  }

  routeItems.forEach(item => item.classList.toggle('active', route !== 'tasks' && item.dataset.route === route));
};

taskRows.forEach(row => {
  row.addEventListener('click', () => {
    taskRows.forEach(item => item.classList.remove('selected'));
    row.classList.add('selected');
    taskTitle.textContent = row.dataset.task;
    navigate('tasks');
  });
});

routeItems.forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.route));
});

brandHome.addEventListener('click', () => navigate('tasks'));

inspectorToggle.addEventListener('click', () => {
  const collapsed = appShell.classList.toggle('inspector-collapsed');
  inspectorToggle.setAttribute('aria-expanded', String(!collapsed));
  inspectorToggle.setAttribute('aria-label', collapsed ? '展开任务侧栏' : '收起任务侧栏');
});

runnerButton.addEventListener('click', () => {
  const useCompanyApi = runnerName.textContent === '本地 Codex';
  runnerName.textContent = useCompanyApi ? '公司 API' : '本地 Codex';
  connectionState.innerHTML = useCompanyApi ? '<i></i> 网关已连接' : '<i></i> 本地已连接';
  runnerButton.classList.toggle('company-runner', useCompanyApi);
});

textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 110)}px`;
});

const send = () => {
  if (!textarea.value.trim()) {
    textarea.focus();
    return;
  }
  textarea.value = '';
  textarea.style.height = 'auto';
  toast.textContent = '已将补充要求发送给当前任务';
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
};

sendButton.addEventListener('click', send);
textarea.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

document.querySelectorAll('.section-title').forEach(button => {
  button.addEventListener('click', () => {
    const section = button.closest('.inspector-section');
    const children = [...section.children].filter(child => child !== button);
    const collapsed = section.classList.toggle('collapsed');
    children.forEach(child => {
      child.style.display = collapsed ? 'none' : '';
    });
    button.lastElementChild.textContent = collapsed ? '⌄' : '⌃';
  });
});

document.querySelectorAll('.cluster-title').forEach(button => {
  button.addEventListener('click', () => {
    const cluster = button.closest('.task-cluster');
    const tasks = cluster.querySelector('.cluster-tasks');
    const collapsed = cluster.classList.toggle('collapsed');
    tasks.hidden = collapsed;
    button.setAttribute('aria-expanded', String(!collapsed));
  });
});

userMenuButton.addEventListener('click', event => {
  event.stopPropagation();
  const isOpen = !userMenu.hidden;
  userMenu.hidden = isOpen;
  userMenuButton.setAttribute('aria-expanded', String(!isOpen));
});

document.addEventListener('click', event => {
  if (!userMenu.contains(event.target) && event.target !== userMenuButton) {
    userMenu.hidden = true;
    userMenuButton.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    userMenu.hidden = true;
    userMenuButton.setAttribute('aria-expanded', 'false');
    settingsDialog.hidden = true;
    skillPreview.hidden = true;
  }
});

document.querySelectorAll('.knowledge-tabs button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.knowledge-tabs button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
  });
});

document.querySelectorAll('.collection-row').forEach(row => {
  row.addEventListener('click', () => {
    document.querySelectorAll('.collection-row').forEach(item => item.classList.remove('active'));
    row.classList.add('active');
  });
});

const filterCards = (input, cards, empty, filter = 'all') => {
  const query = input.value.trim().toLowerCase();
  let visibleCount = 0;
  cards.forEach(card => {
    const matchesQuery = card.dataset.name.toLowerCase().includes(query);
    const matchesFilter = filter === 'all' || card.dataset.state === filter;
    card.hidden = !(matchesQuery && matchesFilter);
    if (!card.hidden) visibleCount += 1;
  });
  empty.hidden = visibleCount !== 0;
};

const pluginSearch = document.querySelector('#pluginSearch');
const pluginCards = document.querySelectorAll('.plugin-card');
const pluginEmpty = document.querySelector('#pluginEmpty');
let pluginFilter = 'all';

pluginSearch.addEventListener('input', () => filterCards(pluginSearch, pluginCards, pluginEmpty, pluginFilter));
document.querySelectorAll('[data-filter-group="plugins"] button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter-group="plugins"] button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    pluginFilter = button.dataset.filter;
    filterCards(pluginSearch, pluginCards, pluginEmpty, pluginFilter);
  });
});

pluginCards.forEach(card => {
  const toggle = card.querySelector('.toggle-switch');
  toggle.addEventListener('click', () => {
    const enabled = toggle.getAttribute('aria-checked') === 'true';
    toggle.setAttribute('aria-checked', String(!enabled));
    toggle.classList.toggle('on', !enabled);
    card.dataset.state = enabled ? 'disabled' : 'enabled';
    const status = card.querySelector('.status-text');
    status.classList.toggle('disabled', enabled);
    status.innerHTML = enabled ? '<i></i>已停用' : '<i></i>运行正常';
    filterCards(pluginSearch, pluginCards, pluginEmpty, pluginFilter);
  });
});

document.querySelectorAll('.plugin-detail-button').forEach(button => {
  button.addEventListener('click', () => {
    const pluginName = button.closest('.plugin-card').querySelector('strong').textContent;
    toast.textContent = `已打开 ${pluginName} 插件详情`;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 1800);
  });
});

const skillSearch = document.querySelector('#skillSearch');
const skillCards = document.querySelectorAll('.skill-card');
const skillEmpty = document.querySelector('#skillEmpty');
skillSearch.addEventListener('input', () => filterCards(skillSearch, skillCards, skillEmpty));

document.querySelectorAll('.preview-skill').forEach(button => {
  button.addEventListener('click', () => {
    const name = button.closest('.skill-card').querySelector('header strong').textContent;
    skillPreviewTitle.textContent = name;
    skillPreview.hidden = false;
  });
});

document.querySelectorAll('.use-skill').forEach(button => {
  button.addEventListener('click', () => {
    const name = button.closest('.skill-card').querySelector('header strong').textContent;
    navigate('tasks');
    textarea.value = `使用 ${name} 技能完成：`;
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  });
});

skillPreviewClose.addEventListener('click', () => {
  skillPreview.hidden = true;
});
skillPreview.addEventListener('click', event => {
  if (event.target === skillPreview) skillPreview.hidden = true;
});

const openSettings = () => {
  userMenu.hidden = true;
  userMenuButton.setAttribute('aria-expanded', 'false');
  settingsDialog.hidden = false;
};
settingsEntry.addEventListener('click', openSettings);
settingsClose.addEventListener('click', () => {
  settingsDialog.hidden = true;
});
settingsDialog.addEventListener('click', event => {
  if (event.target === settingsDialog) settingsDialog.hidden = true;
});

document.querySelectorAll('.settings-nav-item').forEach(button => {
  button.addEventListener('click', () => {
    const panel = button.dataset.settingsPanel;
    document.querySelectorAll('.settings-nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.settings-panel').forEach(item => {
      item.hidden = item.dataset.panel !== panel;
      item.classList.toggle('active', item.dataset.panel === panel);
    });
    button.classList.add('active');
    settingsPanelTitle.textContent = button.querySelector('span').textContent;
  });
});

document.querySelectorAll('.setting-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const enabled = toggle.getAttribute('aria-checked') === 'true';
    toggle.setAttribute('aria-checked', String(!enabled));
    toggle.classList.toggle('on', !enabled);
  });
});

document.querySelectorAll('.theme-option').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.theme-option').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
  });
});

const initialRoute = window.location.hash.slice(1);
navigate(contentViews[initialRoute] ? initialRoute : 'tasks');
