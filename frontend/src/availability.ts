// Check a few episodes at a time; never promote catalog metadata to availability.
export async function checkAvailability<T>(items:T[],check:(item:T)=>Promise<boolean>,update:(available:T[],checked:number)=>void,cancelled:()=>boolean=()=>false,concurrency=3):Promise<T[]> {
  const available=new Set<T>();let cursor=0,checked=0;
  await Promise.all(Array.from({length:Math.min(items.length,Math.max(1,concurrency))},async()=>{
    while(cursor<items.length&&!cancelled()){
      const item=items[cursor++];let playable=false;
      try{playable=await check(item)}catch{/* An unavailable source is not a playable episode. */}
      if(cancelled())return;
      if(playable)available.add(item);checked++;
      update(items.filter(item=>available.has(item)),checked);
    }
  }));
  return items.filter(item=>available.has(item));
}
