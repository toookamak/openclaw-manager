import { InlineKeyboard } from 'grammy';

export const menus = {
  mainMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('状态查看', 'menu:open:status-view')
      .text('服务控制', 'menu:open:service-control').row()
      .text('管理授权', 'menu:open:management').row()
      .text('连接管理', 'menu:open:connection').row();
  },

  statusViewMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('状态概览', 'status:run:overview')
      .text('完整状态', 'status:run:full').row()
      .text('深度状态', 'status:run:deep').row()
      .text('Gateway 健康', 'health:run:gateway')
      .text('全量健康', 'health:run:full').row()
      .text('最近异常', 'health:run:errors').row()
      .text('通道连通性', 'conn:run:channels')
      .text('Provider', 'conn:run:provider').row()
      .text('Usage', 'conn:run:usage').row()
      .text('最近日志', 'logs:run:recent')
      .text('错误摘要', 'logs:run:errors').row();
  },

  serviceControlMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('当前模型', 'model:run:current')
      .text('可用模型', 'model:run:list').row()
      .text('切换模型', 'model:run:set').row()
      .text('诊断', 'doctor:run:diagnose')
      .text('修复', 'doctor:run:repair_confirm').row()
      .text('任务状态', 'cron:run:status')
      .text('任务列表', 'cron:run:list').row()
      .text('创建备份', 'backup:run:create')
      .text('备份列表', 'backup:run:list').row()
      .text('重启 OpenClaw', 'restart:confirm:openclaw')
      .text('重启 Gateway', 'restart:confirm:gateway').row();
  },

  managementMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('配置摘要', 'settings:run:config')
      .text('连接状态', 'settings:run:connection').row()
      .text('OpenClaw 版本', 'settings:run:version')
      .text('状态图标开关', 'settings:run:emoji').row()
      .text('告警间隔', 'settings:run:alert_interval').row()
      .text('群授权状态', 'acl:run:status')
      .text('申请授权', 'acl:run:request').row()
      .text('待审批', 'acl:run:pending')
      .text('白名单', 'acl:run:whitelist').row()
      .text('允许当前群', 'acl:run:allow')
      .text('移除当前群', 'acl:run:remove').row()
      .text('审计日志', 'menu:open:audit').row();
  },

  statusMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('概览', 'status:run:overview')
      .text('完整', 'status:run:full').row()
      .text('深度', 'status:run:deep').row()
      .text('返回', 'menu:open:status-view').row();
  },

  healthMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('Gateway 健康', 'health:run:gateway')
      .text('全量健康', 'health:run:full').row()
      .text('最近异常', 'health:run:errors').row();
  },

  modelMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('当前模型', 'model:run:current')
      .text('可用模型', 'model:run:list').row()
      .text('切换默认模型', 'model:run:set').row()
      .text('返回', 'menu:open:service-control').row();
  },

  settingsMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('配置摘要', 'settings:run:config')
      .text('状态图标开关', 'settings:run:emoji').row()
      .text('连接状态', 'settings:run:connection')
      .text('告警间隔', 'settings:run:alert_interval').row()
      .text('OpenClaw 版本', 'settings:run:version').row()
      .text('返回', 'menu:open:management').row();
  },

  connectivityMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('通道连通性', 'conn:run:channels')
      .text('Provider 连通性', 'conn:run:provider').row()
      .text('Usage 状态', 'conn:run:usage').row();
  },

  doctorMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('诊断', 'doctor:run:diagnose')
      .text('自动修复', 'doctor:run:repair_confirm').row()
      .text('返回', 'menu:open:service-control').row();
  },

  cronMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('任务状态', 'cron:run:status')
      .text('任务列表', 'cron:run:list').row()
      .text('返回', 'menu:open:service-control').row();
  },

  cronJobsMenu(jobs: Array<{ id: string; name: string; enabled: boolean }>): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const job of jobs) {
      const state = job.enabled ? '开' : '关';
      kb.text(`[${state}] ${job.name}`, `cron:menu:${job.id}`).row();
    }
    kb.text('返回', 'menu:open:service-control').row();
    return kb;
  },

  cronJobMenu(jobId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('启用', `cron:confirm:enable:${jobId}`)
      .text('禁用', `cron:confirm:disable:${jobId}`).row()
      .text('立即执行', `cron:confirm:run:${jobId}`).row()
      .text('最近运行', `cron:run:lastrun:${jobId}`).row()
      .text('返回', 'menu:open:service-control').row();
  },

  logsMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('最近日志', 'logs:run:recent')
      .text('错误摘要', 'logs:run:errors').row();
  },

  backupMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('创建备份', 'backup:run:create')
      .text('备份列表', 'backup:run:list').row()
      .text('恢复备份', 'backup:run:restore').row()
      .text('返回', 'menu:open:service-control').row();
  },

  backupListMenu(archives: string[]): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const archive of archives.slice(0, 10)) {
      kb.text(archive.length > 25 ? archive.slice(0, 25) + '…' : archive, `backup:menu:${encodeURIComponent(archive)}`).row();
    }
    kb.text('返回', 'menu:open:service-control').row();
    return kb;
  },

  backupItemMenu(archive: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('校验', `backup:verify:${encodeURIComponent(archive)}`)
      .text('恢复', `backup:run:restore:${encodeURIComponent(archive)}`).row()
      .text('删除', `backup:delete:${encodeURIComponent(archive)}`).row()
      .text('返回', 'backup:run:list').row();
  },

  aclMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('当前群 ID', 'acl:run:chatid')
      .text('当前用户 ID', 'acl:run:userid').row()
      .text('当前群授权状态', 'acl:run:status').row()
      .text('申请授权当前群', 'acl:run:request').row()
      .text('待授权群', 'acl:run:pending')
      .text('白名单列表', 'acl:run:whitelist').row()
      .text('允许当前群', 'acl:run:allow')
      .text('移除当前群', 'acl:run:remove').row();
  },

  restartMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('重启 OpenClaw', 'restart:confirm:openclaw')
      .text('重启 Gateway', 'restart:confirm:gateway').row()
      .text('返回', 'menu:open:service-control').row();
  },

  confirmMenu(confirmData: string, cancelData: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('确认执行', confirmData)
      .text('取消', cancelData).row();
  },

  modelListMenu(models: string[]): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (let i = 0; i < models.length; i++) {
      kb.text(models[i], `model:confirm:set:${models[i]}`);
      if ((i + 1) % 2 === 0) kb.row();
    }
    kb.row().text('返回', 'menu:open:service-control');
    return kb;
  },

  pendingGroupsMenu(groups: Array<{ chat_id: number; chat_title: string | null }>): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const g of groups) {
      kb.text(`批准 ${g.chat_title ?? g.chat_id}`, `acl:approve:${g.chat_id}`)
        .text('拒绝', `acl:reject:${g.chat_id}`).row();
    }
    kb.text('返回', 'menu:open:management').row();
    return kb;
  },

  connectionSetupMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('本机', 'connect:setup:local')
      .text('Docker', 'connect:setup:docker').row()
      .text('HTTP 地址', 'connect:setup:http').row();
  },

  connectionStatusMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('重新发现', 'connect:rediscover')
      .text('重置连接', 'connect:reset').row()
      .text('返回', 'menu:open:main').row();
  },

  auditMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('最近操作', 'audit:run:recent')
      .text('失败记录', 'audit:run:errors').row()
      .text('返回', 'menu:open:management').row();
  },

  getMenuForScope(scope: string): InlineKeyboard {
    switch (scope) {
      case 'status-view': return this.statusViewMenu();
      case 'service-control': return this.serviceControlMenu();
      case 'management': return this.managementMenu();
      case 'status': return this.statusMenu();
      case 'health': return this.healthMenu();
      case 'model': return this.modelMenu();
      case 'settings': return this.settingsMenu();
      case 'connectivity': return this.connectivityMenu();
      case 'doctor': return this.doctorMenu();
      case 'cron': return this.cronMenu();
      case 'logs': return this.logsMenu();
      case 'backup': return this.backupMenu();
      case 'acl': return this.aclMenu();
      case 'restart': return this.restartMenu();
      case 'connection': return this.connectionStatusMenu();
      case 'audit': return this.auditMenu();
      default: return this.mainMenu();
    }
  },

  getTitleForScope(scope: string): string {
    switch (scope) {
      case 'main': return '菜单模式';
      case 'status-view': return '状态查看';
      case 'service-control': return '服务控制';
      case 'management': return '管理授权';
      case 'status': return '状态';
      case 'health': return '健康检查';
      case 'model': return '模型管理';
      case 'settings': return '系统设置';
      case 'connectivity': return '连通性';
      case 'doctor': return 'Doctor';
      case 'cron': return '定时任务';
      case 'logs': return '日志';
      case 'backup': return '备份';
      case 'acl': return '访问控制';
      case 'restart': return '重启';
      case 'connection': return '连接管理';
      case 'audit': return '审计日志';
      default: return '菜单';
    }
  },
};
