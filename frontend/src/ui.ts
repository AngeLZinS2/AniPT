export const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function activateDialog(element:HTMLElement,name:string,onClose:()=>void){
  const origin=document.activeElement as HTMLElement|null;
  element.setAttribute('role','dialog');element.setAttribute('aria-modal','true');element.setAttribute('aria-label',name);element.tabIndex=-1;
  const siblings=Array.from(document.body.children).filter((child):child is HTMLElement=>child instanceof HTMLElement&&child!==element&&!child.contains(element));
  const old=siblings.map(s=>s.inert);siblings.forEach(s=>s.inert=true);
  const focusable=()=>Array.from(element.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex="0"],video')).filter(el=>!el.hasAttribute('disabled')&&!el.hidden&&el.getClientRects().length>0);
  const keys=(event:KeyboardEvent)=>{if(event.key==='Tab'){const list=focusable(),index=list.indexOf(document.activeElement as HTMLElement);if(!list.length){event.preventDefault();element.focus()}else if(event.shiftKey&&(index<=0)){event.preventDefault();list.at(-1)!.focus()}else if(!event.shiftKey&&(index===list.length-1||index<0)){event.preventDefault();list[0].focus()}}else if(event.key==='Escape'&&!document.fullscreenElement){event.preventDefault();onClose();}};
  element.addEventListener('keydown',keys);requestAnimationFrame(()=>{if(element.isConnected)(focusable()[0]||element).focus()});
  let restored=false;
  return ()=>{if(restored)return;restored=true;element.removeEventListener('keydown',keys);siblings.forEach((s,i)=>s.inert=old[i]);if(origin?.isConnected)origin.focus();};
}
export function downloadJson(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
