// Small bounded EBML index reader. Media packets are decoded by matroska-subtitles.
type Element={id:number;start:number;data:number;end:number;size:number};
function vint(bytes:Uint8Array,at:number,id=false):{value:number;length:number}|undefined{
  const first=bytes[at];if(!first)return;let length=1,mask=128;while(!(first&mask)&&length<=8){length++;mask>>=1}if(length>8||at+length>bytes.length)return;
  let value=id?first:first&(mask-1);for(let i=1;i<length;i++)value=value*256+bytes[at+i];return {value,length};
}
function element(bytes:Uint8Array,at:number):Element|undefined{const id=vint(bytes,at,true);if(!id)return;const size=vint(bytes,at+id.length);if(!size)return;const data=at+id.length+size.length;return {id:id.value,start:at,data,end:data+size.value,size:size.value};}
function children(bytes:Uint8Array,start:number,end=bytes.length){const list:Element[]=[];for(let at=start;at<Math.min(end,bytes.length);){const item=element(bytes,at);if(!item)break;list.push(item);if(item.end<=at||!Number.isSafeInteger(item.end))break;at=item.end;}return list;}
function uint(bytes:Uint8Array,item:Element){if(item.end>bytes.length||item.size>7)return NaN;let n=0;for(let i=item.data;i<item.end;i++)n=n*256+bytes[i];return n;}
export function cuesLocation(header:Uint8Array):number|undefined{
  const segment=children(header,0).find(e=>e.id===0x18538067);if(!segment)return;
  for(const item of children(header,segment.data)){
    if(item.id===0x1c53bb6b)return item.start;
    if(item.id!==0x114d9b74||item.end>header.length)continue;
    for(const seek of children(header,item.data,item.end)){
      const fields=children(header,seek.data,seek.end),id=fields.find(e=>e.id===0x53ab),position=fields.find(e=>e.id===0x53ac);
      if(id&&position&&uint(header,id)===0x1c53bb6b){const offset=segment.data+uint(header,position);if(Number.isSafeInteger(offset)&&offset>=segment.data)return offset;}
    }
  }
}
export type CuePosition={time:number;offset:number};
export function readCues(bytes:Uint8Array,segmentOffset:number,scale=1):CuePosition[]{
  const cues=element(bytes,0);if(!cues||cues.id!==0x1c53bb6b||cues.end>bytes.length)return [];
  const result:CuePosition[]=[];
  for(const point of children(bytes,cues.data,cues.end)){
    const fields=children(bytes,point.data,point.end),time=fields.find(e=>e.id===0xb3);
    if(!time)continue;
    for(const positions of fields.filter(e=>e.id===0xb7)){
      const position=children(bytes,positions.data,positions.end).find(e=>e.id===0xf1);if(!position)continue;
      const offset=segmentOffset+uint(bytes,position),at=uint(bytes,time)*scale/1000;
      if(Number.isSafeInteger(offset)&&offset>=segmentOffset&&Number.isFinite(at))result.push({time:at,offset});
    }
  }return result.sort((a,b)=>a.time-b.time);
}
export function segmentDataOffset(header:Uint8Array){return children(header,0).find(e=>e.id===0x18538067)?.data;}
export function elementSize(bytes:Uint8Array){return element(bytes,0)?.end;}
export function seekPosition(index:CuePosition[],time:number){let found:CuePosition|undefined;for(const point of index){if(point.time>Math.max(0,time-12))break;found=point}return found;}
