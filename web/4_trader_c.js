/* ---------- stock & accounts (মজুদ ও হিসাব) ---------- */
let BT='stock';
const HF={type:'all',crop:'all',status:'all',days:'all',q:''};
function historyRows(){
  const id=me().id, rows=[];
  (S.orders||[]).forEach(o=>{ const sell=o.seller===id, other=user(sell?o.buyer:o.seller);
    rows.push({at:o.created,type:sell?'sell':'buy',crop:o.crop,qty:o.qty,who:dispName(other),listed:o.listed_price,price:o.price,total:o.goods,
      transport:sell?o.t_seller-o.t_cs:o.t_buyer-o.t_cb,fee:sell?o.fee-o.fee_disc:0,status:o.status,link:`#/order/${o.id}`}); });
  (S.entries||[]).filter(e=>e.kind==='sale').forEach(e=>rows.push({at:e.at,type:'sell',crop:e.crop,qty:e.qty,who:'বাজারের বাইরে: '+(e.note||''),listed:null,price:e.amount/e.qty,total:e.amount,transport:0,fee:0,status:'manual',link:null}));
  return rows.sort((a,b)=>b.at-a.at);
}
V.books = () => {
  const P=S.pnl, inv=S.inventory||[], isP=me().role==='paikar';
  let body='';
  if(BT==='stock') body=`<div class="panel"><div class="between"><h2>📦 আমার কাছে কী মাল আছে</h2><div class="row wrap-it"><button class="btn btn-line btn-sm" data-act="entry-open" data-v="stock">+ মজুদ যোগ</button><button class="btn btn-line btn-sm" data-act="entry-open" data-v="sale">বাজারের বাইরে বিক্রি লিখুন</button></div></div>
    <p class="muted sm" style="margin-top:4px">অর্ডার সম্পূর্ণ হলে মজুদ নিজে থেকে বদলায়। "অর্ডারে আটকে" মানে বিক্রিতে রাজি হয়েছেন কিন্তু এখনো হস্তান্তর হয়নি।</p>
    <div class="scroll"><table class="tbl" style="margin-top:8px"><tr><th>ফসল</th><th class="num">হাতে আছে</th><th class="num">বাজারে তালিকায়</th><th class="num">অর্ডারে আটকে</th><th class="num">তালিকার বাইরে</th><th class="num">এ পর্যন্ত বিক্রি</th><th class="num">এ পর্যন্ত কেনা</th><th class="num">পথে আসছে</th><th class="num">গড় খরচ/কেজি</th></tr>
    ${inv.map(r=>`<tr><td>${CROPS[r.crop].i} ${CROPS[r.crop].n}</td><td class="num b">${monTxt(r.in_hand)}</td><td class="num">${monTxt(r.listed)}</td><td class="num">${monTxt(r.reserved)}</td><td class="num">${monTxt(r.unlisted)}</td>
      <td class="num">${monTxt(r.sold)}</td><td class="num">${monTxt(r.bought)}</td><td class="num">${monTxt(r.incoming)}</td><td class="num">${r.cost!=null?tk(r.cost,1):'<span class="muted">দেওয়া নেই</span>'}</td></tr>`).join('')||'<tr><td colspan="9" class="muted">এখনো কিছু নেই</td></tr>'}</table></div>
    ${inv.some(r=>r.unlisted>0)?`<a class="btn btn-green btn-sm" style="margin-top:10px" href="#/listings/new">তালিকার বাইরের মাল বাজারে দিন</a>`:''}</div>`;
  if(BT==='history'){
    let rows=historyRows(); const cut=HF.days==='all'?0:Date.now()-(+HF.days)*DAY;
    rows=rows.filter(r=>(HF.type==='all'||r.type===HF.type)&&(HF.crop==='all'||r.crop===HF.crop)&&r.at>=cut&&(!HF.q||r.who.includes(HF.q))
      &&(HF.status==='all'||(HF.status==='done'&&['completed','manual'].includes(r.status))||(HF.status==='open'&&['awaiting_payment','confirmed','handed_over'].includes(r.status))||(HF.status==='cancelled'&&r.status==='cancelled')));
    const st=r=>r.status==='manual'?['বাইরে বিক্রি','p-grey']:ORDER_ST[r.status];
    body=`<div class="filters" style="grid-template-columns:repeat(5,1fr)">
      <label><span>ধরন</span><select data-hf="type">${[['all','সব'],['sell','বিক্রি'],['buy','কেনা']].map(([k,t])=>`<option value="${k}" ${HF.type===k?'selected':''}>${t}</option>`).join('')}</select></label>
      <label><span>ফসল</span><select data-hf="crop"><option value="all">সব</option>${Object.entries(CROPS).map(([k,c])=>`<option value="${k}" ${HF.crop===k?'selected':''}>${c.n}</option>`).join('')}</select></label>
      <label><span>অবস্থা</span><select data-hf="status">${[['all','সব'],['done','সম্পূর্ণ'],['open','চলমান'],['cancelled','বাতিল']].map(([k,t])=>`<option value="${k}" ${HF.status===k?'selected':''}>${t}</option>`).join('')}</select></label>
      <label><span>সময়</span><select data-hf="days">${[['7','৭ দিন'],['30','৩০ দিন'],['all','সব সময়']].map(([k,t])=>`<option value="${k}" ${HF.days===k?'selected':''}>${t}</option>`).join('')}</select></label>
      <label><span>কার সাথে</span><input data-hf="q" value="${esc(HF.q)}" placeholder="নাম লিখুন"></label></div>
    <div class="panel scroll"><table class="tbl"><tr><th>তারিখ</th><th>ধরন</th><th>ফসল</th><th class="num">পরিমাণ</th><th>কার সাথে</th><th class="num">তালিকার দাম</th><th class="num">চূড়ান্ত দাম</th><th class="num">মোট</th><th class="num">পরিবহন</th><th class="num">ফি</th><th>অবস্থা</th></tr>
      ${rows.map(r=>`<tr class="${r.link?'click':''}" ${r.link?`data-act="nav" data-to="${r.link}"`:''}><td>${dateBn(r.at)}</td><td>${r.type==='sell'?'বিক্রি':'কেনা'}</td><td>${CROPS[r.crop].n}</td><td class="num">${monTxt(r.qty)}</td><td>${esc(r.who)}</td>
        <td class="num">${r.listed?tk(r.listed,1):'–'}</td><td class="num">${tk(r.price,1)}</td><td class="num b">${tk(r.total)}</td><td class="num">${r.transport?tk(r.transport):'–'}</td><td class="num">${r.fee?tk(r.fee):'–'}</td><td>${pill(st(r))}</td></tr>`).join('')||'<tr><td colspan="11" class="muted">এই ফিল্টারে কিছু নেই</td></tr>'}</table></div>`;
  }
  if(BT==='pnl'){
    const per={}; (S.orders||[]).filter(o=>o.status==='completed'&&o.seller===me().id).forEach(o=>{ const p=per[o.crop]||(per[o.crop]={rev:0,cost:0,unk:0,tr:0,fee:0,cb:0}); p.rev+=o.goods; if(o.cost_basis!=null) p.cost+=o.cost_basis*o.qty; else p.unk+=o.qty; p.tr+=o.t_seller-o.t_cs; p.fee+=o.fee-o.fee_disc; p.cb+=o.cashback||0; });
    (S.entries||[]).filter(e=>e.kind==='sale').forEach(e=>{ const p=per[e.crop]||(per[e.crop]={rev:0,cost:0,unk:0,tr:0,fee:0,cb:0}); p.rev+=e.amount; if(e.cost_basis!=null) p.cost+=e.cost_basis*e.qty; else p.unk+=e.qty; });
    body=`<div class="grid4"><div class="kpi"><span class="muted sm">মোট বিক্রি</span><strong>${tk(P.revenue)}</strong></div><div class="kpi"><span class="muted sm">মোট খরচ</span><strong>${tk(P.expense)}</strong></div>
      <div class="kpi"><span class="muted sm">${P.exact?'লাভ':'আনুমানিক লাভ'}</span><strong style="color:var(--${P.profit>=0?'green':'red'})">${tk(P.profit)}</strong></div><div class="kpi"><span class="muted sm">${isP?'মজুদের জন্য কেনা':'ক্যাশব্যাক পেয়েছেন'}</span><strong>${tk(isP?P.purchases:P.cashback)}</strong></div></div>
    <div class="grid2" style="margin-top:14px;align-items:start"><div class="panel"><h3>হিসাব কীভাবে হলো</h3>
      ${bill([['মোট বিক্রি (Reroute + বাইরে)',tk(P.revenue)],P.cashback?['ক্যাশব্যাক','+'+tk(P.cashback),'plus']:null,[isP?'বিক্রি করা মালের কেনা খরচ':'বিক্রি করা মালের উৎপাদন খরচ','−'+tk(P.cost_of_goods),'minus'],['পরিবহন','−'+tk(P.transport),'minus'],['প্ল্যাটফর্ম ফি','−'+tk(P.fees),'minus'],['অন্যান্য খরচ','−'+tk(P.other),'minus'],[P.exact?'লাভ / ক্ষতি':'আনুমানিক লাভ / ক্ষতি',tk(P.profit),'tot']])}
      ${!P.exact?`<p class="warn sm" style="margin-top:8px">${monTxt(P.unknown_cost_qty)} মালের খরচ জানা নেই, তাই এটা পুরো লাভ নয়। <a href="#/books" data-act="books-tab" data-v="entries">খরচ লিখুন</a></p>`:''}
      ${isP?`<p class="muted sm" style="margin-top:8px">কেনা মাল যতক্ষণ বিক্রি হয়নি, ততক্ষণ সেটা মজুদ (খরচ নয়)। বিক্রি হলে তার কেনা খরচ হিসাবে আসে।</p>`:''}</div>
    <div class="panel"><h3>ফসল অনুযায়ী</h3><div class="scroll"><table class="tbl"><tr><th>ফসল</th><th class="num">বিক্রি</th><th class="num">মালের খরচ</th><th class="num">পরিবহন+ফি</th><th class="num">লাভ</th></tr>
      ${Object.entries(per).map(([k,p])=>`<tr><td>${CROPS[k].n}</td><td class="num">${tk(p.rev)}</td><td class="num">${p.unk?'অসম্পূর্ণ':tk(p.cost)}</td><td class="num">${tk(p.tr+p.fee)}</td><td class="num b">${p.unk?'–':tk(p.rev+p.cb-p.cost-p.tr-p.fee)}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">এখনো বিক্রি নেই</td></tr>'}</table></div></div></div>
    <div class="panel" style="margin-top:14px"><h3>🧮 লাভ-ক্ষতি ক্যালকুলেটর</h3><p class="muted sm">একটি বিক্রির আগে হিসাব করে দেখুন</p><div id="calc">${calcView()}</div></div>`;
  }
  if(BT==='entries') body=`<div class="grid2" style="align-items:start"><div class="panel"><h3>নতুন এন্ট্রি</h3>
      <div class="choice c3" style="margin-top:8px">${[['expense','খরচ'],['sale','বাইরে বিক্রি'],['stock','মজুদ যোগ']].map(([k,t])=>`<button class="opt ${EN.kind===k?'on':''}" data-act="en-kind" data-v="${k}"><strong>${t}</strong></button>`).join('')}</div>
      ${entryForm()}</div>
    <div class="panel"><h3>আগের এন্ট্রি</h3>${(S.entries||[]).map(e=>`<div class="item"><div class="grow"><b>${{expense:'খরচ',sale:'বাইরে বিক্রি',stock:'মজুদ যোগ'}[e.kind]}${e.crop?': '+CROPS[e.crop].n+' '+monTxt(e.qty):''}</b><div class="muted sm">${esc(e.note||'')} · ${dateBn(e.at)}</div></div><b>${tk(e.amount)}</b></div>`).join('')||'<p class="muted">কিছু নেই</p>'}</div></div>`;
  return `<div class="phead"><h1>📒 মজুদ ও হিসাব</h1></div>
    <div class="tabs">${[['stock','📦 মজুদ'],['history','🧾 কেনাবেচার ইতিহাস'],['pnl','📊 লাভ-ক্ষতি'],['entries','✍️ খরচ ও এন্ট্রি']].map(([k,t])=>`<button class="${BT===k?'on':''}" data-act="books-tab" data-v="${k}">${t}</button>`).join('')}</div>${body}`;
};
let EN={kind:'expense',crop:'tomato',mon:10,amount:'',note:''};
function entryForm(){
  return `${EN.kind!=='expense'?`<div class="grid2" style="gap:10px"><label class="field"><span>ফসল</span><select data-en="crop">${Object.entries(CROPS).map(([k,c])=>`<option value="${k}" ${EN.crop===k?'selected':''}>${c.n}</option>`).join('')}</select></label>
    <label class="field"><span>কত মণ</span><input data-en="mon" type="number" min="1" value="${EN.mon}"></label></div>`:''}
    <label class="field"><span>${EN.kind==='expense'?'কত টাকা খরচ':EN.kind==='sale'?'মোট কত টাকায় বিক্রি':'মোট কেনা/উৎপাদন খরচ (ঐচ্ছিক)'}</span><input data-en="amount" type="number" min="0" value="${EN.amount}"></label>
    <label class="field"><span>বিবরণ</span><input data-en="note" maxlength="120" value="${esc(EN.note)}" placeholder="${EN.kind==='expense'?'যেমন: সার, শ্রমিক, ভাড়া':'যেমন: স্থানীয় হাটে'}"></label>
    <button class="btn btn-green btn-wide" style="margin-top:12px" data-act="en-submit">সংরক্ষণ করুন</button>`;
}
let CL=null;
function calcView(){
  const u=me(), inv=(S.inventory||[]).find(r=>r.cost!=null);
  if(!CL) CL={crop:inv?inv.crop:'tomato',mon:25,price:MARKET_DEMO.dhaka[inv?inv.crop:'tomato'],cost:inv?Math.round(inv.cost):'',to:'dhaka',split:'half',other:0};
  const kg=CL.mon*MON, rev=CL.price*kg, fee=u.role==='paikar'||u.role==='farmer'?platformFee(rev):0, q=quote(u.place,CL.to,kg,false,false);
  const tr=CL.split==='none'?0:CL.split==='half'?q.total/2:q.total, cost=CL.cost===''?null:+CL.cost*kg, other=+CL.other||0, profit=rev-fee-tr-other-(cost||0);
  return `<div class="grid4" style="gap:10px"><label class="field"><span>ফসল</span><select data-cl="crop">${Object.entries(CROPS).map(([k,c])=>`<option value="${k}" ${CL.crop===k?'selected':''}>${c.n}</option>`).join('')}</select></label>
    <label class="field"><span>কত মণ</span><input data-cl="mon" type="number" min="5" value="${CL.mon}"></label>
    <label class="field"><span>বিক্রির দাম ৳/কেজি</span><input data-cl="price" type="number" step="0.5" value="${CL.price}"></label>
    <label class="field"><span>${u.role==='paikar'?'কেনা':'উৎপাদন'} খরচ ৳/কেজি</span><input data-cl="cost" type="number" step="0.5" value="${CL.cost}" placeholder="জানা না থাকলে ফাঁকা"></label>
    <label class="field"><span>কোথায় পাঠাবেন</span><select data-cl="to">${Object.entries(PLACES).map(([k,p])=>`<option value="${k}" ${CL.to===k?'selected':''}>${p.n}</option>`).join('')}</select></label>
    <label class="field"><span>ট্রাক ভাড়া আপনার</span><select data-cl="split">${[['half','অর্ধেক'],['all','পুরো'],['none','ক্রেতা দেবেন']].map(([k,t])=>`<option value="${k}" ${CL.split===k?'selected':''}>${t}</option>`).join('')}</select></label>
    <label class="field"><span>অন্যান্য খরচ ৳</span><input data-cl="other" type="number" min="0" value="${CL.other}"></label></div>
    <div id="calc-out" style="margin-top:12px">${bill([['বিক্রি',tk(rev)],cost!=null?['মালের খরচ','−'+tk(cost),'minus']:null,['ট্রাক ভাড়া (Reroute)','−'+tk(tr),'minus'],['প্ল্যাটফর্ম ফি ১%','−'+tk(fee),'minus'],other?['অন্যান্য','−'+tk(other),'minus']:null,[cost!=null?'লাভ / ক্ষতি':'খরচ বাদে হাতে থাকবে (মালের খরচ ছাড়া)',tk(profit),'tot']])}
    ${cost==null?'<p class="warn sm" style="margin-top:6px">মালের খরচ দিলে আসল লাভ দেখাবে।</p>':''}</div>`;
}

/* ---------- price advice in plain language (দাম ও পরামর্শ) ---------- */
const PR={crop:'tomato',mon:25,cost:null};
V.prices = () => {
  const u=me(), isP=u.role==='paikar', c=CROPS[PR.crop], kg=PR.mon*MON;
  const inv=(S.inventory||[]).find(r=>r.crop===PR.crop); if(PR.cost===null) PR.cost=inv&&inv.cost!=null?Math.round(inv.cost*10)/10:'';
  const live=(S.listings||[]).filter(l=>l.crop===PR.crop&&l.status==='active'), avg=live.length?live.reduce((a,l)=>a+l.eff_price,0)/live.length:null;
  const head=`<div class="phead"><div><h1>💡 দাম ও পরামর্শ</h1><p class="muted">সহজ হিসাব: কোথায় ${isP?'কিনে কোথায় বেচলে':'বেচলে'} বেশি টাকা থাকবে</p></div></div>
    <div class="warn" style="margin-bottom:12px">⚠️ সবজির বাজারদর এখানে <b>ডেমো অনুমান</b>, আসল বাজারের তথ্য নয়। Reroute-এর গড় দাম আসল লিস্টিং থেকে নেওয়া। পাইলটে কৃষি বিপণন অধিদপ্তরের দৈনিক দাম বসবে।</div>
    <div class="chips">${Object.entries(CROPS).map(([k,cc])=>`<button class="chip ${PR.crop===k?'on':''}" data-act="pr-crop" data-v="${k}">${cc.i} ${cc.n}</button>`).join('')}</div>
    <div class="row wrap-it" style="margin-bottom:12px"><label class="field" style="margin:0"><span>কত মণ</span><input data-pr="mon" type="number" min="5" value="${PR.mon}" style="width:110px"></label>
      <label class="field" style="margin:0"><span>${isP?'':'আপনার উৎপাদন খরচ ৳/কেজি'}</span>${isP?'':`<input data-pr="cost" type="number" step="0.5" value="${PR.cost}" placeholder="জানা থাকলে" style="width:160px">`}</label></div>`;
  const today=`<div class="panel"><h3>১. আজকের বাজার দর <span class="demo-tag">ডেমো অনুমান</span></h3><div class="scroll"><table class="tbl" style="margin-top:6px"><tr><th>জেলা</th><th class="num">প্রতি কেজি</th><th class="num">প্রতি মণ</th></tr>
    ${Object.entries(PLACES).map(([k,p])=>`<tr><td>${p.n}${k===u.place?' (আপনার)':''}</td><td class="num">${tk(MARKET_DEMO[k][PR.crop])}</td><td class="num">${tk(MARKET_DEMO[k][PR.crop]*MON)}</td></tr>`).join('')}</table></div>
    <p class="note sm" style="margin-top:8px">Reroute-এ এখন ${nf(live.length)}টি ${c.n}ের লিস্টিং${avg?`, গড় দাম ${tk(avg,1)}/কেজি (আসল)`:''}।</p></div>`;
  if(!isP){
    const cost=PR.cost===''?null:+PR.cost;
    const rows=Object.keys(PLACES).map(m=>{ const price=MARKET_DEMO[m][PR.crop], q=quote(u.place,m,kg,u.plus_active,false), rev=price*kg, fee=platformFee(rev), tr=m===u.place?Math.round(kg*0.3):q.total;
      return {m,price,rev,tr,fee,cost:cost!=null?cost*kg:0,net:rev-tr-fee-(cost!=null?cost*kg:0)}; }).sort((a,b)=>b.net-a.net);
    const best=rows[0], home=rows.find(r=>r.m===u.place), mx=Math.max(...rows.map(r=>r.net)), speech=`${PLACES[best.m].n}-এ বেচলে হাতে থাকবে ${nf(Math.round(best.net))} টাকা, নিজের এলাকার চেয়ে ${nf(Math.round(best.net-home.net))} টাকা বেশি।`;
    return head+`<div class="grid2" style="align-items:start">${today}
      <div class="panel"><h3>২. আপনার খরচ (${monTxt(kg)})</h3>${bill([['মালের উৎপাদন খরচ',cost!=null?tk(cost*kg):'দেওয়া নেই'],[`ট্রাক ভাড়া ${PLACES[best.m].n} পর্যন্ত (Reroute)`,tk(best.tr)],['প্ল্যাটফর্ম ফি ১%',tk(best.fee)],['মোট খরচ',tk(best.tr+best.fee+(cost!=null?cost*kg:0)),'tot']])}
        ${cost==null?'<p class="warn sm" style="margin-top:8px">উৎপাদন খরচ দিলে আসল লাভ দেখাবে।</p>':''}</div></div>
      <div class="panel"><h3>৩. বিক্রি করলে কত থাকবে</h3><div class="scroll"><table class="tbl"><tr><th>কোথায়</th><th class="num">বিক্রি</th><th class="num">ট্রাক</th><th class="num">ফি</th>${cost!=null?'<th class="num">উৎপাদন খরচ</th>':''}<th class="num">হাতে থাকবে</th></tr>
        ${rows.map(r=>`<tr><td>${PLACES[r.m].n}</td><td class="num">${tk(r.rev)}</td><td class="num">${tk(r.tr)}</td><td class="num">${tk(r.fee)}</td>${cost!=null?`<td class="num">${tk(r.cost)}</td>`:''}<td class="num b">${tk(r.net)}</td></tr>`).join('')}</table></div></div>
      <div class="panel"><div class="between"><h3>৪. কোথায় বিক্রি করলে বেশি লাভ</h3><button class="iconbtn" data-act="say" data-v="${esc(speech)}" aria-label="শুনুন">🔊</button></div>
        <div class="bars" style="margin-top:8px">${rows.map((r,i)=>`<div class="r"><span>${i===0?'🏆 ':''}${PLACES[r.m].n}</span><i class="${i===0?'best':r.m===u.place?'base':''}" style="width:${Math.max(4,r.net/mx*100)}%"></i><b>${tk(r.net)}</b></div>`).join('')}</div>
        <div class="good" style="margin-top:10px">👉 ${PLACES[best.m].n}-এর পাইকারকে বেচলে নিজের এলাকার চেয়ে প্রায় ${tk(best.net-home.net)} বেশি থাকবে। <a href="#/market">সেখানকার ক্রেতা খুঁজুন</a> বা <a href="#/listings/new">লিস্টিং দিন</a>।</div>
        <p class="muted sm" style="margin-top:8px">${c.n} বেশি দিন রাখা যায় না, তাই দূরের বাজারে পাঠালে পথে নষ্ট হওয়ার কথাও ভাবুন।</p></div>`;
  }
  const sell=MARKET_DEMO[u.place][PR.crop];
  const src=(live.filter(l=>l.uid!==u.id).map(l=>{ const s=user(l.uid), q=myQuote(s.place,u.place,kg), per=l.eff_price+q.total/2/kg; return {l,s,per,profit:(sell-per)*kg,q}; })).sort((a,b)=>a.per-b.per);
  const maxBuy=(sell/1.08)-(src[0]?src[0].q.total/2/kg:0);
  const speech=src.length?`${dispName(src[0].s)}-এর কাছ থেকে কিনে আপনার বাজারে বেচলে আনুমানিক ${nf(Math.round(src[0].profit))} টাকা লাভ।`:'এখন এই ফসলের লিস্টিং নেই।';
  return head+`<div class="grid2" style="align-items:start">${today}
    <div class="panel"><h3>২. আপনার খরচ ও বিক্রি</h3>${bill([[`${PLACES[u.place].n}-এ বেচার দাম (ডেমো)`,tk(sell)+'/কেজি'],[`৮% লাভ রাখতে সর্বোচ্চ কেনা দাম`,tk(maxBuy,1)+'/কেজি','tot']])}
      <p class="muted sm" style="margin-top:8px">সর্বোচ্চ কেনা দাম = বেচার দাম ÷ ১.০৮ − ট্রাক ভাড়ার আপনার অর্ধেক (প্রতি কেজি)। এর বেশি দামে কিনলে লাভ ৮%-এর কম।</p></div></div>
    <div class="panel"><div class="between"><h3>৩–৪. কার কাছ থেকে কিনে বেচলে বেশি লাভ (${monTxt(kg)})</h3><button class="iconbtn" data-act="say" data-v="${esc(speech)}" aria-label="শুনুন">🔊</button></div>
      <div class="scroll"><table class="tbl" style="margin-top:8px"><tr><th>বিক্রেতা</th><th class="num">দাম</th><th class="num">ট্রাক (অর্ধেক)/কেজি</th><th class="num">আপনার খরচ/কেজি</th><th class="num">আনুমানিক লাভ</th><th></th></tr>
      ${src.map((x,i)=>`<tr><td>${i===0?'🏆 ':''}${esc(dispName(x.s))}, ${PLACES[x.s.place].n}</td><td class="num">${tk(x.l.eff_price,1)}</td><td class="num">${tk(x.q.total/2/kg,1)}</td><td class="num">${tk(x.per,1)}</td>
        <td class="num b" style="color:var(--${x.profit>=0?'green':'red'})">${tk(x.profit)}</td><td><a class="btn btn-soft btn-sm" href="#/listing/${x.l.id}">দেখুন</a></td></tr>`).join('')||'<tr><td colspan="6" class="muted">এখন এই ফসলের লিস্টিং নেই</td></tr>'}</table></div>
      <p class="muted sm" style="margin-top:8px">লাভ = (আপনার বাজারদর − কেনা দাম − ট্রাক ভাড়ার অর্ধেক) × পরিমাণ। Reroute ফি বিক্রেতা দেন।</p></div>`;
};

/* ---------- points & wallet ---------- */
V.rewards = () => {
  const u=me(), R=S.config.redeem;
  const ptxBn={opening:'আগের পয়েন্ট',sale:'বিক্রি',purchase:'কেনা',transport:'Reroute ট্রাক',listing_info:'ছবি ও মানের তথ্য',verified:'প্রোফাইল যাচাই',redeem:'ব্যবহার',penalty:'জরিমানা'};
  const wtxBn={payout:'বিক্রির টাকা',cashback:'ক্যাশব্যাক',refund:'ফেরত',payment:'পেমেন্ট',topup:'টাকা যোগ'};
  return `<div class="phead"><h1>⭐ পয়েন্ট ও ওয়ালেট</h1></div>
  <div class="grid2" style="align-items:start"><div>
    <div class="panel" style="background:var(--ink);color:var(--surface)"><span style="opacity:.8">আমার পয়েন্ট</span><div style="font-size:2.3rem;font-weight:700;color:var(--gold)">⭐ ${nf(u.pts)}</div>
      <div class="row wrap-it" style="margin-top:6px;opacity:.9">${u.transport_credit?`<span>🚚 পরিবহন ছাড় জমা: ${tk(u.transport_credit)}</span>`:''}${u.fee_credit?`<span>🧾 ফি ছাড় জমা: ${tk(u.fee_credit)}</span>`:''}</div></div>
    <div class="panel"><h3>পয়েন্ট দিয়ে নিন</h3>${Object.entries(R).map(([k,[n,c,f,v]])=>`<div class="item"><div class="grow"><b>${n}</b><div class="muted sm">⭐ ${nf(c)} পয়েন্ট · ${k==='transport'?'পরের Reroute ট্রাকের ভাড়া থেকে কাটা যাবে (ভাড়ার অর্ধেক পর্যন্ত)':'পরের সফল বিক্রির ১% ফি থেকে কাটা যাবে'}</div></div>
      <button class="btn btn-green btn-sm" data-act="redeem" data-id="${k}" ${u.pts<c?'disabled':''}>নিন</button></div>`).join('')}
      <div class="item"><div class="grow"><b>🎁 ক্যাশব্যাক</b><div class="muted sm">যাচাইকৃত কৃষক ${tk(S.config.cashback_min)} বা বেশির সফল বিক্রিতে ${tk(S.config.cashback)} ক্যাশব্যাক পান, সপ্তাহে ৩ বার পর্যন্ত। নিজে থেকেই ওয়ালেটে আসে।</div></div></div>
      <div class="item"><div class="grow"><b>🚚 অগ্রাধিকার ট্রাক</b><div class="muted sm">যাচাইকৃত কৃষক ও প্লাস সদস্যের বুকিং আগে ট্রাক পায়। ${u.verified?'✔ আপনি পাচ্ছেন':'প্রোফাইল যাচাই হলে পাবেন'}</div></div></div>
      <div class="item"><div class="grow"><b>📦 নিয়মিত ক্রেতা ছাড়</b><div class="muted sm">৩০ দিনে ৫টি বা বেশি কেনা সম্পূর্ণ হলে ট্রাকের সেবা চার্জে ২০% ছাড়। ${u.bulk?'✔ আপনি পাচ্ছেন':''}</div></div></div></div>
    <div class="panel"><h3>পয়েন্ট কীভাবে আসে</h3><ul class="sm" style="margin:8px 0 0;padding-left:18px">
      <li>বিক্রি সম্পূর্ণ হলে প্রতি মণে ১ পয়েন্ট, কিনলে প্রতি ২ মণে ১</li><li>Reroute ট্রাকে মাল পৌঁছালে +১০</li><li>ছবি ও মানের তথ্যসহ লিস্টিং প্রথম বিক্রিতে +১০</li><li>প্রোফাইল যাচাই হলে +৫০</li>
      <li>রাজি হওয়ার পর অর্ডার বাতিল করলে −১০</li></ul>
      <p class="muted sm" style="margin-top:8px">ভুয়া লেনদেন ঠেকাতে: পয়েন্ট আসে শুধু পেমেন্ট হওয়া ও মাল পৌঁছানো অর্ডারে, অন্তত ৳৫,০০০-এর বিক্রিতে, আর একই ক্রেতা-বিক্রেতা জোড়া সপ্তাহে ৩ বারের বেশি নয়।</p></div></div>
  <div><div class="panel"><span class="muted">ওয়ালেট ব্যালান্স</span><div style="font-size:2rem;font-weight:700">${tk(u.wallet)}</div>
      <p class="muted sm">বিক্রির টাকা, ক্যাশব্যাক ও ফেরত টাকা এখানে আসে। পেমেন্টে ব্যবহার করা যায়। পাইলটে বিকাশ/ব্যাংকে তোলা যাবে।</p></div>
    <div class="panel"><h3>ওয়ালেটের লেনদেন</h3>${(S.wallet_tx||[]).map(w=>`<div class="item"><div class="grow"><b>${wtxBn[w.kind]||w.kind}</b><div class="muted sm">${esc(w.note||'')} · ${dateBn(w.at)}</div></div><b style="color:var(--${w.amount>=0?'green':'red'})">${w.amount>=0?'+':''}${tk(w.amount)}</b></div>`).join('')||'<p class="muted">কিছু নেই</p>'}</div>
    <div class="panel"><h3>পয়েন্টের ইতিহাস</h3>${(S.points_tx||[]).map(p=>`<div class="item"><div class="grow"><b>${ptxBn[p.kind]||p.kind}</b><div class="muted sm">${esc(p.note&&p.note.length>4?p.note:'')} ${dateBn(p.at)}</div></div><b style="color:var(--${p.pts>=0?'green':'red'})">${p.pts>=0?'+':''}${nf(p.pts)}</b></div>`).join('')||'<p class="muted">কিছু নেই</p>'}</div></div></div>`;
};

/* ---------- account & Plus ---------- */
let AC=null;
V.account = () => {
  const u=me(); if(!AC) AC={name:u.name,area:u.area||'',biz:u.biz||'',photo:null};
  const until=u.plus_until?dateBn(u.plus_until):'';
  return `<div class="phead"><h1>👤 অ্যাকাউন্ট</h1><a class="btn btn-line" href="#/u/${u.id}">অন্যরা যেভাবে দেখে</a></div>
  <div class="grid2" style="align-items:start"><div class="panel"><h3>প্রোফাইল</h3>
    <div class="row" style="margin-top:10px">${AC.photo?`<span class="av lg"><img src="${AC.photo}" alt=""></span>`:avatar(u,true)}<label class="btn btn-line btn-sm">ছবি বদলান<input type="file" accept="image/*" data-act-change="ac-photo" hidden></label></div>
    <label class="field"><span>নাম</span><input data-ac="name" value="${esc(AC.name)}"></label>
    ${u.role==='paikar'?`<label class="field"><span>আড়ত / ব্যবসার নাম</span><input data-ac="biz" value="${esc(AC.biz)}"></label>`:''}
    <label class="field"><span>উপজেলা / বাজার</span><input data-ac="area" value="${esc(AC.area)}"></label>
    <dl class="kv" style="margin-top:12px"><dt>মোবাইল</dt><dd>${bd(u.phone)}</dd><dt>জেলা</dt><dd>${PLACES[u.place].n}</dd><dt>ধরন</dt><dd>${roleBn(u.role)}</dd>
      <dt>যাচাই</dt><dd>${u.verified?'<span class="ver">✔ যাচাইকৃত</span>':'যাচাই হয়নি'}</dd></dl>
    ${u.verified?'':`<p class="note sm" style="margin-top:8px">যাচাইয়ের জন্য ${u.role==='paikar'?'ট্রেড লাইসেন্স':'জাতীয় পরিচয়পত্র'} জমা দিতে হয়, Reroute অপারেশন টিম যাচাই করে। যাচাই হলে +৫০ পয়েন্ট, অগ্রাধিকার ট্রাক আর ক্যাশব্যাক।</p>`}
    <button class="btn btn-green btn-wide" style="margin-top:12px" data-act="ac-save">সংরক্ষণ করুন</button>
    <button class="btn btn-soft btn-wide" style="margin-top:8px" data-act="logout">বের হন</button></div>
  ${u.role==='paikar'?`<div class="panel" style="${u.plus_active?'outline:2px solid var(--gold)':''}"><h3>⭐ প্লাস সাবস্ক্রিপশন ব্যবস্থাপনা</h3>
    <div style="margin-top:10px">${u.plus_active?(u.plus_cancelled?`<span class="pill p-gold">বন্ধ করা হয়েছে</span> <span class="sm">${until} পর্যন্ত চালু থাকবে, তারপর আর নবায়ন হবে না</span>`:`<span class="pill p-green">চালু</span> <span class="sm">মেয়াদ ${until} পর্যন্ত</span>`):'<span class="pill p-grey">চালু নেই</span>'}</div>
    <ul class="sm" style="margin:12px 0 0;padding-left:18px"><li>জরুরি বিক্রির খবর সবার আগে</li><li>ট্রাকের সেবা চার্জে ২৫% ছাড়</li><li>অগ্রাধিকার ট্রাক বুকিং</li></ul>
    <p class="muted sm" style="margin-top:8px">দাম ${tk(S.config.plus_price)}, মেয়াদ ${nf(S.config.plus_days)} দিন। পেমেন্ট সফল হলেই চালু হয়।</p>
    ${u.plus_active?(u.plus_cancelled?`<button class="btn btn-green btn-wide" style="margin-top:12px" data-act="plus-resume">আবার নবায়ন চালু করুন</button>`:`<button class="btn btn-soft btn-wide" style="margin-top:12px" data-act="plus-cancel">প্লাস বন্ধ করুন</button>`)
      :`<button class="btn btn-ink btn-wide" style="margin-top:12px" data-act="plus-buy">প্লাস নিন (${tk(S.config.plus_price)})</button>`}
    ${(S.payments||[]).filter(p=>p.purpose==='plus').map(p=>`<p class="muted xs" style="margin-top:6px">${dateBn(p.created)}: ${tk(p.amount)} · ${p.status==='success'?'সফল':p.status==='failed'?'ব্যর্থ':'অপেক্ষমাণ'}</p>`).join('')}</div>`
  :`<div class="panel"><h3>নিরাপত্তা ও গোপনীয়তা</h3><p class="sm" style="margin-top:8px">আপনার ফোন নম্বর শুধু তারাই দেখেন যাদের সাথে পেমেন্ট হওয়া অর্ডার আছে। টাকার হিসাব আর লেনদেনের বিস্তারিত শুধু আপনি দেখেন। প্রোফাইলে অন্যরা দেখেন: নাম, এলাকা, রেটিং, কতগুলো লেনদেন সম্পূর্ণ করেছেন।</p></div>`}</div>`;
};
