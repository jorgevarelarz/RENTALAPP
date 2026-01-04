import Conversation from '../models/conversation.model';

export async function ensureDirectConversation(userA: string, userB: string) {
  const a = String(userA);
  const b = String(userB);
  const refId = [a, b].sort().join(':');
  let conv = await Conversation.findOne({ kind: 'direct', refId });
  if (conv) {
    const merged = Array.from(new Set([...(conv.participants || []), a, b]));
    if (merged.length !== (conv.participants || []).length) {
      conv.participants = merged;
      await conv.save();
    }
    return conv;
  }
  conv = await Conversation.create({
    kind: 'direct',
    refId,
    participants: [a, b],
    meta: { userIds: [a, b] },
    unread: {},
  });
  return conv;
}
