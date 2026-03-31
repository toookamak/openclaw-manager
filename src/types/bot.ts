import { Context } from 'grammy';

export interface SessionData {
  pendingAction?: {
    scope: string;
    action: string;
    arg?: string;
    expiresAt: number;
  };
}

export type BotContext = Context & {
  session: SessionData;
};
