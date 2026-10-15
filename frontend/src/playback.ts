export function progressPercent(timestamp:number,duration=0,completed=false):number|undefined {
  if(completed)return 100;
  if(!Number.isFinite(timestamp)||!Number.isFinite(duration)||duration<=0)return undefined;
  return Math.max(0,Math.min(100,Math.floor(100*timestamp/duration)));
}
export function serverKey(stream:{url:string;source:string;quality:string;torrent_file_index?:number|null}):string {
  const url=new URL(stream.url),key=`${stream.source}|${url.protocol==='magnet:'?`${url.searchParams.get('xt')}|${stream.torrent_file_index??''}`:`${url.origin}${url.pathname}`}`;
  let hash=2166136261;for(let i=0;i<key.length;i++){hash^=key.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return (hash>>>0).toString(16);
}
