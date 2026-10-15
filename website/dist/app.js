const video=document.querySelector('#demo-video');
const playButton=document.querySelector('#play-demo');
const videoStatus=document.querySelector('#video-status');
playButton.addEventListener('click',async()=>{
  playButton.hidden=true;
  try{await video.play()}catch{playButton.hidden=false;videoStatus.textContent='Não foi possível iniciar o vídeo. Tente novamente usando os controles do player.'}
});
video.addEventListener('error',()=>{playButton.hidden=false;videoStatus.textContent='Não foi possível carregar a demonstração.'});
video.addEventListener('play',()=>{playButton.hidden=true;videoStatus.textContent='Demonstração em reprodução.'});
video.addEventListener('ended',()=>{playButton.hidden=false;videoStatus.textContent='Demonstração concluída.'});
if(video.autoplay){
  video.muted=true;
  video.play().then(()=>{playButton.hidden=true}).catch(()=>{
    playButton.hidden=false;
    videoStatus.textContent='Toque para assistir à demonstração.';
  });
}
const shots={
  catalog:{image:'assets/catalog.jpg',alt:'Tela real do catálogo AniBR, com filtros e capas de animes',label:'Explore o catálogo',index:'01 / 03'},
  details:{image:'assets/details.jpg',alt:'Tela real de detalhes de Jujutsu Kaisen no AniBR, com sinopse, trailer e temporadas',label:'Conheça cada obra',index:'02 / 03'},
  onboarding:{image:'assets/onboarding.jpg',alt:'Tela real de entrada no AniBR, com nome opcional e opção de continuar sem se identificar',label:'Entre do seu jeito',index:'03 / 03'}
};
const tabs=[...document.querySelectorAll('.feature-tab')];
function selectTab(tab){
  for(const item of tabs){const active=item===tab;item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1}
  const shot=shots[tab.dataset.shot];
  const image=document.querySelector('#feature-image');image.src=shot.image;image.alt=shot.alt;
  document.querySelector('#preview-label').textContent=shot.label;
  document.querySelector('#preview-index').textContent=shot.index;
  document.querySelector('#feature-panel').setAttribute('aria-labelledby',tab.id);
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>selectTab(tab));
  tab.addEventListener('keydown',event=>{
    let next=index;if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%tabs.length;
    else if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
    else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
    event.preventDefault();selectTab(tabs[next]);tabs[next].focus();
  });
});
