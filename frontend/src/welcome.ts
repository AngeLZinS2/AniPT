import {helloMarkup} from './welcome-hello';
import {mountWelcomeReels} from './welcome-reels';
import './welcome.css';
import {activateDialog} from './ui';
import {localProfile,saveLocalProfile} from './profile';

export async function welcome(force=false):Promise<void>{
  if(!force&&localProfile())return;
  return new Promise(resolve=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const overlay=document.createElement('div');overlay.className='welcome';overlay.dataset.step='hello';overlay.dataset.motion=reduced?'reduced':'full';
    overlay.innerHTML=`<div class="welcome-atmosphere" aria-hidden="true"><div class="welcome-aura aura-one"></div><div class="welcome-aura aura-two"></div><div class="welcome-orbit"></div><div class="welcome-grid"></div>${Array.from({length:12},(_,i)=>`<i style="--star:${i}"></i>`).join('')}</div><header class="welcome-header"><div class="welcome-brand"><img src="/anibr-icon.png" alt=""/><strong>AniBR</strong></div><span>UM NOVO COMEÇO</span><button type="button" class="welcome-skip-intro">Pular introdução ↗</button></header><main class="welcome-scene"><section class="welcome-intro"><p class="welcome-eyebrow">QUE BOM TER VOCÊ AQUI</p><h1>${helloMarkup}</h1><p>Uma nova história está prestes a começar.</p><button type="button" class="welcome-begin">Vamos começar <span aria-hidden="true">→</span></button></section><section class="welcome-setup" hidden><div class="welcome-story"><span class="welcome-eyebrow">SEU UNIVERSO. SEU RITMO.</span><h2>Toda grande <br/>história tem <br/><em>um começo.</em></h2><p>Encontre novas histórias.<br/>Volte para as suas favoritas.<br/>Sinta-se em casa.</p><div class="welcome-story-line" aria-hidden="true"><span></span> FEITO PARA QUEM AMA ANIME</div></div><form class="welcome-card"><span class="welcome-card-index">01 <span>/ DO SEU JEITO</span></span><h2>Qual é o seu nome?</h2><p>Ou como você gosta de ser chamado.</p><label for="welcome-name">Seu nome <span>opcional</span></label><div class="welcome-input-wrap"><input id="welcome-name" name="name" maxlength="40" placeholder="Como podemos te chamar?" autocomplete="off" spellcheck="false"/><span aria-hidden="true">✦</span></div><div class="welcome-privacy"><span aria-hidden="true">◇</span><p>Não se preocupe, é tudo salvo localmente.<small>Seu nome fica só neste dispositivo. Sem conta, sem cadastro.</small></p></div><button type="submit" class="welcome-continue"><span>Continuar <b aria-hidden="true">→</b></span></button><button type="button" class="welcome-anonymous">Continuar sem me identificar</button><p class="welcome-card-note">Você pode mudar isso nas configurações.</p></form></section><section class="welcome-finale" hidden><div class="welcome-final-mark"><img src="/anibr-icon.png" alt=""/></div><p class="welcome-eyebrow">O PRÓXIMO CAPÍTULO É SEU</p><h2></h2><p class="welcome-final-copy">Seu lugar entre tantas histórias.</p><p class="welcome-storage-note" role="status"></p><button type="button" class="welcome-continue welcome-enter"><span>Explorar AniBR <b aria-hidden="true">→</b></span></button></section></main><footer class="welcome-footer"><span>DESENVOLVIDO POR ANGELO NERI</span><div class="welcome-steps" aria-label="Etapa da apresentação"><i class="active"></i><i></i><i></i></div><span>ANIME É SÓ O COMEÇO.</span></footer>`;
    document.body.appendChild(overlay);document.body.classList.add('welcome-open');
    let closed=false;let stopReels=()=>{};
    const intro=overlay.querySelector<HTMLElement>('.welcome-intro')!,setup=overlay.querySelector<HTMLElement>('.welcome-setup')!,finale=overlay.querySelector<HTMLElement>('.welcome-finale')!,input=overlay.querySelector<HTMLInputElement>('input')!;
    if(force)input.value=localProfile()?.name||'';
    const dots=Array.from(overlay.querySelectorAll<HTMLElement>('.welcome-steps i'));
    const close=()=>{if(closed)return;closed=true;release();overlay.remove();document.body.classList.remove('welcome-open');stopReels();resolve()};
    const showForm=()=>{if(overlay.dataset.step!=='hello')return;overlay.dataset.step='name';stopReels();intro.hidden=true;setup.hidden=false;dots.forEach((dot,i)=>dot.classList.toggle('active',i===1));overlay.querySelector<HTMLElement>('.welcome-skip-intro')!.hidden=true;requestAnimationFrame(()=>input.focus())};
    const release=activateDialog(overlay,'Boas-vindas ao AniBR',()=>{if(force)close();else if(overlay.dataset.step==='hello')showForm()});
    overlay.querySelector<HTMLButtonElement>('.welcome-begin')!.onclick=showForm;overlay.querySelector<HTMLButtonElement>('.welcome-skip-intro')!.onclick=showForm;
    const complete=(name:string)=>{if(overlay.dataset.step!=='name')return;const saved=saveLocalProfile(name);stopReels();overlay.dataset.step='done';setup.hidden=true;finale.hidden=false;dots.forEach((dot,i)=>dot.classList.toggle('active',i===2));finale.querySelector('h2')!.textContent=localProfile()?.name?`Bem-vindo, ${localProfile()!.name}.`:'Bem-vindo ao seu universo.';if(!saved)finale.querySelector('.welcome-storage-note')!.textContent='O armazenamento está indisponível. Sua escolha vale nesta sessão.';requestAnimationFrame(()=>finale.querySelector<HTMLButtonElement>('button')!.focus())};
    overlay.querySelector<HTMLFormElement>('form')!.onsubmit=e=>{e.preventDefault();complete(input.value)};
    overlay.querySelector<HTMLButtonElement>('.welcome-anonymous')!.onclick=()=>complete('');
    overlay.querySelector<HTMLButtonElement>('.welcome-enter')!.onclick=close;
    if(force){const cancel=document.createElement('button');cancel.className='welcome-replay-close';cancel.textContent='Voltar ao app';cancel.onclick=close;overlay.querySelector('header')!.appendChild(cancel)}
    overlay.classList.add('welcome-video-reveal');
    const dispose=mountWelcomeReels(overlay,reduced);stopReels=()=>{dispose();stopReels=()=>{}};
    if(reduced){
      const poster=document.createElement('img');poster.className='welcome-reduced-poster';poster.src='/media/welcome-mosaic.jpg';poster.alt='';poster.setAttribute('aria-hidden','true');overlay.prepend(poster);
      const choice=document.createElement('div');choice.className='welcome-motion-choice';
      const note=document.createElement('p');note.textContent='Movimento reduzido ativado no dispositivo.';
      const enable=document.createElement('button');enable.type='button';enable.textContent='Ativar animações e mosaico';
      enable.onclick=()=>{overlay.dataset.motion='full';poster.remove();choice.remove();const dispose=mountWelcomeReels(overlay,false);stopReels=()=>{dispose();stopReels=()=>{}};overlay.querySelector<HTMLButtonElement>('.welcome-begin')!.focus()};
      choice.append(note,enable);intro.append(choice);
    }
  });
}
