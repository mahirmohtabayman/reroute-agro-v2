/* =====================================================================
   Router
   ===================================================================== */
function parts(){ return (location.hash||'#/').split('?')[0].replace(/^#\/?/,'').split('/'); }
function routeBase(){ const p=parts(); return '#/'+p[0]+(p[0]==='admin'&&p[1]?'/'+p[1]:''); }

let AFTER_NAV=null;

function closeSheet(){
  $('#sheet').classList.remove('on');
  $('#scrim').classList.remove('on');
}

function go(h, then){
  if(location.hash===h){
    render();
    if(then) then();
  }
  else{
    AFTER_NAV=then||null;
    location.hash=h;
  }
}

function render(){
  const p=parts(), u=me();
  let html='';

  const needT=()=>{
    if(!u){
      go('#/login');
      return false;
    }

    if(u.role==='admin'){
      go('#/admin');
      return false;
    }

    return true;
  };

  const needA=()=>{
    if(!u||u.role!=='admin'){
      go(u?'#/home':'#/login');
      return false;
    }

    return true;
  };

  switch(p[0]){
    case '':
      if(u){
        go(u.role==='admin'?'#/admin':'#/home');
        return;
      }

      html=V.home();
      break;

    case 'login':
      html=V.login();
      break;

    case 'register':
      html=V.register();
      break;

    case 'market':
      html=V.market();
      break;

    case 'listing':
      html=V.listing(p[1]);
      break;

    case 'u':
      html=V.profile(p[1]);
      break;

    case 'ai':
      html=V.ai();
      break;

    case 'transport':
      if(u&&u.role==='admin'){
        go('#/admin/bookings');
        return;
      }

      html=V.transport();
      break;

    case 'home':
      if(!needT()) return;
      html=V.dash();
      break;

    case 'listings':
      if(!needT()) return;
      html=p[1]==='new'?V.newListing():V.listings();
      break;

    case 'deals':
      if(!needT()) return;
      html=V.deals();
      break;

    case 'offer':
      if(!needT()) return;
      html=V.offer(p[1]);
      break;

    case 'order':
      if(!needT()) return;
      html=V.order(p[1]);
      break;

    case 'inspection':
      if(!needT()) return;
      html=V.inspection(p[1]);
      break;

    case 'booking':
      if(!needT()) return;
      html=V.booking(p[1]);
      break;

    case 'books':
      if(!needT()) return;
      html=V.books();
      break;

    case 'prices':
      if(!needT()) return;
      html=V.prices();
      break;

    case 'rewards':
      if(!needT()) return;
      html=V.rewards();
      break;

    case 'account':
      if(!needT()) return;
      html=V.account();
      break;

    case 'admin':
      if(!needA()) return;

      html=({
        '':V.admin,
        bookings:V.adminBookings,
        trucks:V.adminTrucks,
        users:V.adminUsers,
        orders:V.adminOrders
      }[p[1]||'']||V.admin)();

      break;

    default:
      html=emptyState(
        'search',
        'এই পাতাটা পাওয়া গেল না',
        'লিংকটা হয়তো ভুল, বা পাতাটা সরানো হয়েছে।',
        '<a class="btn btn-green" href="#/">শুরুতে ফিরুন</a>'
      );
  }

  if(u){
    const here=location.hash;

    (S.notifs||[])
      .filter(n=>!n.read&&n.link===here)
      .forEach(n=>{
        n.read=1;

        api(`/notifs/${n.id}/read`,'POST')
          .catch(()=>{});
      });
  }

  /*
   * Dashboard/page top notification banners intentionally removed.
   */

  $('#view').innerHTML=html;

  renderChrome();

  applyLanguage($('#view'));
}


/* =====================================================================
   Keep focus after render
   ===================================================================== */

function renderKeepFocus(){
  const a=document.activeElement;

  const key=a&&[...a.attributes]
    .find(
      x=>
        x.name.startsWith('data-')
        &&
        x.name!=='data-act'
        &&
        x.name!=='data-num'
    );

  const isText=
    !!a
    &&
    a.tagName==='INPUT'
    &&
    a.type==='text';

  const isNum=
    !!a
    &&
    !!a.dataset.num;

  const raw=isText?a.value:null;
  const s1=isText?a.selectionStart:null;
  const s2=isText?a.selectionEnd:null;

  render();

  if(key){
    const el=document.querySelector(
      `[${key.name}="${key.value}"]`
    );

    if(el){
      if(
        isText
        &&
        el.tagName==='INPUT'
        &&
        el.type==='text'
      ){
        el.value=raw;
      }

      el.focus();

      try{
        if(isNum){
          const end=el.value.length;
          el.setSelectionRange(end,end);
        }
        else{
          el.setSelectionRange(
            s1==null?el.value.length:s1,
            s2==null?el.value.length:s2
          );
        }
      }
      catch(e){}
    }
  }
}


/* =====================================================================
   Numeric input validation
   ===================================================================== */

(function(){
  const BNDIG='০১২৩৪৫৬৭৮৯';

  const clean=(s,dec)=>{
    s=String(s)
      .replace(/[০-৯]/g,d=>BNDIG.indexOf(d))
      .replace(/[।．]/g,'.');

    if(!dec){
      return s.replace(/[^0-9]/g,'');
    }

    s=s.replace(/[^0-9.]/g,'');

    const i=s.indexOf('.');

    return i<0
      ? s
      : s.slice(0,i+1)
        +
        s.slice(i+1).replace(/\./g,'');
  };

  window.cleanNumberText=clean;

  document.addEventListener(
    'beforeinput',
    e=>{
      const t=e.target;

      if(
        !t
        ||
        !t.dataset
        ||
        !t.dataset.num
        ||
        e.isComposing
      ){
        return;
      }

      if(
        e.data
        &&
        /[-+eE]/.test(e.data)
      ){
        e.preventDefault();
      }
    },
    true
  );

  document.addEventListener(
    'keydown',
    e=>{
      const t=e.target;

      if(
        !t
        ||
        !t.dataset
        ||
        !t.dataset.num
      ){
        return;
      }

      if(
        ['-','+','e','E'].includes(e.key)
      ){
        e.preventDefault();
      }
    },
    true
  );

  document.addEventListener(
    'input',
    e=>{
      const t=e.target;

      if(
        !t
        ||
        !t.dataset
        ||
        !t.dataset.num
        ||
        e.isComposing
      ){
        return;
      }

      const dec=t.dataset.num==='dec';
      const before=t.value;

      const pos=
        t.selectionStart==null
          ? before.length
          : t.selectionStart;

      const next=clean(before,dec);

      if(next===before){
        return;
      }

      const caret=
        clean(
          before.slice(0,pos),
          dec
        ).length;

      t.value=next;

      try{
        t.setSelectionRange(
          caret,
          caret
        );
      }
      catch(err){}
    },
    true
  );
})();


window.addEventListener(
  'hashchange',
  ()=>{
    closeModal();

    $('#npanel')
      .classList
      .remove('on');

    closeSheet();

    PROFILE=null;

    render();

    const v=$('#view');

    v.classList.remove('enter');

    void v.offsetWidth;

    v.classList.add('enter');

    window.scrollTo(0,0);

    const f=AFTER_NAV;

    AFTER_NAV=null;

    if(f) f();
  }
);


/* =====================================================================
   Actions
   ===================================================================== */

async function refresh(){
  await load();
  render();
}


async function doLogin(body){
  const r=await api('/login','POST',body);

  setToken(r.token);

  await load();

  go(
    r.user.role==='admin'
      ? '#/admin'
      : '#/home'
  );

  toast(
    `স্বাগতম, ${dispName(r.user)}`
  );
}


const REASONS = {
  reject_seller:[
    'দাম কম',
    'এত পরিমাণ দিতে পারব না',
    'অন্য জায়গায় বিক্রি করেছি'
  ],

  reject_buyer:[
    'দাম বেশি',
    'আর লাগবে না',
    'অন্য জায়গা থেকে কিনেছি'
  ],

  cancel_seller:[
    'মাল শেষ হয়ে গেছে',
    'এখন পাঠাতে পারব না',
    'ক্রেতা যোগাযোগ করেননি'
  ],

  cancel_buyer:[
    'আর লাগবে না',
    'অন্য জায়গা থেকে কিনেছি',
    'সময়মতো পাওয়া যাবে না'
  ]
};


/* ---------- sign-up OTP (demo: the code is shown on screen, no SMS gateway yet) ---------- */
let OTP=null, OTP_TIMER=null;
const onlyDigits=v=>enDigits(String(v||'')).replace(/\D/g,'');

function otpLeft(){
  const s=Math.max(0,Math.round(((OTP&&OTP.expires)||0)-Date.now())/1000|0);
  return s?`${bd(Math.floor(s/60))}:${bd(String(s%60).padStart(2,'0'))} মিনিটে মেয়াদ শেষ`:'কোডের মেয়াদ শেষ, আবার পাঠান';
}

function drawOtp(value=''){
  modal(`<div class="body otp-box">
    <div class="otp-ic">${ic('shield')}</div>
    <h2>OTP যাচাই</h2>
    <p class="muted sm">অ্যাকাউন্ট খুলতে <b data-i18n-skip>${esc(OTP.phone)}</b> নম্বরের কোডটি দিন</p>
    <div class="otp-demo">
      <div class="row" style="gap:8px">${ic('info')}<b>ডেমো যাচাই</b></div>
      <p>এটি প্রোটোটাইপ, SMS গেটওয়ে এখনো চালু হয়নি। আপনার যাচাই কোড:</p>
      <div class="otp-code" data-i18n-skip>${esc(OTP.demo_otp)}</div>
      <p class="xs muted">উদাহরণ কোড · <span id="otp-left">${otpLeft()}</span></p>
    </div>
    <label class="field"><span>৫ সংখ্যার কোড দিন</span>
      <input id="otp-in" class="otp-input" inputmode="numeric" maxlength="5" autocomplete="one-time-code" placeholder="_ _ _ _ _" value="${esc(value)}"></label>
    ${OTP.err?`<p class="danger sm" style="margin-top:10px">${esc(OTP.err)}</p>`:''}
    <button class="btn btn-green btn-wide" style="margin-top:16px" data-act="otp-verify">যাচাই করে অ্যাকাউন্ট খুলুন</button>
    <p class="muted sm" style="margin-top:12px">কোড পাননি? <button type="button" class="linkbtn" data-act="otp-resend">আবার পাঠান</button></p>
  </div>`);

  applyLanguage($('#modal'));
  const inp=$('#otp-in');
  if(inp) inp.focus();

  clearInterval(OTP_TIMER);
  OTP_TIMER=setInterval(()=>{
    const el=$('#otp-left');
    if(!OTP||!el){ clearInterval(OTP_TIMER); return; }
    el.textContent=otpLeft();
    applyLanguage(el);
  },1000);
}

/* keep typed sign-up / login values across re-renders */
document.addEventListener('input',e=>{
  const d=e.target.dataset||{};
  if(d.rg!==undefined){
    RG[d.rg]=e.target.value;
    if(RGE[d.rg]){
      delete RGE[d.rg];
      const f=e.target.closest('.field');
      if(f){ f.classList.remove('err'); const m=f.querySelector('.ferr'); if(m) m.remove(); }
    }
  }
  if(d.lg!==undefined) LG[d.lg]=e.target.value;
});

/* Enter submits the login, sign-up and OTP forms */
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||!e.target.matches('input')) return;
  const d=e.target.dataset||{}, act=e.target.id==='otp-in'?'otp-verify':d.lg!==undefined?'login-phone':d.rg!==undefined?'register':null;
  if(!act) return;
  e.preventDefault();
  const btn=document.querySelector(`[data-act="${act}"]`);
  if(btn) btn.click();
});

const A = {

  close:()=>closeModal(),

  nav:d=>{
    closeSheet();
    go(d.to);
  },

  sheet:()=>{
    const on=$('#sheet')
      .classList
      .toggle('on');

    $('#scrim')
      .classList
      .toggle('on',on);
  },

  say:d=>say(d.v),

  bell:()=>{
    renderBell();

    $('#npanel')
      .classList
      .toggle('on');
  },

  'read-all':async()=>{
    await api(
      '/notifs/read',
      'POST'
    );

    await load();

    renderBell();

    renderChrome();
  },

  notif:async d=>{
    $('#npanel')
      .classList
      .remove('on');

    try{
      await api(
        `/notifs/${d.id}/read`,
        'POST'
      );
    }
    catch(e){}

    await load();

    if(d.link){
      go(d.link);
    }
    else{
      render();
    }
  },

  'notif-x':async d=>{
    await api(
      `/notifs/${d.id}/read`,
      'POST'
    );

    await refresh();
  },

  logout:async()=>{
    closeSheet();

    setToken(null);

    await load();

    go('#/');
  },

  reset:async()=>{
    if(
      !await confirmBox({
        title:'ডেমো নতুন করে শুরু করবেন?',
        body:'সব ডেমো ডেটা শুরুর অবস্থায় ফিরবে।',
        ok:'হ্যাঁ, শুরু করুন'
      })
    ){
      return;
    }

    await api('/reset','POST');

    setToken(null);

    NL=null;
    BK=null;
    CL=null;
    AC=null;

    await load();

    go('#/');

    toast(
      'ডেমো নতুন করে শুরু হয়েছে'
    );
  },

  'pick-role':d=>{
    loginRole=d.role;

    if(d.stay){
      render();
    }
    else{
      go('#/login');
    }
  },

  login:async d=>
    doLogin({
      user_id:d.id
    }),

  'login-phone':async()=>{
    const phone=onlyDigits(LG.phone);

    if(!/^01\d{9}$/.test(phone)||!LG.password){
      toast('মোবাইল নম্বর আর পাসওয়ার্ড দিন');
      return;
    }

    await doLogin({
      phone,
      password:LG.password,
      role:loginRole
    });

    LG.password='';
  },

  'pw-toggle':(d,el)=>{
    const inp=document.getElementById(d.for);
    if(!inp) return;
    const show=inp.type==='password';
    inp.type=show?'text':'password';
    el.innerHTML=ic(show?'eyeoff':'eye');
    el.setAttribute('aria-label',show?'পাসওয়ার্ড লুকান':'পাসওয়ার্ড দেখুন');
  },

  register:async()=>{
    const phone=onlyDigits(RG.phone), E={};

    if(RG.name.trim().length<2) E.name='পুরো নাম দিন';
    if(!/^01\d{9}$/.test(phone)) E.phone='০১ দিয়ে শুরু ১১ সংখ্যার মোবাইল নম্বর দিন';
    if(RG.password.length<6) E.password='পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে';
    if(RG.confirm!==RG.password) E.confirm='দুটো পাসওয়ার্ড মিলছে না';
    if(RG.upazila.trim().length<2) E.upazila='উপজেলার নাম দিন';
    if(RG.market.trim().length<2) E.market='নিকটবর্তী বাজারের নাম দিন';

    RGE=E;

    if(Object.keys(E).length){
      render();
      const first=document.querySelector('.field.err input');
      if(first) first.focus();
      return;
    }

    const b={
      role:loginRole,
      name:RG.name.trim(),
      phone,
      password:RG.password,
      confirm_password:RG.confirm,
      place:RG.place,
      upazila:RG.upazila.trim(),
      market:RG.market.trim(),
      biz:loginRole==='paikar'&&RG.biz.trim()?RG.biz.trim():null
    };

    const r=await api('/register','POST',b);

    OTP={...r, phone, body:b, expires:Date.now()+r.expires_in*1000, err:''};
    drawOtp();
  },

  'otp-verify':async()=>{
    const inp=$('#otp-in'), code=onlyDigits(inp?inp.value:'');

    if(code.length!==5){
      OTP.err='৫ সংখ্যার কোডটি দিন';
      drawOtp(code);
      return;
    }

    let r;
    try{
      r=await api('/register/verify','POST',{reg_id:OTP.reg_id, otp:code});
    }
    catch(e){
      OTP.err=e.message||'কোড মেলেনি';
      drawOtp(code);
      return;
    }

    OTP=null;
    RG={name:'',biz:'',phone:'',password:'',confirm:'',place:'rajshahi',upazila:'',market:''};
    closeModal();
    setToken(r.token);
    await load();
    go('#/home');
    toast('অ্যাকাউন্ট খোলা হয়েছে');
  },

  'otp-resend':async()=>{
    const r=await api('/register','POST',OTP.body);
    OTP={...OTP, ...r, expires:Date.now()+r.expires_in*1000, err:''};
    drawOtp();
    toast('নতুন কোড পাঠানো হয়েছে');
  },

  'f-crop':d=>{
    F.crop=d.v;
    render();
  },

  'f-clear':()=>{
    Object.assign(
      F,
      {
        q:'',
        crop:'all',
        place:'all',
        max:'',
        min:'',
        seller:'all',
        sold:false
      }
    );

    render();
  },


  /* =====================================================
     Theme
     ===================================================== */

  theme:()=>{
    const r=document.documentElement;

    const next=
      curTheme()==='dark'
        ? 'light'
        : 'dark';

    r.classList.add('theme-anim');

    r.dataset.theme=next;

    try{
      localStorage.setItem(
        'reroute-theme',
        next
      );
    }
    catch(e){}

    renderChrome();

    applyLanguage(
      document.body
    );

    setTimeout(
      ()=>r.classList.remove(
        'theme-anim'
      ),
      400
    );
  },


  /* =====================================================
     Language
     ===================================================== */

  lang:()=>{
    setLanguage(
      curLang()==='bn'
        ? 'en'
        : 'bn'
    );

    closeSheet();

    render();

    applyLanguage(
      document.body
    );
  },


  /* =====================================================
     Confirmation box
     ===================================================== */

  'conf-yes':()=>{
    const t=$('#conf-reason');

    const reason=
      (t&&t.value.trim())
      ||
      CONF.picked
      ||
      null;

    if(
      CONF.reason
      &&
      CONF.requireReason
      &&
      !reason
    ){
      toast(
        'একটি কারণ দিন, বা "কারণ ছাড়া" চাপুন'
      );

      return;
    }

    closeModal(
      CONF.reason
        ? {reason}
        : true
    );
  },

  'conf-skip':()=>
    closeModal({
      reason:null
    }),

  'conf-no':()=>
    closeModal(false),

  'conf-chip':d=>{
    const t=$('#conf-reason');

    CONF.picked=
      CONF.picked===d.v
        ? ''
        : d.v;

    if(
      t
      &&
      t.value
      &&
      !CONF.chips.includes(
        t.value
      )
    ){
      CONF.picked=t.value;
    }

    drawConfirm();
  },


  /* =====================================================
     Listings
     ===================================================== */

  'nl-crop':d=>{
    NL.crop=d.v;
    NL.price=null;
    render();
  },

  'nl-photo-x':d=>{
    NL.photos.splice(
      +d.v,
      1
    );

    render();
  },

  'nl-submit':async()=>{
    const u=me(),
          kg=NL.mon*MON;

    if(
      !(
        NL.mon>=5
        &&
        NL.moq>=5
        &&
        NL.moq<=NL.mon
        &&
        NL.price>0
      )
    ){
      toast(
        'পরিমাণ অন্তত ৫ মণ, সর্বনিম্ন অর্ডার ৫ মণ বা বেশি, আর দাম দিন'
      );

      return;
    }

    const ok=
      await confirmBox({
        title:'লিস্টিং প্রকাশ করবেন?',

        body:
          bill([
            [
              'ফসল',
              CROPS[NL.crop].n
              +
              ', গ্রেড '
              +
              NL.grade
            ],
            [
              'পরিমাণ',
              kgMon(kg)
            ],
            [
              'দাম',
              tk(NL.price,1)
              +
              '/কেজি'
            ],
            [
              'সর্বনিম্ন অর্ডার',
              monTxt(
                NL.moq*MON
              )
            ],
            [
              'ছবি',
              nf(
                NL.photos.length
              )
              +
              'টি'
            ],
            [
              'মোট মূল্য',
              tk(
                NL.price*kg
              ),
              'tot'
            ]
          ])
          +
          '<p class="muted sm" style="margin-top:8px">প্রকাশ হলে সব কৃষক ও পাইকার দেখতে পাবেন।</p>',

        ok:'প্রকাশ করুন'
      });

    if(!ok){
      return;
    }

    const l=
      await api(
        '/listings',
        'POST',
        {
          crop:NL.crop,
          qty:kg,
          price:+NL.price,
          moq:NL.moq*MON,
          grade:NL.grade,
          quality:NL.quality,
          harvest_days_ago:+NL.harvest,
          photos:NL.photos,
          prod_cost:
            NL.cost===''
              ? null
              : +NL.cost
        }
      );

    nlReset();

    await load();

    go(
      '#/listing/'+l.id
    );

    toast(
      'লিস্টিং প্রকাশ হয়েছে'
    );
  },

  urgent:async d=>{
    const l=listing(d.id);

    const disc=
      l.days_left<=1
        ? 12
        : (
          l.days_left<=2
            ? 10
            : 7
        );

    if(
      !await confirmBox({
        title:'জরুরি বিক্রি চালু করবেন?',

        body:
          `দাম ${nf(disc)}% কমে ${
            tk(
              l.price*(1-disc/100),
              1
            )
          }/কেজি হবে, আর সব পাইকারের কাছে সাথে সাথে খবর যাবে। পরে দাম আবার বদলাতে পারবেন।`,

        ok:'চালু করুন',

        danger:true
      })
    ){
      return;
    }

    await api(
      `/listings/${d.id}/urgent`,
      'POST'
    );

    await refresh();

    toast(
      'জরুরি বিক্রি চালু, পাইকারদের জানানো হয়েছে'
    );
  },

  'l-price':d=>{
    const l=listing(d.id);

    modal(
      `<div class="body">

        <h2>
          দাম বদলান
        </h2>

        <p class="muted">
          ${CROPS[l.crop].n},
          এখন
          ${tk(l.price,1)}/কেজি
        </p>

        <label class="field">

          <span>
            নতুন দাম (৳/কেজি)
          </span>

          <input
            id="lp-price"
            type="number"
            step="0.5"
            min="1"
            value="${l.price}"
          >

        </label>

        <p
          class="muted sm"
          style="margin-top:6px"
        >
          চলমান অফার আর অর্ডারের দাম বদলাবে না।
        </p>

        <button
          class="btn btn-green btn-wide"
          style="margin-top:12px"
          data-act="l-price-save"
          data-id="${l.id}"
        >
          সংরক্ষণ
        </button>

      </div>`
    );
  },

  'l-price-save':async d=>{
    const v=
      +$('#lp-price').value;

    if(!(v>0)){
      toast('দাম দিন');
      return;
    }

    await api(
      `/listings/${d.id}`,
      'PATCH',
      {
        price:v
      }
    );

    closeModal();

    await refresh();

    toast(
      'দাম বদলানো হয়েছে'
    );
  },

  'l-qty':d=>{
    const l=listing(d.id);

    modal(
      `<div class="body">

        <h2>
          পরিমাণ বাড়ান বা কমান
        </h2>

        <p class="muted">
          বিক্রির জন্য আছে
          ${monTxt(l.available)}
        </p>

        <label class="field">

          <span>
            কত মণ যোগ করবেন? (কমাতে মাইনাস দিন, যেমন −১০)
          </span>

          <input
            id="lq-mon"
            type="number"
            value="10"
          >

        </label>

        <button
          class="btn btn-green btn-wide"
          style="margin-top:12px"
          data-act="l-qty-save"
          data-id="${l.id}"
        >
          সংরক্ষণ
        </button>

      </div>`
    );
  },

  'l-qty-save':async d=>{
    const v=
      +$('#lq-mon').value;

    if(!v){
      toast(
        'সংখ্যা দিন'
      );

      return;
    }

    await api(
      `/listings/${d.id}`,
      'PATCH',
      {
        add_qty:v*MON
      }
    );

    closeModal();

    await refresh();

    toast(
      'পরিমাণ বদলানো হয়েছে'
    );
  },

  'l-status':async d=>{
    const t={
      paused:[
        'সাময়িক বন্ধ করবেন?',
        'বন্ধ থাকলে কেউ নতুন অফার দিতে পারবেন না। পরে আবার চালু করা যাবে।'
      ],

      active:[
        'আবার চালু করবেন?',
        'সবাই আবার দেখতে ও অফার দিতে পারবেন।'
      ],

      closed:[
        'লিস্টিং পুরো বন্ধ করবেন?',
        'বাকি মাল আপনার মজুদে "তালিকার বাইরে" থাকবে। চলমান অর্ডার থাকলে বন্ধ করা যায় না।'
      ]
    }[d.v];

    if(
      !await confirmBox({
        title:t[0],
        body:t[1],
        danger:d.v==='closed'
      })
    ){
      return;
    }

    await api(
      `/listings/${d.id}`,
      'PATCH',
      {
        status:d.v
      }
    );

    await refresh();
  },


  /* =====================================================
     Buying
     ===================================================== */

  'offer-open':d=>{
    if(!me()){
      go('#/login');
      return;
    }

    openOffer(d.id);
  },

  'of-set':d=>{
    OF[d.k]=d.v;
    drawOffer();
  },

  'of-submit':async()=>{
    const c=offerCalc(),
          l=c.l;

    if(
      c.kg<l.moq
      ||
      c.kg>l.available
    ){
      toast(
        `পরিমাণ ${monTxt(l.moq)} থেকে ${monTxt(l.available)} এর মধ্যে দিন`
      );

      return;
    }

    if(
      !(
        OF.price>0
        &&
        OF.price<=l.eff_price
      )
    ){
      toast(
        `দাম তালিকার দাম ${tk(l.eff_price,1)} বা কম দিন`
      );

      return;
    }

    const ok=
      await confirmBox({
        title:'অফার পাঠাবেন?',

        body:
          `<p>${monTxt(c.kg)} ${CROPS[l.crop].n}, ${tk(OF.price,1)}/কেজি</p>`
          +
          offerBill(c)
          +
          '<p class="muted sm" style="margin-top:8px">বিক্রেতা রাজি হলে পেমেন্ট করতে বলা হবে। এখন কোনো টাকা কাটবে না।</p>',

        ok:'অফার পাঠান'
      });

    if(!ok){
      return;
    }

    const o=
      await api(
        '/offers',
        'POST',
        {
          listing:l.id,
          qty:c.kg,
          price:+OF.price,
          transport:OF.transport,
          split:OF.split,
          note:OF.note
        }
      );

    await load();

    go(
      '#/offer/'+o.id
    );

    toast(
      'অফার পাঠানো হয়েছে'
    );
  },

  'inspect-open':d=>{
    if(!me()){
      go('#/login');
      return;
    }

    openInspect(d.id);
  },

  'in-kind':d=>{
    IN.kind=d.v;
    IN.pref=$('#in-pref').value;
    IN.note=$('#in-note').value;

    drawInspect();
  },

  'in-submit':async()=>{
    const i=
      await api(
        '/inspections',
        'POST',
        {
          listing:IN.lid,
          kind:IN.kind,
          pref:
            $('#in-pref').value.trim()
            ||
            'যেকোনো সময়',
          note:
            $('#in-note').value.trim()
        }
      );

    closeModal();

    await load();

    go(
      '#/inspection/'+i.id
    );

    toast(
      'অনুরোধ পাঠানো হয়েছে'
    );
  },

  insp:async d=>{
    const t={
      schedule:'রাজি হয়ে সময় জানাবেন?',
      decline:'পরিদর্শনে রাজি নন?',
      done:'মাল দেখা হয়েছে?',
      cancel:'অনুরোধ বাতিল করবেন?'
    }[d.v];

    if(
      !await confirmBox({
        title:t,
        danger:
          ['decline','cancel']
            .includes(d.v)
      })
    ){
      return;
    }

    const r=
      $('#insp-reply');

    await api(
      `/inspections/${d.id}/${d.v}`,
      'POST',
      {
        reply:r?r.value:''
      }
    );

    await refresh();
  },

  dt:d=>{
    DT=d.v;

    if(parts()[0]!=='deals'){
      go('#/deals');
    }
    else{
      render();
    }
  },

  df:d=>{
    DF=d.v;
    render();
  },


  /* =====================================================
     Negotiation
     ===================================================== */

  'o-accept':async d=>{
    const o=S.offers.find(
      x=>x.id===d.id
    );

    const sell=
      o.seller===me().id;

    if(sell){
      const e=
        sellerPayout(
          o,
          o.price
        );

      if(
        !await confirmBox({
          title:'এই দামে বিক্রি করবেন?',

          body:
            `<p>${monTxt(o.qty)} ${CROPS[o.crop].n}, ${tk(o.price,1)}/কেজি, ${esc(dispName(user(o.buyer)))}-কে</p>`
            +
            bill([
              [
                'মালের দাম',
                tk(e.goods)
              ],

              [
                'প্ল্যাটফর্ম ফি ১%',
                '−'+tk(
                  e.fee-e.feeDisc
                ),
                'minus'
              ],

              e.share
                ? [
                    'ট্রাক ভাড়া, আপনার ভাগ',
                    '−'+tk(
                      e.share-e.credit
                    ),
                    'minus'
                  ]
                : null,

              [
                'আপনি পাবেন',
                tk(e.payout),
                'tot'
              ]
            ])
            +
            '<p class="muted sm" style="margin-top:8px">রাজি হলে মাল সংরক্ষিত হবে। ক্রেতা পেমেন্ট করলে অর্ডার নিশ্চিত, টাকা Reroute-এ জমা থাকবে, মাল বুঝে দিলে পাবেন।</p>',

          ok:'হ্যাঁ, রাজি'
        })
      ){
        return;
      }

      const r=
        await api(
          `/offers/${d.id}/accept`,
          'POST',
          {}
        );

      await load();

      go(
        '#/order/'+r.order.id
      );

      toast(
        'রাজি হয়েছেন, ক্রেতার পেমেন্টের অপেক্ষা'
      );
    }
    else{
      const e=
        buyerTotal(
          o,
          o.price
        );

      if(
        !await confirmBox({
          title:'পাল্টা দামে কিনবেন?',

          body:
            `<p>${monTxt(o.qty)} ${CROPS[o.crop].n}, ${tk(o.price,1)}/কেজি</p>`
            +
            bill([
              [
                'মালের দাম',
                tk(e.goods)
              ],

              e.share
                ? [
                    'ট্রাক ভাড়া, আপনার ভাগ',
                    tk(e.share)
                  ]
                : null,

              e.credit
                ? [
                    'ছাড়',
                    '−'+tk(e.credit),
                    'plus'
                  ]
                : null,

              [
                'মোট পেমেন্ট',
                tk(e.total),
                'tot'
              ]
            ])
            +
            '<p class="muted sm" style="margin-top:8px">রাজি হলে এখনই অনলাইনে পেমেন্ট করতে হবে।</p>',

          ok:'হ্যাঁ, পেমেন্টে যান'
        })
      ){
        return;
      }

      const r=
        await api(
          `/offers/${d.id}/accept`,
          'POST',
          {}
        );

      await load();

      go(
        '#/order/'+r.order.id,
        ()=>
          payFlow(
            'order',
            r.order.id,
            r.order.buyer_total,
            `${monTxt(o.qty)} ${CROPS[o.crop].n} কেনা`,
            null
          )
      );
    }
  },

  'o-reject':async d=>{
    const o=
      S.offers.find(
        x=>x.id===d.id
      );

    const sell=
      o.seller===me().id;

    const r=
      await confirmBox({
        title:
          sell
            ? 'অফারে না বলবেন?'
            : 'পাল্টা দামে না বলবেন?',

        body:
          `${monTxt(o.qty)} ${CROPS[o.crop].n}, ${tk(o.price,1)}/কেজি। অন্যজনকে জানানো হবে।`,

        reason:true,

        chips:
          REASONS[
            sell
              ? 'reject_seller'
              : 'reject_buyer'
          ],

        ok:'কারণসহ না বলুন',

        okShort:'না বলুন',

        danger:true
      });

    if(!r){
      return;
    }

    await api(
      `/offers/${d.id}/reject`,
      'POST',
      {
        reason:r.reason
      }
    );

    await refresh();

    toast(
      'না বলা হয়েছে'
    );
  },

  'o-cancel':async d=>{
    const r=
      await confirmBox({
        title:'অফার তুলে নেবেন?',

        body:'বিক্রেতাকে জানানো হবে। পয়েন্ট কাটবে না।',

        reason:true,

        chips:
          REASONS.cancel_buyer,

        ok:'কারণসহ তুলে নিন',

        okShort:'তুলে নিন',

        danger:true
      });

    if(!r){
      return;
    }

    await api(
      `/offers/${d.id}/cancel`,
      'POST',
      {
        reason:r.reason
      }
    );

    await refresh();
  },

  'o-counter':d=>{
    const o=
      S.offers.find(
        x=>x.id===d.id
      );

    const mid=
      Math.round(
        (
          (
            o.price
            +
            o.listed_price
          )
          /
          2
        )
        *
        2
      )
      /
      2;

    modal(
      `<div class="body">

        <h2>
          ${ic('↔️')} পাল্টা দাম দিন
        </h2>

        <p class="muted">
          ক্রেতা দিয়েছেন
          ${tk(o.price,1)}/কেজি,
          আপনার তালিকার দাম
          ${tk(o.listed_price,1)}
        </p>

        <label class="field">

          <span>
            আপনার দাম (৳/কেজি)
          </span>

          <input
            id="ct-price"
            type="number"
            step="0.5"
            min="${o.price+0.5}"
            max="${o.listed_price}"
            value="${mid}"
          >

        </label>

        <p
          class="muted sm"
          style="margin-top:6px"
        >
          ক্রেতা রাজি হলে পেমেন্ট করবেন, না হলে প্রত্যাখ্যান করবেন।
        </p>

        <button
          class="btn btn-blue btn-wide"
          style="margin-top:12px"
          data-act="counter-send"
          data-id="${o.id}"
        >
          পাল্টা দাম পাঠান
        </button>

      </div>`
    );
  },

  'counter-send':async d=>{
    const o=
      S.offers.find(
        x=>x.id===d.id
      );

    const v=
      +$('#ct-price').value;

    if(
      !(
        v>o.price
        &&
        v<=o.listed_price
      )
    ){
      toast(
        `দাম ${tk(o.price,1)}-এর বেশি এবং ${tk(o.listed_price,1)} বা কম দিন`
      );

      return;
    }

    await api(
      `/offers/${d.id}/counter`,
      'POST',
      {
        price:v
      }
    );

    closeModal();

    await refresh();

    toast(
      'পাল্টা দাম পাঠানো হয়েছে'
    );
  },


  /* =====================================================
     Payments
     ===================================================== */

  'pay-order':d=>{
    const o=
      S.orders.find(
        x=>x.id===d.id
      );

    payFlow(
      'order',
      o.id,
      o.buyer_total,
      `${monTxt(o.qty)} ${CROPS[o.crop].n}, ${esc(dispName(user(o.seller)))}-এর কাছ থেকে`,
      null
    );
  },

  'pay-booking':d=>{
    const b=
      S.bookings.find(
        x=>x.id===d.id
      );

    payFlow(
      'booking',
      b.id,
      b.total-b.credit_used,
      `Reroute ট্রাক: ${PLACES[b.pickup_place].n} → ${PLACES[b.drop_place].n}`,
      null
    );
  },

  'pay-method':async d=>{
    PAY.method=d.v;

    const p=
      await api(
        '/payments',
        'POST',
        {
          purpose:PAY.purpose,
          ref:PAY.ref,
          method:d.v
        }
      );

    PAY.pid=p.id;

    if(p.status==='success'){
      PAY.step='done';
      PAY.txn=p.txn;
    }
    else if(p.status==='failed'){
      PAY.step='failed';
      PAY.msg=p.message;
    }
    else{
      PAY.step='gateway';
    }

    drawPay();
  },

  'pay-back':()=>{
    PAY.step='method';
    drawPay();
  },

  'pay-confirm':async()=>{
    const acc=
      ($('#pay-acc').value||'')
        .replace(/\s/g,'');

    const pin=
      $('#pay-pin').value.trim();

    const r=
      await api(
        `/payments/${PAY.pid}/confirm`,
        'POST',
        {
          account:acc,
          pin
        }
      );

    if(r.status==='success'){
      PAY.step='done';
      PAY.txn=r.txn;
    }
    else{
      PAY.step='failed';
      PAY.msg=r.message;
    }

    drawPay();
  },

  'pay-retry':()=>{
    PAY.step='method';
    drawPay();
  },

  'pay-finish':async()=>{
    const after=PAY.after;

    closeModal();

    await refresh();

    toast(
      'পেমেন্ট সফল'
    );

    if(after){
      after();
    }
  },


  /* =====================================================
     Order
     ===================================================== */

  handover:async d=>{
    const o=
      S.orders.find(
        x=>x.id===d.id
      );

    if(
      !await confirmBox({
        title:
          o.transport==='reroute'
            ? 'ট্রাকে মাল তুলে দিয়েছেন?'
            : 'পাইকারকে মাল বুঝিয়ে দিয়েছেন?',

        body:
          `${monTxt(o.qty)} ${CROPS[o.crop].n}। ক্রেতা মাল বুঝে নিলে টাকা আপনার ওয়ালেটে যাবে।`,

        ok:'হ্যাঁ, দিয়েছি'
      })
    ){
      return;
    }

    await api(
      `/orders/${d.id}/handover`,
      'POST'
    );

    await refresh();

    toast(
      'হস্তান্তর নিশ্চিত হয়েছে'
    );
  },

  complete:async d=>{
    const o=
      S.orders.find(
        x=>x.id===d.id
      );

    if(
      !await confirmBox({
        title:'মাল বুঝে পেয়েছেন?',

        body:
          `${monTxt(o.qty)} ${CROPS[o.crop].n}। নিশ্চিত করলে বিক্রেতা ${tk(o.payout)} পাবেন, আর এটা ফেরানো যাবে না।`,

        ok:'হ্যাঁ, বুঝে পেয়েছি'
      })
    ){
      return;
    }

    await api(
      `/orders/${d.id}/complete`,
      'POST'
    );

    await refresh();

    toast(
      'অর্ডার সম্পূর্ণ'
    );

    A['rate-open']({
      id:d.id
    });
  },

  'order-cancel':async d=>{
    const o=
      S.orders.find(
        x=>x.id===d.id
      );

    const sell=
      o.seller===me().id;

    const r=
      await confirmBox({
        title:'অর্ডার বাতিল করবেন?',

        body:
          `${monTxt(o.qty)} ${CROPS[o.crop].n}। অন্যজনকে কারণসহ জানানো হবে।${
            o.paid_at
              ? ` ক্রেতার ${tk(o.buyer_total)} তাঁর ওয়ালেটে ফেরত যাবে।`
              : ''
          }${
            o.booking
              ? ' Reroute ট্রাকের বুকিংও বাতিল হবে।'
              : ''
          }`,

        penalty:
          S.config.penalty,

        reason:true,

        chips:
          REASONS[
            sell
              ? 'cancel_seller'
              : 'cancel_buyer'
          ],

        ok:'কারণসহ বাতিল',

        okShort:'বাতিল',

        danger:true
      });

    if(!r){
      return;
    }

    await api(
      `/orders/${d.id}/cancel`,
      'POST',
      {
        reason:r.reason
      }
    );

    await refresh();

    toast(
      `অর্ডার বাতিল হয়েছে, ${nf(S.config.penalty)} পয়েন্ট কাটা গেছে`
    );
  },

  'rate-open':d=>{
    RT={
      id:d.id,
      stars:5
    };

    drawRate();
  },

  'rate-star':d=>{
    RT.stars=+d.v;
    drawRate();
  },

  'rate-send':async()=>{
    await api(
      `/orders/${RT.id}/rate`,
      'POST',
      {
        stars:RT.stars,
        text:
          ($('#rt-text').value||'')
            .trim()
          ||
          null
      }
    );

    closeModal();

    await refresh();

    toast(
      'রেটিং দেওয়া হয়েছে'
    );
  },


  /* =====================================================
     Transport
     ===================================================== */

  'bk-submit':async()=>{
    const {
      kg,
      q,
      credit,
      pay
    }=bkQuote();

    if(
      BK.src===BK.dst
      &&
      !BK.srcAddr
    ){
      toast(
        'ঠিকানা দিন'
      );

      return;
    }

    if(kg<100){
      toast(
        'অন্তত ৩ মণ দিন'
      );

      return;
    }

    if(
      !await confirmBox({
        title:'ট্রাক বুক করবেন?',

        body:
          `<p>${PLACES[BK.src].n} → ${PLACES[BK.dst].n}, ${monTxt(kg)} ${CROPS[BK.crop].n}, ${BK.date}</p>`
          +
          bill([
            [
              q.vehicle_name,
              tk(q.fare)
            ],
            [
              'সেবা চার্জ',
              tk(q.service)
            ],
            credit
              ? [
                  'ছাড়',
                  '−'+tk(credit),
                  'plus'
                ]
              : null,
            [
              'মোট',
              tk(pay),
              'tot'
            ]
          ])
          +
          '<p class="muted sm" style="margin-top:8px">পেমেন্ট হলে বুকিং অনুরোধ অপারেশন টিমের কাছে যাবে, ট্রাক ঠিক হলে জানানো হবে।</p>',

        ok:'পেমেন্টে যান'
      })
    ){
      return;
    }

    const b=
      await api(
        '/bookings',
        'POST',
        {
          pickup_place:BK.src,
          pickup_addr:BK.srcAddr,
          drop_place:BK.dst,
          drop_addr:BK.dstAddr,
          crop:BK.crop,
          qty:kg,
          date:BK.date
        }
      );

    await load();

    go(
      '#/booking/'+b.id,
      ()=>
        payFlow(
          'booking',
          b.id,
          b.total-b.credit_used,
          `Reroute ট্রাক: ${PLACES[b.pickup_place].n} → ${PLACES[b.drop_place].n}`,
          null
        )
    );
  },

  'bk-cancel':async d=>{
    const b=
      S.bookings.find(
        x=>x.id===d.id
      );

    if(
      !await confirmBox({
        title:'বুকিং বাতিল করবেন?',

        body:
          b.paid
            ? `${tk(b.total-b.credit_used)} আপনার ওয়ালেটে ফেরত যাবে।`
            : 'এখনো পেমেন্ট হয়নি।',

        danger:true,

        ok:'বাতিল করুন'
      })
    ){
      return;
    }

    await api(
      `/bookings/${d.id}/cancel`,
      'POST'
    );

    await refresh();

    toast(
      'বুকিং বাতিল হয়েছে'
    );
  },


  /* =====================================================
     Books
     ===================================================== */

  'books-tab':d=>{
    BT=d.v;

    if(parts()[0]!=='books'){
      go('#/books');
    }
    else{
      render();
    }
  },

  'entry-open':d=>{
    EN.kind=d.v;
    BT='entries';
    render();
  },

  'en-kind':d=>{
    EN.kind=d.v;
    render();
  },

  'en-submit':async()=>{
    const amount=
      +EN.amount||0;

    if(
      EN.kind==='expense'
      &&
      !amount
    ){
      toast(
        'টাকার পরিমাণ দিন'
      );

      return;
    }

    if(
      EN.kind!=='expense'
      &&
      !(+EN.mon>0)
    ){
      toast(
        'কত মণ দিন'
      );

      return;
    }

    if(
      EN.kind==='sale'
      &&
      !amount
    ){
      toast(
        'বিক্রির টাকা দিন'
      );

      return;
    }

    await api(
      '/entries',
      'POST',
      {
        kind:EN.kind,
        crop:
          EN.kind==='expense'
            ? null
            : EN.crop,
        qty:
          EN.kind==='expense'
            ? 0
            : +EN.mon*MON,
        amount,
        note:EN.note
      }
    );

    EN.amount='';
    EN.note='';

    await refresh();

    toast(
      'সংরক্ষণ হয়েছে'
    );
  },

  'pr-crop':d=>{
    PR.crop=d.v;
    PR.cost=null;
    render();
  },


  /* =====================================================
     Rewards & Account
     ===================================================== */

  redeem:async d=>{
    const [
      n,
      c,
      ,
      v
    ]=
      S.config.redeem[d.id];

    if(
      !await confirmBox({
        title:`${n} নেবেন?`,

        body:
          `${nf(c)} পয়েন্ট খরচ হবে, ${tk(v)} ছাড় জমা হবে যা পরের ${
            d.id==='transport'
              ? 'Reroute ট্রাকের ভাড়ায়'
              : 'বিক্রির ফি-তে'
          } নিজে থেকে কাটা যাবে।`,

        ok:'হ্যাঁ, নিন'
      })
    ){
      return;
    }

    await api(
      `/rewards/${d.id}`,
      'POST'
    );

    await refresh();

    toast(
      'ছাড় জমা হয়েছে'
    );
  },

  'ac-save':async()=>{
    const b={
      name:AC.name,
      area:AC.area,
      market:AC.market
    };

    if(me().role==='paikar'){
      b.biz=AC.biz;
    }

    if(AC.photo){
      b.photo=AC.photo;
    }

    await api(
      '/me',
      'POST',
      b
    );

    AC=null;

    await refresh();

    toast(
      'প্রোফাইল সংরক্ষণ হয়েছে'
    );
  },

  'plus-buy':async()=>{
    if(
      !await confirmBox({
        title:'Reroute প্লাস নেবেন?',

        body:
          bill([
            [
              'দাম',
              tk(
                S.config.plus_price
              )
            ],
            [
              'মেয়াদ',
              `${nf(S.config.plus_days)} দিন`
            ],
            [
              'পেমেন্ট',
              'বিকাশ, নগদ, কার্ড বা ওয়ালেট'
            ]
          ])
          +
          '<p class="muted sm" style="margin-top:8px">পেমেন্ট সফলভাবে যাচাই হলেই প্লাস চালু হবে। ব্যর্থ হলে চালু হবে না, টাকাও কাটবে না।</p>',

        ok:'পেমেন্টে যান'
      })
    ){
      return;
    }

    payFlow(
      'plus',
      null,
      S.config.plus_price,
      `Reroute প্লাস, ${nf(S.config.plus_days)} দিন`,
      null
    );
  },

  'plus-cancel':async()=>{
    const u=me();

    if(
      !await confirmBox({
        title:'প্লাস বন্ধ করবেন?',

        body:
          `আপনার প্লাস ${dateBn(u.plus_until)} পর্যন্ত চালু থাকবে, তারপর আর নবায়ন হবে না। বাকি দিনের টাকা ফেরত হয় না। চাইলে মেয়াদের মধ্যে আবার চালু করতে পারবেন।`,

        ok:'হ্যাঁ, বন্ধ করুন',

        danger:true
      })
    ){
      return;
    }

    await api(
      '/plus/cancel',
      'POST'
    );

    await refresh();

    toast(
      'প্লাস বন্ধ করা হয়েছে, মেয়াদ পর্যন্ত চালু থাকবে'
    );
  },

  'plus-resume':async()=>{
    if(
      !await confirmBox({
        title:'প্লাস নবায়ন আবার চালু করবেন?',

        body:
          'এখন কোনো টাকা লাগবে না, মেয়াদ শেষে নবায়নের সময় পেমেন্ট চাওয়া হবে।'
      })
    ){
      return;
    }

    await api(
      '/plus/resume',
      'POST'
    );

    await refresh();

    toast(
      'প্লাস চালু থাকবে'
    );
  },


  /* =====================================================
     Admin
     ===================================================== */

  ab:async d=>{
    const b=
      S.admin.bookings.find(
        x=>x.id===d.id
      );

    const body={
      status:d.v
    };

    if(d.v==='confirmed'){
      body.truck=
        $('#ab-truck-'+d.id).value;
    }

    if(d.v==='pickup_scheduled'){
      body.pickup_time=
        $('#ab-time-'+d.id).value;
    }

    if(d.v==='delivered'){
      body.actual_fare=
        +$('#ab-fare-'+d.id).value
        ||
        null;
    }

    if(
      !await confirmBox({
        title:
          `বুকিং "${BOOK_ST[d.v][0]}" করবেন?`,

        body:
          `${PLACES[b.pickup_place].n} → ${PLACES[b.drop_place].n}, ${monTxt(b.qty)}। কৃষক ও পাইকারকে নোটিফিকেশন যাবে।`
      })
    ){
      return;
    }

    await api(
      `/admin/bookings/${d.id}`,
      'POST',
      body
    );

    await refresh();

    toast(
      'হালনাগাদ হয়েছে'
    );
  },

  'at-add':async()=>{
    if(
      !/^01\d{9}$/.test(TK.phone)
      ||
      !TK.driver
      ||
      !TK.number
    ){
      toast(
        'চালক, ১১ সংখ্যার মোবাইল আর গাড়ির নম্বর দিন'
      );

      return;
    }

    await api(
      '/admin/trucks',
      'POST',
      TK
    );

    TK={
      company:'Reroute ট্রাক ',
      driver:'',
      phone:'',
      number:'',
      vehicle:'mini',
      place:'rajshahi',
      areas:''
    };

    await refresh();

    toast(
      'ট্রাক যোগ হয়েছে'
    );
  },

  'at-status':async d=>{
    if(
      !await confirmBox({
        title:
          d.v==='maintenance'
            ? 'ট্রাক মেরামতে পাঠাবেন?'
            : 'ট্রাক আবার চালু করবেন?'
      })
    ){
      return;
    }

    await api(
      `/admin/trucks/${d.id}`,
      'PATCH',
      {
        status:d.v
      }
    );

    await refresh();
  },

  'au-verify':async d=>{
    if(
      !await confirmBox({
        title:'প্রোফাইল যাচাই করবেন?',

        body:
          'কাগজপত্র (NID / ট্রেড লাইসেন্স) দেখে নিশ্চিত হলে যাচাই করুন। ব্যবহারকারী +৫০ পয়েন্ট পাবেন।'
      })
    ){
      return;
    }

    await api(
      `/admin/users/${d.id}/verify`,
      'POST'
    );

    await refresh();
  },


  /* =====================================================
     Inspection — new multi-step workflow
     ===================================================== */

  // Legacy action kept for backward compatibility
  insp:async d=>{
    const action=d.v;
    if(action==='schedule'){
      const reply=($('#insp-reply')?.value||'').trim();
      const time=($('#insp-time')?.value||reply||'সময় নিশ্চিত করা হবে').trim();
      await api(`/inspections/${d.id}/propose-time`,'POST',{proposed_time:time,reply});
    } else if(action==='decline'){
      const reply=($('#insp-reply')?.value||'').trim();
      await api(`/inspections/${d.id}/decline`,'POST',{reply});
    } else if(action==='done'){
      await api(`/inspections/${d.id}/buyer-done`,'POST');
    } else if(action==='cancel'){
      await api(`/inspections/${d.id}/cancel`,'POST');
    }
    await refresh();
    toast('হালনাগাদ হয়েছে');
  },

  // Farmer proposes inspection date/time
  'insp-propose-time':async d=>{
    const time=($('#insp-time')?.value||'').trim();
    const reply=($('#insp-reply')?.value||'').trim();
    if(!time){
      toast('পরিদর্শনের তারিখ ও সময় দিন');
      return;
    }
    await api(`/inspections/${d.id}/propose-time`,'POST',{proposed_time:time,reply});
    await refresh();
    toast('সময় প্রস্তাব পাঠানো হয়েছে');
  },

  // Buyer confirms the proposed schedule
  'insp-confirm-schedule':async d=>{
    const i=(S.inspections||[]).find(x=>x.id===d.id);
    if(!await confirmBox({
      title:'পরিদর্শনের সময় নিশ্চিত করবেন?',
      body:`প্রস্তাবিত সময়: ${esc(i?.proposed_time||'')}। নিশ্চিত করলে কৃষককে জানানো হবে।`,
      ok:'হ্যাঁ, নিশ্চিত করুন'
    })) return;
    await api(`/inspections/${d.id}/confirm-schedule`,'POST');
    await refresh();
    toast('পরিদর্শনের সময় নিশ্চিত হয়েছে');
  },

  // Buyer reports inspection done
  'insp-buyer-done':async d=>{
    if(!await confirmBox({
      title:'মাল দেখার কথা নিশ্চিত করবেন?',
      body:'আপনি কি সত্যিই কৃষকের খামারে গিয়ে মাল দেখেছেন? কৃষক এটি নিশ্চিত করবেন।',
      ok:'হ্যাঁ, দেখেছি'
    })) return;
    await api(`/inspections/${d.id}/buyer-done`,'POST');
    await refresh();
    toast('পরিদর্শন রিপোর্ট পাঠানো হয়েছে');
  },

  // Farmer verifies inspection (confirm=1) or disputes (confirm=0)
  'insp-seller-verify':async d=>{
    const confirm=d.v==='1';
    if(confirm){
      if(!await confirmBox({
        title:'পরিদর্শন নিশ্চিত করবেন?',
        body:'ক্রেতা সত্যিই এসে মাল দেখেছেন? নিশ্চিত করলে পরিদর্শন সম্পন্ন হবে এবং ক্রেতা অফার দিতে পারবেন।',
        ok:'হ্যাঁ, পরিদর্শন হয়েছে'
      })) return;
      await api(`/inspections/${d.id}/seller-verify`,'POST',{confirm:true,note:''});
      await refresh();
      toast('পরিদর্শন সম্পন্ন নিশ্চিত হয়েছে');
    } else {
      const r=await confirmBox({
        title:'পরিদর্শন অস্বীকার করবেন?',
        body:'ক্রেতা আসেননি বলে মনে করলে "অস্বীকার করুন" চাপুন।',
        reason:true,
        chips:['ক্রেতা আসেননি','সময় পরিবর্তন হয়েছে','অন্য কারণ'],
        ok:'কারণসহ অস্বীকার করুন',
        okShort:'অস্বীকার করুন',
        danger:true
      });
      if(!r) return;
      await api(`/inspections/${d.id}/seller-verify`,'POST',{confirm:false,note:r.reason||''});
      await refresh();
      toast('পরিদর্শন অস্বীকার করা হয়েছে');
    }
  },

  // Farmer declines inspection
  'insp-decline':async d=>{
    const r=await confirmBox({
      title:'পরিদর্শনে রাজি নয়?',
      body:'ক্রেতাকে কারণ জানানো হবে।',
      reason:true,
      chips:['এখন সুবিধা নেই','অন্য কারণ'],
      ok:'রাজি নই',
      danger:true
    });
    if(!r) return;
    await api(`/inspections/${d.id}/decline`,'POST',{reply:r.reason||''});
    await refresh();
    toast('পরিদর্শনে রাজি হওয়া হয়নি');
  },

  // Buyer cancels inspection
  'insp-cancel':async d=>{
    if(!await confirmBox({
      title:'পরিদর্শনের অনুরোধ বাতিল করবেন?',
      body:'কৃষককে জানানো হবে।',
      danger:true,
      ok:'বাতিল করুন'
    })) return;
    await api(`/inspections/${d.id}/cancel`,'POST');
    await refresh();
    toast('পরিদর্শনের অনুরোধ বাতিল হয়েছে');
  },


  /* =====================================================
     Transport Cost Negotiation
     ===================================================== */

  // Open transport proposal modal
  'tn-propose':d=>{
    const oid=d.oid;
    const o=(S.orders||[]).find(x=>x.id===oid);
    const tn=(S.transport_negotiations||{})[oid];
    const tTotal=tn?tn.t_total:(o?o.t_total:0);
    const isBuyer=o&&o.buyer===me().id;
    modal(`<div class="body">
      <h2>${ic('🚚')} পরিবহন খরচের প্রস্তাব</h2>
      <p class="muted" style="margin-top:6px">মোট ট্রাক ভাড়া: <b>${tk(tTotal)}</b></p>
      <p class="muted sm" style="margin-top:4px">ক্রেতা ও বিক্রেতার শতাংশের যোগফল ১০০ হতে হবে।</p>
      <div class="grid2" style="gap:10px;margin-top:12px">
        <label class="field"><span>ক্রেতার ভাগ (%)</span>
          <input id="tn-buyer-pct" type="number" min="0" max="100" step="1" value="${isBuyer?100:50}">
        </label>
        <label class="field"><span>বিক্রেতার ভাগ (%)</span>
          <input id="tn-seller-pct" type="number" min="0" max="100" step="1" value="${isBuyer?0:50}">
        </label>
      </div>
      <div id="tn-preview" class="bill" style="margin-top:10px"></div>
      <label class="field" style="margin-top:10px"><span>নোট (ঐচ্ছিক)</span>
        <input id="tn-note" placeholder="কারণ বা মন্তব্য">
      </label>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-soft grow" data-act="close">বাতিল</button>
        <button class="btn btn-green grow" data-act="tn-propose-send" data-oid="${oid}" data-total="${tTotal}">প্রস্তাব পাঠান</button>
      </div>
    </div>`);
    // live preview
    function updatePreview(){
      const bp=+($('#tn-buyer-pct')?.value||0);
      const sp=+($('#tn-seller-pct')?.value||0);
      const el=$('#tn-preview');
      if(el) el.innerHTML=`<div><span>ক্রেতার ভাগ</span><b>${tk(Math.round(tTotal*bp/100))} (${nf(bp,1)}%)</b></div><div><span>বিক্রেতার ভাগ</span><b>${tk(Math.round(tTotal*sp/100))} (${nf(sp,1)}%)</b></div>`;
    }
    setTimeout(()=>{
      $('#tn-buyer-pct')?.addEventListener('input',()=>{
        const bp=+($('#tn-buyer-pct').value||0);
        const sp=100-bp;
        if($('#tn-seller-pct')) $('#tn-seller-pct').value=sp;
        updatePreview();
      });
      $('#tn-seller-pct')?.addEventListener('input',()=>{
        const sp=+($('#tn-seller-pct').value||0);
        const bp=100-sp;
        if($('#tn-buyer-pct')) $('#tn-buyer-pct').value=bp;
        updatePreview();
      });
      updatePreview();
    },50);
  },

  'tn-propose-send':async d=>{
    const bp=+($('#tn-buyer-pct')?.value||0);
    const sp=+($('#tn-seller-pct')?.value||0);
    const note=($('#tn-note')?.value||'').trim();
    if(Math.abs(bp+sp-100)>0.01){
      toast('ক্রেতা ও বিক্রেতার শতাংশের যোগফল ১০০ হতে হবে');
      return;
    }
    if(bp<0||sp<0||bp>100||sp>100){
      toast('শতাংশ ০ থেকে ১০০-এর মধ্যে হতে হবে');
      return;
    }
    await api(`/orders/${d.oid}/transport/propose`,'POST',{buyer_pct:bp,seller_pct:sp,note});
    closeModal();
    await refresh();
    toast('পরিবহন খরচের প্রস্তাব পাঠানো হয়েছে');
  },

  'tn-accept':async d=>{
    const oid=d.oid, pid=d.pid;
    const tn=(S.transport_negotiations||{})[oid];
    const prop=tn&&(tn.proposals||[]).find(p=>p.id===pid);
    if(!await confirmBox({
      title:'পরিবহন খরচের প্রস্তাব গ্রহণ করবেন?',
      body:prop?`ক্রেতার ভাগ: ${tk(prop.buyer_amt)} (${nf(prop.buyer_pct,1)}%), বিক্রেতার ভাগ: ${tk(prop.seller_amt)} (${nf(prop.seller_pct,1)}%)। চুক্তি নিশ্চিত হবে।`:'প্রস্তাব গ্রহণ করবেন?',
      ok:'গ্রহণ করুন'
    })) return;
    await api(`/orders/${oid}/transport/proposals/${pid}/respond`,'POST',{action:'accept',note:''});
    await refresh();
    toast('পরিবহন চুক্তি নিশ্চিত হয়েছে');
  },

  'tn-reject':async d=>{
    const oid=d.oid, pid=d.pid;
    const r=await confirmBox({
      title:'পরিবহন প্রস্তাব প্রত্যাখ্যান করবেন?',
      body:'অন্যপক্ষকে জানানো হবে। নতুন প্রস্তাব দেওয়ার সুযোগ থাকবে।',
      reason:true,
      chips:['ভাগ ঠিক নেই','অন্য প্রস্তাব দিন'],
      ok:'প্রত্যাখ্যান করুন',
      danger:true
    });
    if(!r) return;
    await api(`/orders/${oid}/transport/proposals/${pid}/respond`,'POST',{action:'reject',note:r.reason||''});
    await refresh();
    toast('পরিবহন প্রস্তাব প্রত্যাখ্যান করা হয়েছে');
  },

  'tn-counter':d=>{
    // Open proposal modal (same as propose)
    A['tn-propose'](d);
  }

};


let RT=null;


function drawRate(){
  const o=
    S.orders.find(
      x=>x.id===RT.id
    );

  const other=
    user(
      o.seller===me().id
        ? o.buyer
        : o.seller
    );

  modal(
    `<div class="body" style="text-align:center">

      <h2>
        ${esc(dispName(other))}-কে রেটিং দিন
      </h2>

      <p class="muted">
        ${monTxt(o.qty)}
        ${CROPS[o.crop].n}
      </p>

      <div style="font-size:2.4rem;margin:12px 0">

        ${
          [1,2,3,4,5]
            .map(
              i=>
                `<button
                  data-act="rate-star"
                  data-v="${i}"
                  style="
                    border:0;
                    background:none;
                    font-size:2.4rem;
                    color:${
                      i<=RT.stars
                        ? 'var(--gold)'
                        : 'var(--line)'
                    }
                  "
                  aria-label="${bd(i)} তারা"
                >
                  ★
                </button>`
            )
            .join('')
        }

      </div>

      <input
        id="rt-text"
        maxlength="120"
        placeholder="ছোট মন্তব্য (ঐচ্ছিক)"
        style="
          width:100%;
          border:1.5px solid var(--line);
          border-radius:10px;
          padding:10px;
          background:var(--surface)
        "
      >

      <button
        class="btn btn-green btn-wide"
        style="margin-top:12px"
        data-act="rate-send"
      >
        রেটিং দিন
      </button>

    </div>`
  );
}


/* =====================================================================
   Events
   ===================================================================== */

document.addEventListener(
  'click',
  e=>{
    const el=
      e.target.closest(
        '[data-act]'
      );

    if(!el){
      if(
        !e.target.closest('#npanel')
        &&
        !e.target.closest(
          '[data-act="bell"]'
        )
      ){
        $('#npanel')
          .classList
          .remove('on');
      }

      if(
        e.target.id==='overlay'
      ){
        closeModal();
      }

      if(
        !e.target.closest('#sheet')
      ){
        closeSheet();
      }

      return;
    }

    const fn=
      A[el.dataset.act];

    if(!fn){
      return;
    }

    e.preventDefault();

    if(
      el.dataset.busy
    ){
      return;
    }

    el.dataset.busy='1';

    Promise
      .resolve(
        fn(
          el.dataset,
          el
        )
      )
      .catch(()=>{})
      .finally(()=>{
        delete el.dataset.busy;
      });
  }
);


document.addEventListener(
  'input',
  e=>{
    const t=e.target,
          d=t.dataset,
          v=
            t.type==='checkbox'
              ? t.checked
              : t.value,
          num=
            x=>
              x===''
                ? ''
                : +x;

    if(d.f!==undefined){
      F[d.f]=v;
      renderKeepFocus();
      return;
    }

    if(d.nl!==undefined){
      NL[d.nl]=
        ['mon','price','moq','harvest']
          .includes(d.nl)
          ? num(v)
          : v;

      const s=
        $('#nl-sum');

      if(s){
        s.innerHTML=
          nlSummary();

        applyLanguage(s);
      }

      return;
    }

    if(d.of!==undefined){
      OF[d.of]=
        d.of==='note'
          ? v
          : num(v);

      const b=
        $('#of-bill');

      if(b){
        b.innerHTML=
          offerBill(
            offerCalc()
          );

        applyLanguage(b);
      }

      return;
    }

    if(d.bk!==undefined){
      BK[d.bk]=
        d.bk==='mon'
          ? num(v)
          : v;

      const b=
        $('#bk-bill');

      if(b){
        b.innerHTML=
          bkBill();

        applyLanguage(b);
      }

      return;
    }

    if(d.hf!==undefined){
      HF[d.hf]=v;
      renderKeepFocus();
      return;
    }

    if(d.cl!==undefined){
      CL[d.cl]=
        ['mon','price','other']
          .includes(d.cl)
          ? num(v)
          : v;

      const tmp=
        document.createElement('div');

      tmp.innerHTML=
        calcView();

      $('#calc-out').innerHTML=
        tmp.querySelector(
          '#calc-out'
        ).innerHTML;

      applyLanguage(
        $('#calc-out')
      );

      return;
    }

    if(d.en!==undefined){
      EN[d.en]=v;
      return;
    }

    if(d.pr!==undefined){
      const n=
        parseFloat(v);

      PR[d.pr]=
        isNaN(n)
          ? ''
          : n;

      renderKeepFocus();

      return;
    }

    if(d.ac!==undefined){
      AC[d.ac]=v;
      return;
    }

    if(d.tk!==undefined){
      TK[d.tk]=v;
      return;
    }

    if(d.ai!==undefined){
      AIS[d.ai]=v;
      render();
      return;
    }
  }
);


document.addEventListener(
  'change',
  async e=>{
    const t=e.target,
          a=t.dataset.actChange;

    if(
      t.dataset.f==='sold'
    ){
      F.sold=t.checked;
      render();
      return;
    }

    if(a==='nl-photo'){
      const files=
        [...t.files]
          .slice(
            0,
            3-NL.photos.length
          );

      for(
        const f
        of files
      ){
        try{
          NL.photos.push(
            await shrinkImage(f)
          );
        }
        catch(err){
          toast(
            'ছবি পড়া যায়নি'
          );
        }
      }

      render();
    }

    if(
      a==='ac-photo'
      &&
      t.files[0]
    ){
      try{
        AC.photo=
          await shrinkImage(
            t.files[0],
            400
          );

        render();
      }
      catch(err){
        toast(
          'ছবি পড়া যায়নি'
        );
      }
    }
  }
);


document.addEventListener(
  'keydown',
  e=>{
    if(e.key==='Escape'){
      closeModal();

      $('#npanel')
        .classList
        .remove('on');

      closeSheet();
    }
  }
);


/* =====================================================================
   Live refresh
   ===================================================================== */

setInterval(
  async()=>{
    if(document.hidden){
      return;
    }

    try{
      const r=
        await load();

      if(!r.changed){
        return;
      }

      const a=
        document.activeElement;

      const typing=
        a
        &&
        ['INPUT','SELECT','TEXTAREA']
          .includes(a.tagName);

      const modalOpen=
        $('#overlay')
          .classList
          .contains('on');

      if(
        typing
        ||
        modalOpen
      ){
        renderChrome();
      }
      else{
        render();
      }

      if(r.fresh.length){
        toast(
          '🔔 '
          +
          r.fresh[0]
            .text
            .slice(0,80)
          +
          (
            r.fresh[0]
              .text
              .length>80
              ? '…'
              : ''
          )
        );

        const bell=
          document.querySelector(
            '[data-act="bell"]'
          );

        if(bell){
          bell.classList.add(
            'ring'
          );
        }
      }
    }
    catch(e){}
  },
  5000
);


/* =====================================================================
   Init
   ===================================================================== */

(async function init(){
  $('#view').innerHTML=
    skeleton('cards');

  applyLanguage(
    $('#view')
  );

  try{
    await load();
  }
  catch(e){
    $('#view').innerHTML=
      '<div class="empty">সার্ভার চালু হচ্ছে, কয়েক সেকেন্ড পরে পাতাটি রিফ্রেশ করুন।</div>';

    applyLanguage(
      $('#view')
    );

    return;
  }

  try{
    speechSynthesis.getVoices();
  }
  catch(e){}

  render();
})();
</script>
</body>
</html>
