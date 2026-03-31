import { InlineKeyboard } from 'grammy';

export const menus = {
  mainMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('状态', 'menu:open:status')
      .text('健康检查', 'menu:open:health').row()
      .text('模型', 'menu:open:model')
      .text('设置', 'menu:open:settings').row()
      .text('连通性', 'menu:open:connectivity')
      .text('Doctor', 'menu:open:doctor').row()
      .text('定时任务', 'menu:open:cron')
      .text('日志', 'menu:open:logs').row()
      .text('备份', 'menu:open:backup')
      .text('访问控制', 'menu:open:acl').row()
      .text('重启', 'menu:open:restart').row();
  },

  statusMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('概览', 'status:run:overview')
      .text('完整', 'status:run:full').row()
      .text('深度', 'status:run:deep').row()
      .text('返回', 'menu:open:main').row();
  },

  healthMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('Gateway 健康', 'health:run:gateway')
      .text('全量健康', 'health:run:full').row()
      .text('最近异常', 'health:run:errors').row()
      .text('返回', 'menu:open:main').row();
  },

  modelMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('当前模型', 'model:run:current')
      .text('可用模型', 'model:run:list').row()
      .text('切换默认模型', 'model:run:set').row()
      .text('返回', 'menu:open:main').row();
  },

  settingsMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('配置摘要', 'settings:run:config')
      .text('状态图标开关', 'settings:run:emoji').row()
      .text('返回', 'menu:open:main').row();
  },

  connectivityMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('通道连通性', 'conn:run:channels')
      .text('Provider 连通性', 'conn:run:provider').row()
      .text('Usage 状态', 'conn:run:usage').row()
      .text('返回', 'menu:open:main').row();
  },

  doctorMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('诊断', 'doctor:run:diagnose')
      .text('自动修复', 'doctor:run:repair_confirm').row()
      .text('返回', 'menu:open:main').row();
  },

  cronMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('任务状态', 'cron:run:status')
      .text('任务列表', 'cron:run:list').row()
      .text('返回', 'menu:open:main').row();
  },

  cronJobsMenu(jobs: Array<{ id: string; name: string; enabled: boolean }>): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const job of jobs) {
      const state = job.enabled ? '开' : '关';
      kb.text(`[${state}] ${job.name}`, `cron:menu:${job.id}`).row();
    }
    kb.text('返回', 'menu:open:cron').row();
    return kb;
  },

  cronJobMenu(jobId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('启用', `cron:confirm:enable:${jobId}`)
      .text('禁用', `cron:confirm:disable:${jobId}`).row()
      .text('立即执行', `cron:confirm:run:${jobId}`).row()
      .text('最近运行', `cron:run:lastrun:${jobId}`).row()
      .text('返回', 'cron:run:list').row();
  },

  logsMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('最近日志', 'logs:run:recent')
      .text('错误摘要', 'logs:run:errors').row()
      .text('返回', 'menu:open:main').row();
  },

  backupMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('创建备份', 'backup:run:create')
      .text('备份列表', 'backup:run:list').row()
      .text('返回', 'menu:open:main').row();
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
      .text('移除当前群', 'acl:run:remove').row()
      .text('返回', 'menu:open:main').row();
  },

  restartMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('重启 OpenClaw', 'restart:confirm:openclaw')
      .text('重启 Gateway', 'restart:confirm:gateway').row()
      .text('返回', 'menu:open:main').row();
  },

  confirmMenu(scope: string, action: string, arg: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('确认执行', `${scope}:${action}:${arg}`)
      .text('取消', 'menu:open:main').row();
  },

  modelListMenu(models: string[]): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (let i = 0; i < models.length; i++) {
      kb.text(models[i], `model:confirm:set:${models[i]}`);
      if ((i + 1) % 2 === 0) kb.row();
    }
    kb.row().text('返回', 'menu:open:model');
    return kb;
  },

  pendingGroupsMenu(groups: Array<{ chat_id: number; chat_title: string | null }>): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const g of groups) {
      kb.text(`批准 ${g.chat_title ?? g.chat_id}`, `acl:approve:${g.chat_id}`)
        .text('拒绝', `acl:reject:${g.chat_id}`).row();
    }
    kb.text('返回', 'menu:open:acl').row();
    return kb;
  },

  getMenuForScope(scope: string): InlineKeyboard {
    switch (scope) {
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
      default: return this.mainMenu();
    }
  },
};
