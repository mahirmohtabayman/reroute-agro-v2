
/* =====================================================================
   UI helpers: image validation, demo-account photo, password recovery &
   change, collapsible sidebar. Clicks on [data-ui] are handled here so the
   main action table (A) stays as it was.
   ===================================================================== */

/* ---------- images ---------- */
const IMG_TYPES = ['image/jpeg','image/png','image/webp','image/gif'];
const IMG_MAX_MB = 10;
function imageError(f){
  if(!f) return 'ছবি পাওয়া যায়নি';
  if(!IMG_TYPES.includes(f.type)) return 'শুধু JPG, PNG, WebP বা GIF ছবি দেওয়া যাবে';
  if(f.size>IMG_MAX_MB*1024*1024) return `ছবি ${bd(IMG_MAX_MB)} MB-এর বেশি বড়, ছোট ছবি দিন`;
  return '';
}

/* Demo accounts are shared by every visitor, so their photo is kept only in this browser tab (sessionStorage). */
const isDemoUser = u => !!u && !String(u.id).startsWith('U');
const DEMO_PHOTO_KEY = id => 'reroute-demo-photo:'+id;
function demoPhoto(id){ try{ return sessionStorage.getItem(DEMO_PHOTO_KEY(id)); }catch(e){ return null; } }
function setDemoPhoto(id, data){
  try{ data?sessionStorage.setItem(DEMO_PHOTO_KEY(id),data):sessionStorage.removeItem(DEMO_PHOTO_KEY(id)); return true; }
  catch(e){ return false; }
}

/* ---------- account: photo controls & password change ---------- */
function photoControls(u){
  const demo=isDemoUser(u), local=demo&&demoPhoto(u.id), has=AC.photo||local||(!demo&&u.has_photo);
  return `<div class="photo-actions">
    <div class="row wrap-it" style="gap:8px">
      <label class="btn btn-line btn-sm">${ic('edit')} ${has?'ছবি বদলান':'ছবি দিন'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-act-change="ac-photo" hidden></label>
      ${AC.photo?`<button type="button" class="btn btn-soft btn-sm" data-ui="ac-photo-clear">${ic('x')} বাছাই বাতিল</button>`
        :local?`<button type="button" class="btn btn-soft btn-sm" data-ui="ac-photo-remove-local">${ic('x')} ছবি সরান</button>`
        :(!demo&&u.has_photo)?`<button type="button" class="btn btn-soft btn-sm btn-danger-text" data-ui="ac-photo-remove">${ic('x')} ছবি মুছুন</button>`:''}
    </div>
    <p class="muted xs" style="margin-top:6px">${AC.photo?'নতুন ছবি বাছা হয়েছে, এখনো সংরক্ষণ হয়নি। নিচের "সংরক্ষণ করুন" চাপুন।':`JPG, PNG, WebP বা GIF · ${bd(IMG_MAX_MB)} MB পর্যন্ত`}</p>
    ${demo?`<p class="note xs" style="margin-top:8px">ডেমো অ্যাকাউন্ট সবাই ব্যবহার করে, তাই ছবি সার্ভারে সংরক্ষণ হয় না। শুধু আপনার এই ব্রাউজার ট্যাবে দেখাবে।</p>`:''}
  </div>`;
}

let PWC={err:'',ok:false};
function pwPanel(){
  const u=me();
  if(!u||isDemoUser(u)) return '';
  return `<div class="panel" style="margin-top:14px">
    <h3>${ic('lock')} পাসওয়ার্ড বদলান</h3>
    <label class="field"><span>বর্তমান পাসওয়ার্ড</span><span class="pw-wrap"><input id="pwc-cur" type="password" autocomplete="current-password"><button type="button" class="pw-eye" data-act="pw-toggle" data-for="pwc-cur" aria-label="পাসওয়ার্ড দেখুন">${ic('eye')}</button></span></label>
    <div class="grid2 tight">
      <label class="field"><span>নতুন পাসওয়ার্ড</span><span class="pw-wrap"><input id="pwc-new" type="password" autocomplete="new-password" placeholder="অন্তত ৬ অক্ষর"><button type="button" class="pw-eye" data-act="pw-toggle" data-for="pwc-new" aria-label="পাসওয়ার্ড দেখুন">${ic('eye')}</button></span></label>
      <label class="field"><span>নতুন পাসওয়ার্ড আবার দিন</span><span class="pw-wrap"><input id="pwc-confirm" type="password" autocomplete="new-password"><button type="button" class="pw-eye" data-act="pw-toggle" data-for="pwc-confirm" aria-label="পাসওয়ার্ড দেখুন">${ic('eye')}</button></span></label>
    </div>
    ${PWC.err?`<p class="form-error" role="alert">${esc(PWC.err)}</p>`:''}
    ${PWC.ok?`<p class="good sm" role="status" style="margin-top:14px">পাসওয়ার্ড বদলানো হয়েছে</p>`:''}
    <button type="button" class="btn btn-green" style="margin-top:14px" data-ui="pw-change">পাসওয়ার্ড বদলান</button>
  </div>`;
}

/* ---------- forgot password (operator-assisted: no SMS gateway yet) ---------- */
function drawForgot(state={}){
  modal(`<div class="body">
    <h2>${ic('lock')} পাসওয়ার্ড ভুলে গেছেন?</h2>
    ${state.done
      ?`<p class="good" role="status" style="margin-top:14px">${esc(state.done)}</p>
        <p class="muted sm" style="margin-top:12px">SMS দিয়ে স্বয়ংক্রিয় রিসেট এখনো চালু হয়নি। অস্থায়ী পাসওয়ার্ড দিয়ে লগ ইন করে অ্যাকাউন্ট পাতা থেকে নতুন পাসওয়ার্ড দিন।</p>
        <button type="button" class="btn btn-green btn-wide" style="margin-top:16px" data-act="close">ঠিক আছে</button>`
      :`<p class="muted sm" style="margin-top:8px">অ্যাকাউন্টের মোবাইল নম্বর দিন। Reroute অপারেশন টিম ফোন করে আপনার পরিচয় যাচাই করবে, তারপর একটি অস্থায়ী পাসওয়ার্ড দেবে।</p>
        <label class="field${state.err?' err':''}"><span>মোবাইল নম্বর</span><input id="fp-phone" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" value="${esc(state.phone||LG.phone||'')}" ${state.err?'aria-invalid="true" aria-describedby="fp-err"':''}></label>
        ${state.err?`<p class="form-error" id="fp-err" role="alert">${esc(state.err)}</p>`:''}
        <button type="button" class="btn btn-green btn-wide" style="margin-top:16px" data-ui="forgot-send">অনুরোধ পাঠান</button>`}
  </div>`);
  applyLanguage($('#modal'));
  const f=$('#fp-phone'); if(f) f.focus();
}

/* ---------- collapsible sidebar / drawer ---------- */
const SIDE_KEY='reroute-side-compact';
const sideIsDrawer=()=>window.matchMedia('(max-width:1023px)').matches;
/* aria-expanded of the menu button: drawer open on small screens, not compact on desktop */
const sideExpanded=()=>String(sideIsDrawer()?document.body.classList.contains('side-open'):!document.body.classList.contains('side-compact'));
function syncSideBtn(){ const b=document.querySelector('[data-ui="side-toggle"]'); if(b) b.setAttribute('aria-expanded',sideExpanded()); }
function setDrawer(open){
  document.body.classList.toggle('side-open',open);
  const b=document.querySelector('[data-ui="side-toggle"]');
  if(b) b.setAttribute('aria-expanded',String(open));
  if(open){ const a=document.querySelector('#tnav a'); if(a) a.focus(); }
}
function toggleSide(){
  if(sideIsDrawer()){ setDrawer(!document.body.classList.contains('side-open')); return; }
  const compact=!document.body.classList.contains('side-compact');
  document.body.classList.add('side-anim');
  document.body.classList.toggle('side-compact',compact);
  clearTimeout(toggleSide.t); toggleSide.t=setTimeout(()=>document.body.classList.remove('side-anim'),400);
  try{ localStorage.setItem(SIDE_KEY,compact?'1':'0'); }catch(e){}
  const b=document.querySelector('[data-ui="side-toggle"]');
  if(b) b.setAttribute('aria-expanded',String(!compact));
}
try{ if(localStorage.getItem(SIDE_KEY)==='1') document.body.classList.add('side-compact'); }catch(e){}
window.matchMedia('(max-width:1023px)').addEventListener('change',()=>{ document.body.classList.remove('side-open'); syncSideBtn(); });
window.addEventListener('hashchange',()=>{ if(document.body.classList.contains('side-open')) setDrawer(false); });
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.body.classList.contains('side-open')){
    setDrawer(false);
    const b=document.querySelector('[data-ui="side-toggle"]'); if(b) b.focus();
  }
});
/* the drawer's backdrop is body::before, so any click outside the drawer closes it */
document.addEventListener('click',e=>{
  if(document.body.classList.contains('side-open')&&!e.target.closest('#tnav')&&!e.target.closest('[data-ui="side-toggle"]')) setDrawer(false);
});

/* ---------- [data-ui] actions ---------- */
const UI = {
  'side-toggle':()=>toggleSide(),

  'ac-photo-clear':()=>{ AC.photo=null; render(); },

  'ac-photo-remove-local':()=>{ setDemoPhoto(me().id,null); render(); toast('ছবি সরানো হয়েছে (শুধু এই ব্রাউজারে)','info'); },

  'ac-photo-remove':async()=>{
    if(!await confirmBox({title:'প্রোফাইল ছবি মুছবেন?',body:'সংরক্ষিত ছবিটি মুছে যাবে। পরে আবার নতুন ছবি দেওয়া যাবে।',ok:'হ্যাঁ, মুছুন',danger:true})) return;
    await api('/me','POST',{remove_photo:true});
    await refresh();
    toast('প্রোফাইল ছবি মুছে ফেলা হয়েছে');
  },

  'pw-change':async()=>{
    const cur=$('#pwc-cur').value, nw=$('#pwc-new').value, cf=$('#pwc-confirm').value;
    PWC={err:'',ok:false};
    if(!cur) PWC.err='বর্তমান পাসওয়ার্ড দিন';
    else if(nw.length<6) PWC.err='নতুন পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে';
    else if(nw!==cf) PWC.err='দুটো পাসওয়ার্ড মিলছে না';
    if(PWC.err){ render(); return; }
    try{ await api('/me/password','POST',{current_password:cur,new_password:nw,confirm_password:cf}); }
    catch(e){ PWC.err=e.message||'পাসওয়ার্ড বদলানো যায়নি'; render(); return; }
    PWC={err:'',ok:true};
    render();
    toast('পাসওয়ার্ড বদলানো হয়েছে');
  },

  forgot:()=>drawForgot(),

  'forgot-send':async()=>{
    const phone=bdPhone($('#fp-phone').value);
    if(!/^01\d{9}$/.test(phone)){ drawForgot({phone,err:'০১ দিয়ে শুরু ১১ সংখ্যার মোবাইল নম্বর দিন'}); return; }
    let r;
    try{ r=await api('/password/forgot','POST',{phone}); }
    catch(e){ drawForgot({phone,err:e.message||'অনুরোধ পাঠানো যায়নি, আবার চেষ্টা করুন'}); return; }
    drawForgot({done:r.message});
  },

  'au-reset':async d=>{
    if(!await confirmBox({title:'অস্থায়ী পাসওয়ার্ড দেবেন?',
      body:'আগে ব্যবহারকারীকে তাঁর নিবন্ধিত নম্বরে ফোন করে পরিচয় নিশ্চিত করুন। নতুন পাসওয়ার্ড শুধু একবার এখানে দেখাবে; পুরনো পাসওয়ার্ড আর কাজ করবে না।',
      ok:'পাসওয়ার্ড তৈরি করুন',danger:true})) return;
    const r=await api(`/admin/users/${d.id}/reset-password`,'POST');
    modal(`<div class="body"><h2>${ic('lock')} অস্থায়ী পাসওয়ার্ড</h2>
      <p class="muted sm" style="margin-top:8px">ফোনে ব্যবহারকারীকে জানান। এই পাসওয়ার্ড আর কোথাও দেখানো বা সংরক্ষণ হবে না।</p>
      <div class="otp-code" data-i18n-skip style="margin:16px 0;letter-spacing:.15em">${esc(r.temp_password)}</div>
      <p class="warn sm">লগ ইনের পর ব্যবহারকারী অ্যাকাউন্ট পাতা থেকে নিজের নতুন পাসওয়ার্ড দেবেন।</p>
      <button type="button" class="btn btn-green btn-wide" style="margin-top:16px" data-act="close">হয়ে গেছে</button></div>`);
    applyLanguage($('#modal'));
  }
};

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-ui]');
  if(!el) return;
  const fn=UI[el.dataset.ui];
  if(!fn) return;
  e.preventDefault();
  if(el.dataset.busy) return;
  el.dataset.busy='1';
  Promise.resolve(fn(el.dataset,el)).catch(()=>{}).finally(()=>{ delete el.dataset.busy; });
});

document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.id==='fp-phone'){ e.preventDefault(); const b=document.querySelector('[data-ui="forgot-send"]'); if(b) b.click(); }
});
