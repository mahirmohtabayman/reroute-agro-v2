/* ---------- Reroute operations team: platform overview & truck management ---------- */
V.admin = () => {
  const A=S.admin, M=A.metrics, R=M.revenue, total=R.fee+R.service+R.commission+R.plus;
  const ob=M.orders||{}, bb=M.bookings||{};
  return `<div class="phead"><div><h1>📊 প্ল্যাটফর্মের সারাংশ</h1><p class="muted">Reroute অপারেশন টিম</p></div><a class="btn btn-green" href="#/admin/bookings">🚚 ট্রাক বুকিং দেখুন</a></div>
  <div class="grid4"><div class="kpi"><span class="muted sm">কৃষক / পাইকার</span><strong>${nf(M.farmers)} / ${nf(M.paikars)}</strong><span class="muted sm">যাচাইকৃত ${nf(M.verified)}, প্লাস ${nf(M.plus)}</span></div>
    <div class="kpi"><span class="muted sm">চালু লিস্টিং</span><strong>${nf(M.listings_active)}টি</strong><span class="muted sm">খোলা অফার ${nf(M.offers_open)}টি</span></div>
    <div class="kpi"><span class="muted sm">সম্পূর্ণ অর্ডার</span><strong>${nf(ob.completed||0)}টি</strong><span class="muted sm">বাতিল ${nf(ob.cancelled||0)}টি</span></div>
    <div class="kpi"><span class="muted sm">মোট কেনাবেচা</span><strong>${tk(M.gmv)}</strong><span class="muted sm">${monTxt(M.kg)}</span></div></div>
  <div class="grid2" style="margin-top:14px;align-items:start"><div class="panel"><h3>💰 Reroute-এর আয়</h3>
    ${bill([['প্ল্যাটফর্ম ফি (বিক্রির ১%)',tk(R.fee)],['ট্রাক সেবা চার্জ (৮%)',tk(R.service)],['ট্রাক মালিকের কমিশন (৭%)',tk(R.commission)],['প্লাস সাবস্ক্রিপশন',tk(R.plus)],['মোট আয়',tk(total),'tot'],['কৃষকদের ক্যাশব্যাক (খরচ)','−'+tk(M.cashback),'minus'],['নিট',tk(total-M.cashback),'tot']])}
    <p class="muted sm" style="margin-top:8px">এক লেনদেনে একটাই প্ল্যাটফর্ম ফি (বিক্রেতার কাছ থেকে)। ট্রাকে সেবা চার্জ আর কমিশন আলাদা সেবার আয়। এখন এসক্রোতে জমা: ${tk(M.escrow)}</p></div>
  <div class="panel"><h3>অর্ডার ও বুকিং</h3>
    ${Object.entries(ORDER_ST).map(([k,v])=>`<div class="between sm" style="padding:4px 0"><span>${pill(v)}</span><b>${nf(ob[k]||0)}</b></div>`).join('')}<hr>
    ${Object.entries(BOOK_ST).map(([k,v])=>`<div class="between sm" style="padding:4px 0"><span>🚚 ${pill(v)}</span><b>${nf(bb[k]||0)}</b></div>`).join('')}</div></div>
  <div class="panel"><h3>সাম্প্রতিক পেমেন্ট</h3><div class="scroll"><table class="tbl"><tr><th>সময়</th><th>কে</th><th>কীসের</th><th>পদ্ধতি</th><th class="num">টাকা</th><th>অবস্থা</th></tr>
    ${A.payments.slice(0,12).map(p=>`<tr><td>${ago(p.created)}</td><td>${esc(dispName(user(p.uid)))}</td><td>${{order:'অর্ডার',booking:'ট্রাক',plus:'প্লাস'}[p.purpose]}</td><td>${{bkash:'বিকাশ',nagad:'নগদ',card:'কার্ড',wallet:'ওয়ালেট'}[p.method]}</td><td class="num">${tk(p.amount)}</td><td>${pill(p.status==='success'?['সফল','p-green']:p.status==='failed'?['ব্যর্থ','p-red']:['অপেক্ষমাণ','p-gold'])}</td></tr>`).join('')}</table></div></div>`;
};
V.adminBookings = () => {
  const A=S.admin, active=A.bookings.filter(b=>['requested','confirmed','pickup_scheduled','in_transit'].includes(b.status)), rest=A.bookings.filter(b=>!active.includes(b));
  const row = b => { const tr=A.trucks.find(t=>t.id===b.truck), who=user(b.uid), V2=S.config.vehicles;
    let ctl='';
    if(b.status==='requested'){ const opts=A.trucks.filter(t=>['available','booked'].includes(t.status)&&V2[t.vehicle].cap>=Math.min(b.qty,V2.truck.cap)).sort((x,y)=>(y.place===b.pickup_place)-(x.place===b.pickup_place));
      ctl=`<select id="ab-truck-${b.id}">${opts.map(t=>`<option value="${t.id}">${esc(t.company)} · ${V2[t.vehicle].n} · ${PLACES[t.place].n}${t.status==='booked'?' (শেয়ার্ড)':''}</option>`).join('')}</select>
        <button class="btn btn-green btn-sm" data-act="ab" data-id="${b.id}" data-v="confirmed" ${opts.length?'':'disabled'}>ট্রাক দিন ও নিশ্চিত করুন</button>`; }
    if(b.status==='confirmed') ctl=`<input id="ab-time-${b.id}" value="আগামীকাল সকাল ৭টা" style="max-width:180px"><button class="btn btn-blue btn-sm" data-act="ab" data-id="${b.id}" data-v="pickup_scheduled">মাল তোলার সময় ঠিক করুন</button>`;
    if(b.status==='pickup_scheduled') ctl=`<button class="btn btn-blue btn-sm" data-act="ab" data-id="${b.id}" data-v="in_transit">🛣️ মাল উঠেছে, পথে রওনা</button>`;
    if(b.status==='in_transit') ctl=`<label class="sm">আসল ভাড়া ৳ <input id="ab-fare-${b.id}" type="number" value="${b.fare}" style="width:100px"></label><button class="btn btn-green btn-sm" data-act="ab" data-id="${b.id}" data-v="delivered">📍 পৌঁছে গেছে</button>`;
    return `<div class="panel"><div class="between"><div><b>${PLACES[b.pickup_place].n} → ${PLACES[b.drop_place].n}</b> ${pill(BOOK_ST[b.status])} ${b.priority?'<span class="pill p-gold">⭐ অগ্রাধিকার</span>':''} ${b.order_id?'<span class="pill p-grey">অর্ডারের সাথে</span>':''}</div><span class="muted sm">${ago(b.created)}</span></div>
      <div class="muted sm" style="margin-top:4px">${monTxt(b.qty)} ${CROPS[b.crop].n} · ${S.config.vehicles[b.vehicle].n}${b.trucks_n>1?' × '+bd(b.trucks_n):''} · ${nf(b.km)} কিমি · ${esc(b.pickup_addr||'')} → ${esc(b.drop_addr||'')} · ${esc(b.date||'')} · বুক করেছেন ${esc(dispName(who))}</div>
      <div class="sm" style="margin-top:4px">ভাড়া ${tk(b.fare)} + সেবা ${tk(b.service)} = ${tk(b.total)} · কমিশন ${tk(b.commission)}${tr?` · ট্রাক: ${esc(tr.company)}, ${esc(tr.driver)}`:''}${b.pickup_time?` · তোলা: ${esc(b.pickup_time)}`:''}${b.payout?` · ট্রাক মালিক পাবেন ${tk(b.payout)}`:''}</div>
      ${ctl?`<div class="row wrap-it" style="margin-top:10px">${ctl}</div>`:''}</div>`; };
  return `<div class="phead"><div><h1>🚚 ট্রাক বুকিং ব্যবস্থাপনা</h1><p class="muted sm">পেমেন্ট হওয়া বুকিং এখানে আসে। অগ্রাধিকার আগে। প্রতিটি ধাপে কৃষক ও পাইকার নোটিফিকেশন পান।</p></div></div>
    <h3 style="margin-bottom:8px">চলমান (${nf(active.length)})</h3>${active.map(row).join('')||'<div class="empty">চলমান বুকিং নেই</div>'}
    <h3 style="margin:16px 0 8px">আগের ও পেমেন্ট বাকি (${nf(rest.length)})</h3>${rest.map(row).join('')}`;
};
let TK={company:'Reroute ট্রাক ',driver:'',phone:'',number:'',vehicle:'mini',place:'rajshahi',areas:''};
V.adminTrucks = () => {
  const A=S.admin, V2=S.config.vehicles;
  return `<div class="phead"><h1>🛻 ট্রাক বহর</h1></div>
  <div class="grid4">${Object.entries(V2).map(([k,v])=>`<div class="kpi"><span class="muted sm">${v.n}</span><strong>${nf(A.trucks.filter(t=>t.vehicle===k).length)}টি</strong><span class="muted sm">ভিত্তি ${tk(v.base)} + কিমিতে ${tk(v.km)}</span></div>`).join('')}
    <div class="kpi"><span class="muted sm">এখন পথে</span><strong>${nf(A.trucks.filter(t=>t.status==='on_trip').length)}টি</strong></div></div>
  <div class="panel" style="margin-top:14px"><div class="scroll"><table class="tbl"><tr><th>ট্রাক</th><th>গাড়ি</th><th>চালক</th><th>নম্বর</th><th>এলাকা</th><th class="num">ট্রিপ</th><th>অবস্থা</th><th></th></tr>
    ${A.trucks.map(t=>`<tr><td><b>${esc(t.company)}</b><div class="muted xs">${PLACES[t.place].n}</div></td><td>${V2[t.vehicle].n}</td><td>${esc(t.driver)}<div class="muted xs">${bd(t.phone)}</div></td><td>${esc(t.number)}</td><td class="sm">${esc(t.areas||'')}</td><td class="num">${nf(t.trips)}</td>
      <td>${pill({available:['খালি','p-green'],booked:['বুক করা','p-blue'],on_trip:['পথে','p-blue'],maintenance:['মেরামতে','p-grey']}[t.status])}</td>
      <td>${t.status==='available'?`<button class="btn btn-soft btn-sm" data-act="at-status" data-id="${t.id}" data-v="maintenance">মেরামতে পাঠান</button>`:t.status==='maintenance'?`<button class="btn btn-soft btn-sm" data-act="at-status" data-id="${t.id}" data-v="available">চালু করুন</button>`:''}</td></tr>`).join('')}</table></div></div>
  <div class="panel"><h3>নতুন ট্রাক যোগ করুন</h3><div class="grid3" style="gap:10px">
    ${[['company','কোম্পানি/নাম'],['driver','চালকের নাম'],['phone','চালকের মোবাইল'],['number','গাড়ির নম্বর'],['areas','সার্ভিস এলাকা']].map(([k,t])=>`<label class="field"><span>${t}</span><input data-tk="${k}" value="${esc(TK[k])}"></label>`).join('')}
    <label class="field"><span>গাড়ির ধরন</span><select data-tk="vehicle">${Object.entries(V2).map(([k,v])=>`<option value="${k}" ${TK.vehicle===k?'selected':''}>${v.n}</option>`).join('')}</select></label>
    <label class="field"><span>ঘাঁটি</span><select data-tk="place">${Object.entries(PLACES).map(([k,p])=>`<option value="${k}" ${TK.place===k?'selected':''}>${p.n}</option>`).join('')}</select></label></div>
    <button class="btn btn-green" style="margin-top:12px" data-act="at-add">ট্রাক যোগ করুন</button></div>`;
};
V.adminUsers = () => `<div class="phead"><h1>👥 ব্যবহারকারী</h1></div><div class="panel scroll"><table class="tbl"><tr><th>নাম</th><th>ধরন</th><th>এলাকা</th><th>মোবাইল</th><th class="num">পয়েন্ট</th><th class="num">ওয়ালেট</th><th>যাচাই</th></tr>
  ${S.admin.users.map(u=>`<tr><td><a href="#/u/${u.id}">${esc(dispName(u))}</a>${u.role==='paikar'?`<div class="muted xs">${esc(u.name)}</div>`:''}</td><td>${roleBn(u.role)}${u.plus_until>Date.now()?' ⭐':''}</td><td>${esc(u.area||'')}, ${PLACES[u.place].n}</td><td>${bd(u.phone)}</td>
    <td class="num">${nf(u.pts)}</td><td class="num">${tk(u.wallet)}</td><td>${u.verified?'<span class="ver">✔ যাচাইকৃত</span>':`<button class="btn btn-blue btn-sm" data-act="au-verify" data-id="${u.id}">যাচাই করুন</button>`}</td></tr>`).join('')}</table></div>`;
V.adminOrders = () => `<div class="phead"><h1>📦 লেনদেন</h1></div><div class="panel scroll"><table class="tbl"><tr><th>তারিখ</th><th>ফসল</th><th>বিক্রেতা → ক্রেতা</th><th class="num">পরিমাণ</th><th class="num">দাম</th><th class="num">মোট</th><th class="num">ফি</th><th>পরিবহন</th><th>অবস্থা</th></tr>
  ${S.admin.orders.map(o=>`<tr><td>${dateBn(o.created)}</td><td>${CROPS[o.crop].n}</td><td>${esc(dispName(user(o.seller)))} → ${esc(dispName(user(o.buyer)))}</td><td class="num">${monTxt(o.qty)}</td><td class="num">${tk(o.price,1)}</td><td class="num">${tk(o.goods)}</td><td class="num">${tk(o.fee-o.fee_disc)}</td>
    <td>${o.transport==='reroute'?'Reroute':'নিজে'}</td><td>${pill(ORDER_ST[o.status])}${o.reason?`<div class="muted xs">${esc(o.reason)}</div>`:''}</td></tr>`).join('')}</table></div>`;
