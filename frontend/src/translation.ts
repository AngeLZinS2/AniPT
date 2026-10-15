export function translationSegments(text:string,maxBytes=400):string[]{
  const encoder=new TextEncoder();if(encoder.encode(text).length>6000)throw new Error('Sinopse muito longa para tradução automática. Guarde uma versão PT-BR pelo editor.');
  const parts:string[]=[];let part='';
  for(const word of text.trim().split(/\s+/)){
    if(encoder.encode(word).length>maxBytes){if(part){parts.push(part);part=''}let fragment='';for(const char of word){if(encoder.encode(fragment+char).length>maxBytes){parts.push(fragment);fragment=''}fragment+=char}part=fragment;continue;}
    if(encoder.encode(part?`${part} ${word}`:word).length>maxBytes){parts.push(part);part=word}else part=part?`${part} ${word}`:word;
  }if(part)parts.push(part);return parts;
}
export function translatedSegment(data:{responseStatus?:number|string;responseData?:{translatedText?:string};quotaFinished?:boolean}):string{
  const text=data.responseData?.translatedText?.trim();if(Number(data.responseStatus)!==200||data.quotaFinished||!text||/mymemory warning|quota|daily limit|query length limit/i.test(text))throw new Error('O serviço de tradução está indisponível ou atingiu seu limite. O original foi preservado.');return text;
}
