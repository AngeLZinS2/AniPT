export type ReleaseInfo={status:string;episodes:number|null;nextAiringEpisode:{episode:number;airingAt:number}|null};
export function releasedLimit(media:ReleaseInfo,latest:{episode:number;airingAt:number}|null,now:number):number {
  if(media.status==='NOT_YET_RELEASED')return 0;
  const total=media.episodes&&media.episodes>0?media.episodes:Infinity;
  if(media.status==='FINISHED')return Number.isFinite(total)?total:0;
  const past=latest&&latest.airingAt<=now?latest.episode:0;
  const next=media.nextAiringEpisode;
  const beforeNext=next&&next.airingAt>now?Math.max(0,next.episode-1):Infinity;
  // Missing airing data is not permission to publish the planned season total.
  return Math.max(0,Math.min(total,past,beforeNext));
}
