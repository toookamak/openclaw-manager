import { Bot } from 'grammy';
import { config } from '../config/env';
import { BotContext } from '../types/bot';
import { pendingGroupsRepo } from '../storage/repos/pending-groups-repo';
import { whitelistRepo } from '../storage/repos/whitelist-repo';

let botInstance: Bot<BotContext> | null = null;

export function initApprovalService(bot: Bot<BotContext>): void {
  botInstance = bot;
}

export const approvalService = {
  isWhitelisted(chatId: bigint): boolean {
    return whitelistRepo.isAllowed(chatId);
  },

  addWhitelist(chatId: bigint, chatType: string, chatTitle: string | null): void {
    whitelistRepo.add(chatId, chatType, chatTitle);
  },

  removeWhitelist(chatId: bigint): void {
    whitelistRepo.remove(chatId);
  },

  listWhitelist() {
    return whitelistRepo.list();
  },

  async requestApproval(chatId: bigint, chatTitle: string | null, requestedBy: bigint): Promise<string> {
    if (whitelistRepo.isAllowed(chatId)) {
      return '当前群已经在白名单中。';
    }

    if (pendingGroupsRepo.exists(chatId)) {
      return '当前群已经在待审批列表中。';
    }

    pendingGroupsRepo.add(chatId, chatTitle, requestedBy);

    if (botInstance) {
      try {
        await botInstance.api.sendMessage(
          Number(config.adminTelegramId),
          `**新的群授权请求**\n\n群名：${chatTitle ?? '未知'}\n群 ID：\`${chatId}\`\n请求人：\`${requestedBy}\`\n\n使用 /menu -> 访问控制 -> 待授权群 审批。`,
          { parse_mode: 'Markdown' }
        );
      } catch {
        // ignore send errors
      }
    }

    return '已提交授权申请，等待管理员审批。';
  },

  pendingGroups() {
    return pendingGroupsRepo.list();
  },

  approveGroup(chatId: bigint): void {
    const groups = pendingGroupsRepo.list();
    const group = groups.find(g => g.chat_id === Number(chatId));
    if (group) {
      whitelistRepo.add(BigInt(group.chat_id), 'group', group.chat_title);
      pendingGroupsRepo.remove(chatId);
    }
  },

  rejectGroup(chatId: bigint): void {
    pendingGroupsRepo.remove(chatId);
  },
};
