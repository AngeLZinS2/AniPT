export type LocalProfile={version:1;completed:true;name:string};
const key='anibr-local-profile';
let session:LocalProfile|null=null;
export function cleanName(value:string){return value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim().replace(/\s+/g,' ').slice(0,40)}
export function localProfile():LocalProfile|null{
  if(session)return session;
  try{const value=JSON.parse(localStorage.getItem(key)||'null');return value?.version===1&&value.completed===true&&typeof value.name==='string'?{version:1,completed:true,name:cleanName(value.name)}:null}catch{return null}
}
export function saveLocalProfile(name:string):boolean{
  session={version:1,completed:true,name:cleanName(name)};
  try{localStorage.setItem(key,JSON.stringify(session));return true}catch{return false}
}
