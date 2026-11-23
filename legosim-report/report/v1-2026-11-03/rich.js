(() => {
 'use strict';
 const nav=document.querySelector('nav.rich-navigation');
 if(nav){
  const select=nav.querySelector('select'),catalog=new URL(nav.dataset.catalog,location.href);
  fetch(catalog).then(r=>{if(!r.ok)throw Error('Edition catalog '+r.status);return r.json()}).then(data=>{
   for(const edition of data.versions)if(edition.id!==nav.dataset.releaseId)select.add(new Option(edition.id+' · '+edition.title,edition.id));
   select.addEventListener('change',()=>{
    const edition=data.versions.find(row=>row.id===select.value);if(!edition)return;
    const page=edition.pages[nav.dataset.pageKey];
    const dest=new URL(edition.id+'/'+(page||'index.html'),catalog);
    if(page&&location.hash)dest.hash=location.hash;
    location.assign(dest);
   });
  }).catch(()=>{select.disabled=true});
 }
 const seek=(video,frame)=>{
  const seconds=Number(frame)/Number(video.dataset.fps);
  if(!Number.isFinite(seconds)||seconds<0)return;
  const jump=()=>{video.pause();video.currentTime=Math.min(seconds,Math.max(0,video.duration-.001));video.focus({preventScroll:true})};
  if(video.readyState)jump();else{video.addEventListener('loadedmetadata',jump,{once:true});video.load()}
 };
 document.addEventListener('click',e=>{
  const link=e.target.closest?.('[data-native-seek]');if(!link||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;
  const video=document.getElementById(link.dataset.player);if(!video)return;
  e.preventDefault();seek(video,link.dataset.nativeSeek);
  const dest=new URL(location.href);dest.hash=video.closest('article[id]')?.id||video.id;
  dest.searchParams.set('t',(Number(link.dataset.nativeSeek)/Number(video.dataset.fps)).toFixed(5));
  history.replaceState(null,'',dest);
 },true);
 const start=()=>{
  if(!location.hash)return;
  const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const video=target?.matches('video')?target:target?.querySelector('video[data-fps]');
  const time=new URLSearchParams(location.search).get('t');
  if(time!==null&&video&&Number.isFinite(Number(time)))seek(video,Number(time)*Number(video.dataset.fps));
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
