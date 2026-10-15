export function trailerUrls(trailer?:{id:string;site:string}|null){
  if(!trailer||! /^[a-zA-Z0-9_-]+$/.test(trailer.id))return null;
  if(trailer.site.toLowerCase()==='youtube')return {embed:`https://www.youtube-nocookie.com/embed/${trailer.id}?autoplay=0`,watch:`https://www.youtube.com/watch?v=${trailer.id}`};
  if(trailer.site.toLowerCase()==='dailymotion')return {embed:`https://www.dailymotion.com/embed/video/${trailer.id}`,watch:`https://www.dailymotion.com/video/${trailer.id}`};
  return null;
}
