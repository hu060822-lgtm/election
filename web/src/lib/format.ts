export const pct = (n: number, d: number, digits = 0) => (d ? `${((n / d) * 100).toFixed(digits)}%` : '—');
export const fmt = (n: number) => n.toLocaleString('zh-TW');

export function relTime(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return '剛剛';
  if (s < 3600) return `${Math.round(s / 60)} 分鐘前`;
  if (s < 86400) return `${Math.round(s / 3600)} 小時前`;
  return `${Math.round(s / 86400)} 天前`;
}

export const dateTW = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const STATUS_LABEL: Record<string, { label: string; tone: string; hint: string }> = {
  official: { label: '正式候選人', tone: 'text-electric-glow bg-electric/15 ring-electric/40', hint: '已列入中選會候選人名單公告' },
  registered: { label: '已登記・審定合格', tone: 'text-electric-glow bg-electric/10 ring-electric/30', hint: '已完成參選登記並經中選會資格審定，正式名單公告前' },
  potential: { label: '可能參選', tone: 'text-gold bg-gold/10 ring-gold/30', hint: '有參選意向或報導，尚未登記' },
  unconfirmed: { label: '未確認', tone: 'text-text-3 bg-white/5 ring-white/10', hint: '資料尚待查證' },
  withdrawn: { label: '已退選', tone: 'text-signal bg-signal/10 ring-signal/30', hint: '已退出選舉，無法再被選擇' },
};

export const KIND_LABEL = { predict: '看好度', support: '支持度' } as const;
export const KIND_QUESTION = { predict: '我看好誰當選？', support: '我希望誰當選？' } as const;
