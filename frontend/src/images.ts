const failed=new Map<string,number>();
export function imageCandidates(...urls:(string|undefined)[]):string[]{return [...new Set(urls.map(url=>url?.trim()||'').filter(Boolean))]}
export function imageFallback(img:HTMLImageElement,urls:(string|undefined)[]):void {
  const candidates=imageCandidates(...urls);
  let index=0;
  const next=()=>{
    while(index<candidates.length&&(failed.get(candidates[index])||0)>Date.now())index++;
    const url=candidates[index++];
    if(!url){img.hidden=true;img.parentElement?.classList.add('image-unavailable');return}
    img.hidden=false;img.parentElement?.classList.remove('image-unavailable');
    if(img.getAttribute('src')!==url)img.src=url;
  };
  img.onerror=()=>{const current=img.getAttribute('src');if(current)failed.set(current,Date.now()+300000);next()};
  next();
  // Images can fail before their event handler is attached after a render.
  if(img.complete&&img.naturalWidth===0)img.onerror(new Event('error'));
}
