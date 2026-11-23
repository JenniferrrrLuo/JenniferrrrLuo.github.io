'use strict';
const $ = s => document.querySelector(s);
const make = (tag,text) => {const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const link = (text,href) => {const a=make('a',text);a.href=href;return a};
const clock = s => Math.floor(s/60)+':'+(s%60).toFixed(2).padStart(5,'0');
const slug = value => String(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const searchText = value => String(value).toLowerCase().replace(/[_/-]/g,' ');
const get = async path => {const r=await fetch(path);if(!r.ok)throw Error(path+' ('+r.status+')');return r.json()};
const showError = err => {const p=make('p',err.message);p.setAttribute('role','alert');$('main').prepend(p)};
const params = new URLSearchParams(location.search);
async function versions(){
 const nav=$('nav[data-release-id]'), select=nav.querySelector('select'), cat=await get('../versions.json');
 for(const x of cat.versions)if(x.id!==nav.dataset.releaseId)select.add(new Option(x.id+' · '+x.title,x.id));
 select.onchange=async()=>{
  const other=cat.versions.find(x=>x.id===select.value), key=nav.dataset.pageKey, page=other.pages[key];
  const dest=new URL('../'+other.id+'/'+(page||'index.html'),location.href);
  if(page&&location.hash&&(key==='demonstrations'||key==='home')){
   try{
    const id=decodeURIComponent(location.hash.slice(1)), target=await get(new URL('reader.json',dest));
    if(key==='home'){
     if(id==='api'||id==='limits'||target.interface.actions.some(a=>'action-'+a.name===id))dest.hash=id;
    }else{
     const source=await get('reader.json'), current=[...source.films,...source.unavailable].find(f=>f.id===id);
     const inputs=s=>s.input?.sha256||s.checkpoint_input?.sha256;
     const choices=[...target.films,...target.unavailable].filter(f=>!f.chapter_of&&!f.alternate_of);
     if(current){
      const matched=choices.filter(f=>inputs(current)&&inputs(f)===inputs(current));
      const same=matched.find(f=>current.movie&&f.movie?.sha256===current.movie.sha256);
      const equivalent=same||matched.find(f=>f.id===current.id)||(matched.length===1&&matched[0]);
      if(equivalent)dest.hash=equivalent.id;
      const t=new URLSearchParams(location.search).get('t');
      if(same&&t!==null&&Number.isFinite(Number(t)))dest.searchParams.set('t',t);
     }
    }
   }catch(error){showError(error);return}
  }
  location.assign(dest);
 };
}
function download(holder,text,ref){if(!ref)return;const a=link(text,ref.path);a.download=ref.path.split('/').pop();holder.append(a,document.createTextNode(' '))}
function fact(dl,key,value){if(value!==null&&value!==undefined&&value!=='')dl.append(make('dt',key),make('dd',String(value)))}
function heading(text,node){node.append(make('h3',text))}
function cueList(film,player,rows,isDialogue){
 const ul=make('ul'), listeners=[];
 for(const row of rows){
  const sec=row.frame/film.fps, li=make('li'), a=link(clock(sec),'?t='+sec.toFixed(4)+'#'+encodeURIComponent(film.id));a.className='time';
  a.onclick=e=>{e.preventDefault();player.currentTime=sec;history.replaceState(null,'',a.href)};
  li.append(a,document.createTextNode('  '+row.text));ul.append(li);listeners.push([sec,li]);
 }
 if(isDialogue){player.addEventListener('timeupdate',()=>listeners.forEach(([t,li],i)=>li.classList.toggle('dialogue-active',player.currentTime>=t&&player.currentTime<(listeners[i+1]?.[0]??player.duration))))}
 return ul;
}
function library(data){
 const listing=$('#case-list'), content=$('#demonstration'), query=$('#query'),kind=$('#kind'),type=$('#type');
 const all=[...data.films,...data.unavailable],items=all.filter(x=>!x.alternate_of&&!x.chapter_of);
 for(const k of [...new Set(items.flatMap(x=>x.tags))].filter(Boolean).sort())type.add(new Option(k,k));
 let current=null;
 function choose(row,t,move){
  if(row.chapter_of){const parent=all.find(f=>f.id===row.chapter_of);if(parent){choose(parent,(t||0)+row.source_first_frame/parent.fps,move);return}}
  current=row;listing.querySelectorAll('a').forEach(a=>a.setAttribute('aria-current',String(a.dataset.id===(row.alternate_of||row.id))));
  const old=content.querySelector('video');if(old){old.pause();old.removeAttribute('src');old.load()}
  content.replaceChildren();content.id='demonstration';
  const title=make('h2',row.title);title.tabIndex=-1;content.append(title);
  content.append(make('p',row.type_label));
  const primary=row.alternate_of?all.find(f=>f.id===row.alternate_of):row;
  if(primary.alternate_views?.length){
   const label=make('label','Recording view '),select=make('select');select.setAttribute('aria-label','Recording view');
   for(const id of [primary.id,...primary.alternate_views])select.add(new Option(id===primary.id?'Native picture':'Captioned picture',id));
   select.value=row.id;select.onchange=()=>{const group=all.find(f=>f.id===select.value),player=content.querySelector('video');const t=player?.currentTime??0;history.replaceState(null,'','?t='+t+'#'+group.id);choose(group,t,false)};
   label.append(select);content.append(label);
  }
  if(row.movie){
   const player=make('video');player.controls=true;player.playsInline=true;player.preload='metadata';player.src=row.movie.path;player.dataset.hash=row.movie.sha256;player.setAttribute('aria-label',row.title);content.append(player);
   if(t!==null&&Number.isFinite(t))player.addEventListener('loadedmetadata',()=>{player.currentTime=Math.max(0,Math.min(t,Math.max(0,player.duration-1/row.fps)))},{once:true});
   if(row.events.length){heading('Observable behavior',content);content.append(cueList(row,player,row.events,false))}
   if(row.phases?.length){const d=make('details');d.append(make('summary','Action timeline'),cueList(row,player,row.phases,false));content.append(d)}
   if(row.dialogue?.length){const d=make('details');d.open=true;d.append(make('summary','Dialogue'),cueList(row,player,row.dialogue,true));content.append(d)}
   if(row.communication?.length){
    const d=make('details');d.append(make('summary','Logged communication'));
    for(const record of row.communication){
     const text=[record.channel,record.role,record.visibility&&('visible to '+record.visibility),record.text].filter(Boolean).join(' · ');
     if(Number.isInteger(record.frame))d.append(cueList(row,player,[{frame:record.frame,text}],false));
     else d.append(make('p',text+' · '+(record.relation||'outside the recording')));
    }
    content.append(d);
   }
  }
  if(row.outcome){const p=make('p',row.outcome);if(!row.movie)p.className='reason';content.append(p)}
  if(row.control){const p=make('p');p.append(link(row.control.title,row.control.path));content.append(p)}
  if(row.earlier_recording){const p=make('p');p.append(link(row.earlier_recording.title,row.earlier_recording.path));content.append(p)}
  const files=make('p');files.className='tokens';download(files,'Exact recording input',row.input);download(files,'Checkpoint input',row.checkpoint_input);
  const supporting=[];
  for(const file of row.downloads||[]){
   if(file.title==='Runnable input with its assets'||/^Side .+ · exact input$/.test(file.title))download(files,file.title,file);
   else supporting.push(file);
  }
  if(files.childNodes.length)content.append(files);
  const details=make('details');details.append(make('summary','Evidence and limitations'));const dl=make('dl');
  fact(dl,row.movie?'Producing edition':'Requested edition',row.edition_id);
  if(row.movie)fact(dl,'Recording origin',row.kind==='historical_rerender'?'Historical rerender with this edition’s simulator':'Original publication-era recording');
  if(row.footage_type&&row.footage_type.toLowerCase()!==row.type_label.toLowerCase())fact(dl,'Receipt description',row.footage_type);
  fact(dl,'Recorded frames',row.frames);fact(dl,'Frames per second',row.fps);fact(dl,'Run',row.run_id);fact(dl,'Public run start',row.run_started);
  fact(dl,'Episode seed',row.seed);fact(dl,'Scene seed',row.scene_seed);
  if(row.side_profiles){for(const [side,profile] of Object.entries(row.side_profiles))fact(dl,'Side '+side+' profile',profile)}
  else if(row.profile)fact(dl,'Profile',row.profile);
  else if(row.movie)fact(dl,'Attachment profile','The recording input specifies no attachment profile.');
  fact(dl,'Recorded',row.recorded_at);
  for(const [key,value] of Object.entries(row.render_settings||{})){
   const label=key.replaceAll('_',' ');fact(dl,label[0].toUpperCase()+label.slice(1),Array.isArray(value)?value.join(' × '):value);
  }
  fact(dl,'Movie SHA-256',row.movie?.sha256);fact(dl,'Input SHA-256',row.input?.sha256);details.append(dl);
  for(const [k,v] of Object.entries(row.checks||{}))fact(dl,k.replaceAll('_',' '),typeof v==='boolean'?(v?'Yes':'No'):v);
  for(const text of row.limitations||[])details.append(make('p',text));
  for(const w of row.source_windows||[]){const p=make('p');p.append(link((w.side?'Side '+w.side+' · ':'')+'Source frames '+w.first+'–'+(w.past_last-1),w.source.path));details.append(p)}
  const proof=make('p');proof.className='tokens';download(proof,'Render receipt',row.receipt);download(proof,'Run and producer evidence',row.primary_receipt);download(proof,'Native recording',row.movie);
  for(const file of supporting)download(proof,file.title,file);
  if(proof.childNodes.length)details.append(proof);content.append(details);
  if(move)title.focus({preventScroll:true});
 }
 function filter(){
  const q=searchText(query.value).trim(), rows=items.filter(x=>(!q||searchText([x.title,x.id,...x.tags,...x.aliases].join(' ')).includes(q))&&(!kind.value||kind.value===(x.movie?'film':'gap'))&&(!type.value||x.tags.includes(type.value)));
  listing.replaceChildren();$('#result-count').textContent=rows.length+' of '+items.length;
  for(const row of rows){const li=make('li'),a=link(row.title,'#'+encodeURIComponent(row.id));a.dataset.id=row.id;a.setAttribute('aria-current',String(current?.id===row.id));a.onclick=e=>{e.preventDefault();const dest=new URL(location.href);dest.hash=row.id;dest.searchParams.delete('t');history.pushState(null,'',dest);choose(row,null,true)};li.append(a);listing.append(li)}
  if(!rows.length){content.replaceChildren(make('p','No matching demonstrations.'));current=null}
  else if(!rows.includes(current))choose(rows[0],null,false);
 }
 function route(){
  let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{ id=location.hash.slice(1)}
  const row=all.find(x=>x.id===id)||items.find(x=>x.aliases.includes(id));
  if(row){filter();if(row!==current || params.has('t')||new URLSearchParams(location.search).has('t'))choose(row,new URLSearchParams(location.search).has('t')?Number(new URLSearchParams(location.search).get('t')):null,false)}
  else filter();
 }
 if(params.has('legacy')){const p=make('p','The former section “'+params.get('legacy')+'” has no identifiable recording with a verified producer in this edition. The audit ledger retains its original page and evidence.');p.className='reason';$('main').insertBefore(p,$('.library'))}
 if(params.has('legacy_time')){const p=make('p','The original time link ('+params.get('legacy_time')+' s) belongs to a different recording clock. Select a verified cue below.');p.className='reason';$('main').insertBefore(p,$('.library'))}
 query.value=params.get('q')||'';if(params.has('type'))type.value=params.get('type');query.oninput=kind.onchange=type.onchange=filter;
 window.addEventListener('popstate',route);route();
}
versions().catch(showError);
if($('#demonstration'))get('reader.json').then(library).catch(showError);
