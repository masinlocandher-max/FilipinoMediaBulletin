(() => {
 const clock=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true});
 const day=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'long',year:'numeric',month:'long',day:'numeric'});
 document.querySelectorAll('.js-now').forEach(el=>{el.textContent=clock.format(new Date())});
 document.querySelectorAll('.js-day').forEach(el=>{el.textContent=day.format(new Date())});
 const toggle=document.querySelector('[data-menu-toggle]'),menu=document.getElementById('editorial-mobile-menu');
 const close=()=>{if(!toggle||!menu)return;menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation')};
 if(toggle&&menu){toggle.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation')});menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));document.addEventListener('keydown',e=>{if(e.key==='Escape')close()})}
 const tabs=[...document.querySelectorAll('[data-section-tab]')],panels=[...document.querySelectorAll('[data-news-section]')];
 let current=location.hash==='#world'?'world':'philippines';
 function updateTabs(){tabs.forEach(t=>{const on=t.dataset.sectionTab===current;t.classList.toggle('active',on);t.setAttribute('aria-pressed',String(on))});panels.forEach(p=>{p.dataset.sectionActive=String(p.dataset.newsSection===current)})}
 if(tabs.length){tabs.forEach(t=>t.addEventListener('click',()=>{current=t.dataset.sectionTab;updateTabs()}));window.addEventListener('hashchange',()=>{if(['#world','#philippines'].includes(location.hash)){current=location.hash.slice(1);updateTabs()}});updateTabs()}
 const search=document.getElementById('archive-search');
 if(search){const rows=[...document.querySelectorAll('.archive-entry')],out=document.getElementById('search-count');const q=new URLSearchParams(location.search).get('q');if(q)search.value=q;const update=()=>{const query=search.value.toLocaleLowerCase().trim();let matches=0;rows.forEach(row=>{const yes=row.dataset.search.includes(query);row.hidden=!yes;if(yes)matches++});if(out)out.textContent=rows.length?matches+' of '+rows.length+' bulletins shown':'No bulletins published yet'};search.addEventListener('input',update);update()}
})();