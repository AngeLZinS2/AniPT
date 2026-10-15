export type Schedule<T>={episode:number;airingAt:number;media:T&{id:number;isAdult?:boolean}};
// No lookback window: older episodes remain reachable through catalog pages.
export function confirmedSchedules<T>(entries:Schedule<T>[],cutoff:number):Schedule<T>[] {
  const seen=new Set<string>();return entries.filter(e=>{const key=`${e.media.id}:${e.episode}:${e.airingAt}`;if(!e.media?.id||e.media.isAdult||!Number.isFinite(e.episode)||e.episode<=0||!Number.isFinite(e.airingAt)||e.airingAt>cutoff||seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>b.airingAt-a.airingAt);
}
