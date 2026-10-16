export type EmbeddedTrack={number:number;language?:string;name?:string;type:string;header?:string};
export type EmbeddedCue={text:string;time:number;duration:number;layer?:string;style?:string;name?:string;marginL?:string;marginR?:string;marginV?:string;effect?:string};
export type SubtitleMessage={kind:'tracks';tracks:EmbeddedTrack[]}|{kind:'cues';cues:{track:number;cue:EmbeddedCue}[]}|{kind:'font';data:Uint8Array}|{kind:'reset'}|{kind:'error'};
export function preferredSubtitle(tracks:EmbeddedTrack[]){
  const supported=tracks.filter(t=>['ass','ssa','utf8'].includes(t.type));
  // Do not silently select English when the source has no Portuguese track.
  const portuguese=supported.filter(t=>/^(por|pt)([-_]|$)/i.test(t.language||'')||/portugu[eê]s|brazil/i.test(t.name||''));
  return (portuguese.find(t=>!/\b(cc|sdh|forced|signs|songs)\b/i.test(t.name||''))||portuguese[0])?.number??-1;
}
export function subtitleLabel(track:EmbeddedTrack){const language=/^(por|pt)([-_]|$)/i.test(track.language||'')?'Português':track.language||`Faixa ${track.number}`;return `${track.name||language} · embutida`;}
export const defaultAssHeader=`[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Liberation Sans,36,&H00FFFFFF,&H000000FF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,30,30,32,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
export function assChunk(cue:EmbeddedCue,plain=false,readOrder=0){
  // Matroska ASS blocks omit times: libass processChunk accepts their separate
  // millisecond timestamps. Plain UTF-8 must not be interpreted as ASS markup.
  const text=plain?cue.text.replace(/\\/g,'\\\\').replace(/{/g,'\\{').replace(/\r?\n/g,'\\N'):cue.text;
  return `${readOrder},${cue.layer||0},${cue.style||'Default'},${cue.name||''},${cue.marginL||0},${cue.marginR||0},${cue.marginV||0},${cue.effect||''},${text}`;
}
