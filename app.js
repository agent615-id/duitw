(() => {
"use strict";

/* ==========================================================
   duitw — state, perhitungan, dan render
   Catatan: fungsi perhitungan saldo/piutang/kewajiban
   (signedEffect, balance, debtRemaining, debtPaid, incomeFor,
   expenseFor) dan seluruh handler simpan/hapus/backup/restore
   sama dengan versi sebelumnya. Perubahan hanya pada tampilan.
   ========================================================== */

const KEY = "duitw_v1";
const CATEGORIES = ["Makanan","Transportasi","Belanja","Tagihan","Hiburan","Kesehatan","Pendidikan","Gaji","Bonus","Bisnis","Investasi","Pembayaran Karyawan","Lainnya"];
const DEFAULT = {version:1, accounts:[], transactions:[], debts:[]};
const PALETTE = ["#7488ff","#35d08a","#e0b76d","#f07878","#3cc8d6","#a78bfa","#f59ec1","#8bd17c","#e58f5a","#6fa8dc"];
const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = id => document.getElementById(id);
const qs = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];
const pad2 = n => String(n).padStart(2,"0");
// Tanggal lokal (bukan UTC) agar "hari ini" & "bulan ini" benar di zona waktu WIB dll.
const isoLocal = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const today = () => isoLocal(new Date());
const uid = p => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const rupiah = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Math.round(Number(n)||0));
const num = s => Number(String(s ?? "").replace(/[^\d-]/g,"")) || 0;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtDate = s => s ? new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(s+"T00:00:00")) : "-";
const fmtShort = s => s ? new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}).format(new Date(s+"T00:00:00")) : "-";
const compact = n => { const a=Math.abs(n), s=n<0?"-":""; if(a>=1e9)return s+(a/1e9).toFixed(1).replace(".",",")+" M"; if(a>=1e6)return s+(a/1e6).toFixed(a>=1e7?0:1).replace(".",",")+" jt"; if(a>=1e3)return s+Math.round(a/1e3)+" rb"; return s+Math.round(a); };
const ic = (id, cls="") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${id}"/></svg>`;

function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return x&&x.version===1?x:structuredClone(DEFAULT)}catch{return structuredClone(DEFAULT)}}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));return true}
  catch(err){console.error("duitw: gagal menyimpan data lokal",err);toast("Penyimpanan penuh atau tidak tersedia. Segera buat backup.","error");return false}
}

let state = load();
let currentView = "dashboard";
let debtTab = "receivables";
let txSortDesc = true;
let report = {period:"month", month:today().slice(0,7), account:"all", category:"all", excludePayroll:false};

function toast(msg, type="success"){
  const el=document.createElement("div");el.className=`toast ${type}`;el.setAttribute("role",type==="error"?"alert":"status");el.textContent=msg;
  $("toast-root").append(el);setTimeout(()=>{el.style.transition="opacity .25s, transform .25s";el.style.opacity="0";el.style.transform="translateY(8px)";setTimeout(()=>el.remove(),260)},2800);
}

/* ---------- Perhitungan (tidak diubah) ---------- */
function account(id){return state.accounts.find(a=>a.id===id)}
function debt(id){return state.debts.find(d=>d.id===id)}
function signedEffect(t, accountId){
  const a = t.accountId === accountId;
  const b = t.toAccountId === accountId;
  const amount = Number(t.amount)||0;
  if(t.type==="income" && a) return amount;
  if(t.type==="expense" && a) return -amount;
  if((t.type==="transfer"||t.type==="cash_withdrawal") && a) return -amount;
  if((t.type==="transfer"||t.type==="cash_withdrawal") && b) return amount;
  if(t.type==="receivable_create" && a) return -amount;
  if(t.type==="liability_create" && a) return amount;
  if(t.type==="receivable_payment" && a) return amount;
  if(t.type==="liability_payment" && a) return -amount;
  return 0;
}
function balance(id){return (account(id)?.opening||0)+state.transactions.reduce((s,t)=>s+signedEffect(t,id),0)}
function debtRemaining(d){return Math.max(0,(Number(d.amount)||0)-state.transactions.filter(t=>t.linkedDebtId===d.id && t.type===`${d.kind}_payment`).reduce((s,t)=>s+Number(t.amount||0),0))}
function debtPaid(d){return Math.max(0,(Number(d.amount)||0)-debtRemaining(d))}
function incomeFor(ts){return ts.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0)}
function expenseFor(ts){return ts.filter(t=>t.type==="expense" || t.type==="liability_payment").reduce((s,t)=>s+t.amount,0)}

/* ---------- Metadata tampilan ---------- */
function txTypeLabel(t){return {income:"Pemasukan",expense:"Pengeluaran",transfer:"Transfer",cash_withdrawal:"Tarik tunai",receivable_payment:"Bayar piutang",liability_payment:"Bayar kewajiban",receivable_create:"Piutang baru",liability_create:"Kewajiban baru"}[t.type]||t.type}
const TX_VIS = {
  income:{icon:"down",cls:"t-income"}, expense:{icon:"up",cls:"t-expense"},
  transfer:{icon:"swap",cls:"t-transfer"}, cash_withdrawal:{icon:"cash",cls:"t-cash"},
  receivable_payment:{icon:"in-arrow",cls:"t-rec"}, liability_payment:{icon:"out-arrow",cls:"t-lia"},
  receivable_create:{icon:"hand",cls:"t-rec"}, liability_create:{icon:"hand",cls:"t-lia"}
};
const txVis = t => TX_VIS[t.type] || {icon:"dots",cls:"t-transfer"};
function amountClass(t){
  if(["income","receivable_payment","liability_create"].includes(t.type)) return "positive";
  if(["expense","liability_payment"].includes(t.type)) return "negative";
  return "";
}
function amountText(t){
  if(["transfer","cash_withdrawal"].includes(t.type)) return rupiah(t.amount);
  return (["income","receivable_payment","liability_create"].includes(t.type)?"+":"-")+rupiah(t.amount);
}
function acctKind(type){return {"Bank":["k-bank","bank"],"E-wallet":["k-ewallet","phone"],"Tunai":["k-cash","cash"]}[type]||["k-other","wallet"]}
const KIND_COLOR={"k-bank":"#6b82ef","k-ewallet":"#2eb6c4","k-cash":"#35b583","k-other":"#9a7ff0"};
function sortedTx(){return [...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0))}
function dayLabel(key){
  const t=today(); const y=new Date();y.setDate(y.getDate()-1);
  if(key===t)return "Hari ini"; if(key===isoLocal(y))return "Kemarin";
  return new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long"}).format(new Date(key+"T00:00:00"));
}
function txMeta(t){
  const acc=account(t.accountId)?.name||"-", to=t.toAccountId?` → ${account(t.toAccountId)?.name||"-"}`:"";
  const lead=["income","expense"].includes(t.type)?(t.category||txTypeLabel(t)):txTypeLabel(t);
  return `${lead} · ${acc}${to}`;
}
function txRowHtml(t, {toggle=false, date=false}={}){
  const v=txVis(t), tag=toggle?"button":"div", extra=toggle?` type="button" data-toggle-tx="${t.id}" aria-expanded="false"`:"";
  return `<${tag} class="tx-row"${extra}><span class="tx-ic ${v.cls}">${ic(v.icon)}</span><span class="tx-body"><strong>${esc(t.name)}</strong><small>${esc(txMeta(t))}</small></span><span class="tx-amt ${amountClass(t)}">${amountText(t)}${date?`<small>${fmtShort(t.date)}</small>`:""}</span></${tag}>`;
}

/* ---------- Navigasi ---------- */
const TITLES={dashboard:"Dashboard",transactions:"Transaksi",accounts:"Rekening",debts:"Piutang & Kewajiban",reports:"Laporan",settings:"Data & Pengaturan"};
const EYEBROWS={dashboard:"Ringkasan",transactions:"Semua aktivitas",accounts:"Sumber saldo",debts:"Uang yang belum selesai",reports:"Analisis",settings:"Pengaturan lokal"};
function setView(view){
  const changed = view!==currentView;
  currentView=view;
  qsa(".content").forEach(x=>x.classList.add("hidden"));
  $("view-"+view).classList.remove("hidden");
  qsa(".nav-item,.mobile-nav button[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("view-title").textContent=TITLES[view];
  $("eyebrow").textContent=EYEBROWS[view];
  if(view==="dashboard")renderDashboard(true); if(view==="transactions")renderTransactions(); if(view==="accounts")renderAccounts(); if(view==="debts")renderDebts(); if(view==="reports")renderReports(true);
  if(changed)window.scrollTo({top:0,behavior:"auto"});
}

/* ---------- Select & form ---------- */
function populateSelects(){
  const opts=state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");
  ["tx-account","tx-to-account","debt-account","payment-account"].forEach(id=>{const el=$(id),v=el.value;el.innerHTML=opts;if(v&&state.accounts.some(a=>a.id===v))el.value=v});
  const filter=`<option value="all">Semua rekening</option>`+opts;
  ["transaction-account-filter","report-account"].forEach(id=>{const el=$(id),v=el.value;el.innerHTML=filter;el.value=[...el.options].some(o=>o.value===v)?v:"all"});
  const cats=`<option value="all">Semua kategori</option>`+CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  ["transaction-category-filter","report-category"].forEach(id=>{const el=$(id),v=el.value;el.innerHTML=cats;el.value=[...el.options].some(o=>o.value===v)?v:"all"});
  const txc=$("tx-category"),cv=txc.value;txc.innerHTML=CATEGORIES.map(c=>`<option>${esc(c)}</option>`).join("");if(cv)txc.value=cv;
}

/* ---------- Dashboard ---------- */
function renderDashboard(animate=false){
  const now=new Date(), ym=isoLocal(now).slice(0,7);
  const ts=state.transactions.filter(t=>t.date.startsWith(ym));
  const inc=incomeFor(ts), exp=expenseFor(ts);
  $("dashboard-month").textContent=now.toLocaleDateString("id-ID",{month:"long",year:"numeric"});
  $("stat-balance").textContent=rupiah(state.accounts.reduce((s,a)=>s+balance(a.id),0));
  $("stat-income").textContent=rupiah(inc);
  $("stat-expense").textContent=rupiah(exp);
  $("stat-receivable").textContent=rupiah(state.debts.filter(d=>d.kind==="receivable").reduce((s,d)=>s+debtRemaining(d),0));
  $("stat-liability").textContent=rupiah(state.debts.filter(d=>d.kind==="liability").reduce((s,d)=>s+debtRemaining(d),0));
  $("stat-account-count").textContent=`${state.accounts.length} rekening aktif`;
  const tot=inc+exp, bar=$("ratio-bar");
  bar.querySelector(".r-in").style.width=(tot?inc/tot*100:0)+"%";
  bar.querySelector(".r-out").style.width=(tot?exp/tot*100:0)+"%";

  $("account-summary").innerHTML=state.accounts.length?state.accounts.map(a=>{
    const [k,icon]=acctKind(a.type);
    return `<article class="mini-card ${k}"><div class="mc-top"><span class="mc-ic">${ic(icon,"sm")}</span><strong>${esc(a.name)}</strong></div><div><small>${esc(a.type)}</small><b>${rupiah(balance(a.id))}</b></div></article>`;
  }).join(""):`<div class="mini-empty">Belum ada rekening. <button class="text-btn" data-view-jump="accounts">Tambah rekening</button></div>`;

  const latest=sortedTx().slice(0,6);
  $("recent-transactions").innerHTML=latest.length?`<div class="plain-list">${latest.map(t=>`<div class="tx-item">${txRowHtml(t,{date:true})}</div>`).join("")}</div>`:`<div class="empty"><b>Belum ada transaksi</b>Tambahkan pemasukan atau pengeluaran pertama Anda.</div>`;

  // Arus kas 14 hari terakhir (seluruh transaksi, bukan hanya bulan berjalan)
  const labels=[], a=[], b=[];
  for(let i=13;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);const key=isoLocal(d);labels.push(key);
    const day=state.transactions.filter(t=>t.date===key);a.push(incomeFor(day));b.push(expenseFor(day))}
  registerChart($("cashflow-chart"),$("cashflow-tip"),"line",labels,a,b,animate);
}

/* ---------- Transaksi ---------- */
function filteredTransactions(){
  const q=$("transaction-search").value.trim().toLowerCase(), type=$("transaction-type-filter").value, acc=$("transaction-account-filter").value, cat=$("transaction-category-filter").value;
  let ts=state.transactions.filter(t=>(!q||[t.name,t.note,t.category,txTypeLabel(t)].join(" ").toLowerCase().includes(q))&&(type==="all"||t.type===type)&&(acc==="all"||t.accountId===acc||t.toAccountId===acc)&&(cat==="all"||t.category===cat));
  ts.sort((a,b)=>(b.date.localeCompare(a.date)||b.createdAt-a.createdAt)*(txSortDesc?1:-1)); return ts;
}
function renderTransactions(){
  const ts=filteredTransactions();
  $("tx-summary").innerHTML=ts.length?`<span><b>${ts.length}</b> transaksi</span><span class="positive">Masuk <b>${rupiah(incomeFor(ts))}</b></span><span class="negative">Keluar <b>${rupiah(expenseFor(ts))}</b></span>`:"";
  if(!ts.length){
    $("transaction-table").innerHTML=state.transactions.length?`<div class="panel empty"><b>Tidak ada yang cocok</b>Coba ubah kata kunci atau filter.</div>`:`<div class="panel empty"><b>Belum ada transaksi</b>Ketuk tombol + untuk mencatat transaksi pertama.</div>`;
    return;
  }
  const groups=[];
  ts.forEach(t=>{const g=groups[groups.length-1];if(g&&g.key===t.date)g.items.push(t);else groups.push({key:t.date,items:[t]})});
  $("transaction-table").innerHTML=groups.map(g=>{
    const net=incomeFor(g.items)-expenseFor(g.items);
    return `<div class="tx-day"><span>${esc(dayLabel(g.key))}</span>${net?`<em>${net>0?"+":"-"}${rupiah(Math.abs(net))}</em>`:""}</div><div class="tx-group">${g.items.map(t=>`<div class="tx-item">${txRowHtml(t,{toggle:true})}${t.note?`<div class="tx-note">${esc(t.note)}</div>`:""}<div class="tx-actions"><button class="ghost-btn edit-tx" data-id="${t.id}">${ic("edit","sm")}Edit</button><button class="danger-btn delete-tx" data-id="${t.id}">${ic("trash","sm")}Hapus</button></div></div>`).join("")}</div>`;
  }).join("");
}

/* ---------- Rekening ---------- */
function renderAccounts(){
  const bals=state.accounts.map(a=>({a,bal:balance(a.id)}));
  const total=bals.reduce((s,x)=>s+x.bal,0), pos=bals.filter(x=>x.bal>0).reduce((s,x)=>s+x.bal,0);
  $("accounts-total").innerHTML=state.accounts.length?`<div><small>Total seluruh rekening</small><b>${rupiah(total)}</b></div><div class="share-bar" title="Porsi saldo per rekening">${bals.filter(x=>x.bal>0).map(x=>`<i style="width:${pos?x.bal/pos*100:0}%;background:${KIND_COLOR[acctKind(x.a.type)[0]]}"></i>`).join("")}</div>`:"";
  $("accounts-grid").innerHTML=state.accounts.length?bals.map(({a,bal})=>{
    const [k,icon]=acctKind(a.type);
    return `<article class="wallet ${k}"><div class="wallet-top"><span class="wallet-type">${ic(icon,"sm")}${esc(a.type)}</span><div class="wallet-actions"><button class="edit-account" data-id="${a.id}" aria-label="Edit ${esc(a.name)}">${ic("edit","sm")}</button><button class="delete-account" data-id="${a.id}" aria-label="Hapus ${esc(a.name)}">${ic("trash","sm")}</button></div></div><h3>${esc(a.name)}</h3><div class="wallet-note">${esc(a.note||"Saldo aktif")}</div><div class="wallet-bal">${rupiah(bal)}</div><div class="wallet-open">Saldo awal ${rupiah(a.opening)}</div></article>`;
  }).join(""):`<div class="panel empty" style="grid-column:1/-1"><b>Belum ada rekening</b>Tambahkan rekening dan masukkan saldo awal secara manual.</div>`;
}

/* ---------- Piutang & Kewajiban ---------- */
function daysUntil(dateStr){const a=new Date(today()+"T00:00:00"),b=new Date(dateStr+"T00:00:00");return Math.round((b-a)/86400000)}
function renderDebts(){
  const kind=debtTab==="receivables"?"receivable":"liability", isRec=kind==="receivable";
  qsa(".tab-btn").forEach(x=>x.classList.toggle("active",x.dataset.debtTab===debtTab));
  $("add-debt-m-label").textContent=isRec?"Tambah piutang":"Tambah kewajiban";
  let ds=state.debts.filter(d=>d.kind===kind);
  const remTotal=ds.reduce((s,d)=>s+debtRemaining(d),0), origTotal=ds.reduce((s,d)=>s+(Number(d.amount)||0),0);
  const active=ds.filter(d=>debtRemaining(d)>0), overdueN=active.filter(d=>d.dueDate&&d.dueDate<today()).length, paidN=ds.length-active.length;
  const pct=origTotal?Math.round((origTotal-remTotal)/origTotal*100):0;
  $("debt-summary").innerHTML=`<div class="ds-main ${isRec?"rec":"lia"}"><small>${isRec?"Total piutang belum diterima":"Total kewajiban belum dibayar"}</small><b>${rupiah(remTotal)}</b><div class="ds-bar"><span style="width:${pct}%"></span></div><div class="ds-foot"><span>${isRec?"Sudah diterima":"Sudah dibayar"} ${pct}%</span><span>dari ${rupiah(origTotal)}</span></div></div><div class="ds-mini"><small>Aktif</small><b>${active.length}</b></div><div class="ds-mini"><small>${overdueN?"Lewat tempo":"Lunas"}</small><b class="${overdueN?"negative":""}">${overdueN||paidN}</b></div>`;
  ds=[...ds].sort((a,b)=>{const ra=debtRemaining(a)>0,rb=debtRemaining(b)>0;if(ra!==rb)return ra?-1:1;return (a.dueDate||"9999").localeCompare(b.dueDate||"9999")});
  $("debts-list").innerHTML=ds.length?ds.map(d=>{
    const rem=debtRemaining(d), p=Math.min(100,(debtPaid(d)/(d.amount||1))*100), overdue=d.dueDate&&d.dueDate<today()&&rem>0;
    const left=d.dueDate&&rem>0?daysUntil(d.dueDate):null;
    let st=["active","Aktif"];
    if(rem<=0)st=["paid","Lunas"]; else if(overdue)st=["overdue",`Jatuh tempo ${Math.abs(left)} hari lalu`]; else if(left!==null&&left<=7)st=["soon",left===0?"Jatuh tempo hari ini":`${left} hari lagi`];
    return `<article class="debt-card ${isRec?"rec":"lia"} ${rem<=0?"paid":""} ${overdue?"overdue":""}"><div class="debt-head"><div class="ring" style="--p:${p.toFixed(1)}" role="img" aria-label="${Math.round(p)} persen"><span>${Math.round(p)}%</span></div><div class="debt-info"><h3>${esc(d.party)}</h3><p>${isRec?"Dipinjamkan":"Dipinjam"} ${fmtDate(d.date)}</p><p>Jatuh tempo ${fmtDate(d.dueDate)}</p><span class="status ${st[0]}">${st[0]==="paid"?ic("check","xs"):""}${esc(st[1])}</span></div></div><div class="debt-amounts"><div><small>Sisa</small><b>${rupiah(rem)}</b></div><div class="of"><small>dari</small><b>${rupiah(d.amount)}</b></div></div><div class="debt-actions">${rem>0?`<button class="primary-btn pay-debt" data-id="${d.id}">${isRec?"Terima bayaran":"Bayar"}</button>`:""}<button class="ghost-btn edit-debt" data-id="${d.id}" aria-label="Edit">${ic("edit","sm")}</button><button class="danger-btn delete-debt" data-id="${d.id}" aria-label="Hapus">${ic("trash","sm")}</button></div></article>`;
  }).join(""):`<div class="panel empty" style="grid-column:1/-1"><b>Belum ada ${isRec?"piutang":"kewajiban"}</b>${isRec?"Catat uang yang Anda pinjamkan agar tidak terlupa.":"Catat uang yang Anda pinjam agar jatuh tempo terpantau."}</div>`;
}

/* ---------- Laporan ---------- */
function getReportTransactions(){
  const ym=$("report-month").value||report.month; const period=$("report-period").value, acc=$("report-account").value, cat=$("report-category").value, ex=$("exclude-payroll").checked;
  let ts=state.transactions.filter(t=>["income","expense","liability_payment"].includes(t.type));
  ts=ts.filter(t=>t.date.startsWith(ym));
  if(period==="week"){const d=new Date(ym+"-01T00:00:00"), end=new Date(d);end.setDate(end.getDate()+6);ts=ts.filter(t=>{const x=new Date(t.date+"T00:00:00");return x>=d&&x<=end})}
  if(period==="day"){const day=ym===today().slice(0,7)?today():ym+"-01";ts=ts.filter(t=>t.date===day)}
  if(acc!=="all")ts=ts.filter(t=>t.accountId===acc);
  if(cat!=="all")ts=ts.filter(t=>t.category===cat);
  if(ex)ts=ts.filter(t=>t.category!=="Pembayaran Karyawan");
  return ts;
}
function renderReports(animate=false){
  const ts=getReportTransactions(), inc=incomeFor(ts), exp=ts.filter(t=>t.type==="expense"||t.type==="liability_payment").reduce((s,t)=>s+t.amount,0), net=inc-exp;
  $("report-income").textContent=rupiah(inc);$("report-expense").textContent=rupiah(exp);$("report-net").textContent=rupiah(net);
  const nb=$("report-net");nb.classList.toggle("positive",net>0);nb.classList.toggle("negative",net<0);
  $("report-net-note").textContent=!ts.length?"Belum ada data pada periode ini":net>0?"Surplus — pemasukan lebih besar dari pengeluaran":net<0?"Defisit — pengeluaran melebihi pemasukan":"Seimbang";
  const grouped={};ts.filter(t=>t.type==="expense"||t.type==="liability_payment").forEach(t=>grouped[t.category]=(grouped[t.category]||0)+t.amount);
  const entries=Object.entries(grouped).sort((a,b)=>b[1]-a[1]), max=Math.max(...Object.values(grouped),1), sum=entries.reduce((s,e)=>s+e[1],0);
  if(entries.length){
    let acc=0;const stops=entries.map(([,v],i)=>{const from=acc/sum*100;acc+=v;return `${PALETTE[i%PALETTE.length]} ${from}% ${acc/sum*100}%`}).join(",");
    $("category-breakdown").innerHTML=`<div class="donut-wrap"><div class="donut" style="--g:conic-gradient(${stops})" role="img" aria-label="Komposisi pengeluaran per kategori"><div><span><b>${compact(sum)}</b>keluar</span></div></div></div>`+entries.map(([k,v],i)=>`<div class="category-bar"><i class="cb-dot" style="background:${PALETTE[i%PALETTE.length]}"></i><span class="cb-name">${esc(k)} · ${Math.round(v/sum*100)}%</span><strong>${rupiah(v)}</strong><div class="bar-track"><span style="width:${v/max*100}%;background:${PALETTE[i%PALETTE.length]}"></span></div></div>`).join("");
  } else $("category-breakdown").innerHTML=`<div class="empty"><b>Belum ada pengeluaran</b>Tidak ada pengeluaran pada periode ini.</div>`;
  const rows=[...ts].sort((a,b)=>b.date.localeCompare(a.date));
  $("report-table").innerHTML=rows.length?`<div class="rep-head"><span>Tanggal</span><span>Transaksi</span><span>Kategori</span><span>Rekening</span><span style="text-align:right">Nominal</span></div>`+rows.map(t=>{const isIn=t.type==="income",accn=account(t.accountId)?.name||"-";return `<div class="rep-row"><small class="rd">${fmtDate(t.date)}</small><b>${esc(t.name)}</b><small class="m">${fmtShort(t.date)} · ${esc(t.category)} · ${esc(accn)}</small><small class="rc">${esc(t.category)}</small><small class="ra">${esc(accn)}</small><span class="tx-amt ${isIn?"positive":"negative"}">${isIn?"+":"-"}${rupiah(t.amount)}</span></div>`}).join(""):`<div class="empty"><b>Belum ada data</b>Belum ada data untuk laporan ini.</div>`;
  const labels=[...new Set(ts.map(t=>t.date))].sort();
  const a=[],b=[];labels.forEach(k=>{const day=ts.filter(t=>t.date===k);a.push(incomeFor(day));b.push(day.filter(t=>t.type!=="income").reduce((s,t)=>s+t.amount,0))});
  registerChart($("report-chart"),$("report-tip"),"bars",labels,a,b,animate);
}

/* ---------- Grafik (canvas, tanpa library) ---------- */
const charts = new Map();
function registerChart(canvas, tip, kind, labels, a, b, animate){
  const c={canvas,tip,kind,labels,a,b,hover:-1};
  charts.set(canvas.id,c);bindChart(c);
  paintChart(c,1);
  if(animate&&!reduceMotion&&labels.length){const t0=performance.now();c.anim=true;const step=now=>{const p=Math.min(1,(now-t0)/700);paintChart(c,1-Math.pow(1-p,3));if(p<1&&charts.get(canvas.id)===c)requestAnimationFrame(step);else c.anim=false};requestAnimationFrame(step)}
}
function chartGeom(c,w,h){const pad={l:8,r:8,t:24,b:26};return {pad,innerW:w-pad.l-pad.r,innerH:h-pad.t-pad.b}}
function paintChart(c,progress=1){
  const canvas=c.canvas, rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1, w=Math.max(rect.width,280), h=Math.max(rect.height,200);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
  const x=canvas.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  c.w=w;c.h=h;
  const {pad,innerW,innerH}=chartGeom(c,w,h), {labels,a,b}=c, n=labels.length, max=Math.max(...a,...b,1);
  x.font="11px system-ui,sans-serif";x.textBaseline="alphabetic";
  // grid + label sumbu Y
  for(let i=0;i<4;i++){const y=pad.t+innerH*i/3;x.strokeStyle=i===3?"#2a3850":"#1c283a";x.lineWidth=1;x.setLineDash(i===3?[]:[3,5]);x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke()}
  x.setLineDash([]);x.fillStyle="#5d6c82";x.textAlign="left";x.fillText(compact(max),pad.l,pad.t-8);
  if(!n){x.fillStyle="#5d6c82";x.textAlign="center";x.fillText("Belum ada data",w/2,pad.t+innerH/2);return}
  const px=i=>c.kind==="line"?pad.l+(n<=1?innerW/2:innerW*i/(n-1)):pad.l+innerW*(i+.5)/n;
  const py=v=>pad.t+innerH-(v/max)*innerH;
  // label sumbu X
  x.fillStyle="#66758b";x.textAlign="center";const every=Math.max(1,Math.ceil(n/(w<420?5:8)));
  labels.forEach((l,i)=>{if(i===n-1||(i%every===0&&n-1-i>=Math.ceil(every/2))){const xx=Math.min(w-16,Math.max(16,px(i)));x.fillText(`${+l.slice(8)}/${+l.slice(5,7)}`,xx,h-8)}});
  x.save();x.beginPath();x.rect(0,0,w*progress,h);x.clip();
  if(c.kind==="line"){
    const series=[[a,"#35d08a","53,208,138"],[b,"#f07878","240,120,120"]];
    series.forEach(([arr,col,rgb])=>{
      const path=()=>{x.beginPath();arr.forEach((v,i)=>{const X=px(i),Y=py(v);if(!i)x.moveTo(X,Y);else{const X0=px(i-1),Y0=py(arr[i-1]),mx=(X0+X)/2;x.bezierCurveTo(mx,Y0,mx,Y,X,Y)}})};
      if(n>1){path();x.lineTo(px(n-1),pad.t+innerH);x.lineTo(px(0),pad.t+innerH);x.closePath();const g=x.createLinearGradient(0,pad.t,0,pad.t+innerH);g.addColorStop(0,`rgba(${rgb},.24)`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fill();
        path();x.strokeStyle=col;x.lineWidth=2.4;x.lineJoin="round";x.lineCap="round";x.stroke()}
      else{x.fillStyle=col;x.beginPath();x.arc(px(0),py(arr[0]),4,0,7);x.fill()}
    });
    if(c.hover>=0){const X=px(c.hover);x.strokeStyle="rgba(255,255,255,.22)";x.lineWidth=1;x.beginPath();x.moveTo(X,pad.t);x.lineTo(X,pad.t+innerH);x.stroke();[[a,"#35d08a"],[b,"#f07878"]].forEach(([arr,col])=>{x.fillStyle="#0b121d";x.strokeStyle=col;x.lineWidth=2.4;x.beginPath();x.arc(X,py(arr[c.hover]),4.5,0,7);x.fill();x.stroke()})}
  } else {
    const gw=innerW/n, bw=Math.max(3,Math.min(14,gw*.34));
    if(c.hover>=0){x.fillStyle="rgba(116,136,255,.08)";x.fillRect(pad.l+gw*c.hover,pad.t,gw,innerH)}
    const bar=(X,v,col)=>{if(v<=0)return;const Y=py(v),hh=pad.t+innerH-Y,r=Math.min(4,bw/2,hh);x.fillStyle=col;x.beginPath();x.moveTo(X,pad.t+innerH);x.lineTo(X,Y+r);x.quadraticCurveTo(X,Y,X+r,Y);x.lineTo(X+bw-r,Y);x.quadraticCurveTo(X+bw,Y,X+bw,Y+r);x.lineTo(X+bw,pad.t+innerH);x.closePath();x.fill()};
    labels.forEach((_,i)=>{const cx=px(i);bar(cx-bw-1,a[i],"#35d08a");bar(cx+1,b[i],"#f07878")});
  }
  x.restore();
  showTip(c);
}
function showTip(c){
  const tip=c.tip;if(!tip)return;
  if(c.hover<0||c.hover>=c.labels.length||c.anim){tip.hidden=true;return}
  const i=c.hover,{pad,innerW}=chartGeom(c,c.w,c.h),n=c.labels.length;
  const X=c.kind==="line"?pad.l+(n<=1?innerW/2:innerW*i/(n-1)):pad.l+innerW*(i+.5)/n;
  tip.innerHTML=`<b>${esc(fmtDate(c.labels[i]))}</b><span><i style="background:#35d08a"></i>Masuk ${rupiah(c.a[i])}</span><span><i style="background:#f07878"></i>Keluar ${rupiah(c.b[i])}</span>`;
  tip.hidden=false;
  const half=tip.offsetWidth/2;tip.style.left=Math.max(half+2,Math.min(c.w-half-2,X))+"px";
}
function bindChart(c){
  const cv=c.canvas;if(cv._bound)return;cv._bound=true;
  const idxAt=(e)=>{const cur=charts.get(cv.id);const r=cv.getBoundingClientRect(),X=e.clientX-r.left,n=cur.labels.length;if(!n)return -1;const {pad,innerW}=chartGeom(cur,cur.w||r.width,cur.h||r.height);
    return cur.kind==="line"?(n<=1?0:Math.max(0,Math.min(n-1,Math.round((X-pad.l)/innerW*(n-1))))):Math.max(0,Math.min(n-1,Math.floor((X-pad.l)/(innerW/n))))};
  const set=e=>{const cur=charts.get(cv.id);const i=idxAt(e);if(i!==cur.hover){cur.hover=i;paintChart(cur,1)}};
  cv.addEventListener("pointermove",set);
  cv.addEventListener("pointerdown",set);
  cv.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse"){const cur=charts.get(cv.id);cur.hover=-1;paintChart(cur,1)}});
}
document.addEventListener("pointerdown",e=>{charts.forEach(c=>{if(c.hover>=0&&e.target!==c.canvas){c.hover=-1;paintChart(c,1)}})});

/* ---------- Form & dialog ---------- */
function openTx(type="expense", tx=null){
  populateSelects();$("tx-id").value=tx?.id||"";$("tx-name").value=tx?.name||"";$("tx-amount").value=tx?.amount?new Intl.NumberFormat("id-ID").format(tx.amount):"";$("tx-date").value=tx?.date||today();$("tx-note").value=tx?.note||"";$("tx-category").value=tx?.category||"Lainnya";$("tx-account").value=tx?.accountId||state.accounts[0]?.id||"";$("tx-to-account").value=tx?.toAccountId||state.accounts[1]?.id||state.accounts[0]?.id||"";setTxType(tx?.type||type);$("transaction-modal-title").textContent=tx?"Edit transaksi":"Tambah transaksi";$("transaction-dialog").showModal();
  if(!tx)$("tx-amount").focus();
}
function setTxType(type){$("tx-type").value=type;qsa("[data-tx-type]").forEach(b=>b.classList.toggle("active",b.dataset.txType===type));$("tx-to-wrap").classList.toggle("hidden",!["transfer","cash_withdrawal"].includes(type));if(type==="transfer"||type==="cash_withdrawal")$("tx-category").value="Lainnya"}
function openAccount(a=null){$("account-id").value=a?.id||"";$("account-name").value=a?.name||"";$("account-type").value=a?.type||"Bank";$("account-opening").value=a?.opening??"";$("account-note").value=a?.note||"";$("account-modal-title").textContent=a?"Edit rekening":"Tambah rekening";$("account-opening").disabled=!!a;$("account-dialog").showModal()}
function openDebt(kind,d=null){populateSelects();$("debt-id").value=d?.id||"";$("debt-kind").value=kind;$("debt-party").value=d?.party||"";$("debt-amount").value=d?.amount??"";$("debt-date").value=d?.date||today();$("debt-due").value=d?.dueDate||"";$("debt-account").value=d?.accountId||state.accounts[0]?.id||"";$("debt-note").value=d?.note||"";$("debt-modal-title").textContent=d?"Edit "+(kind==="receivable"?"piutang":"kewajiban"):"Tambah "+(kind==="receivable"?"piutang":"kewajiban");$("debt-help").textContent=kind==="receivable"?"Saat disimpan, dana dipindahkan keluar dari rekening sebagai piutang. Pembayaran akan menambah saldo rekening dan mengurangi sisa piutang.":"Saat disimpan, dana masuk ke rekening sebagai kewajiban. Kewajiban baru tidak dihitung sebagai pemasukan. Pembayaran akan mengurangi saldo rekening dan sisa kewajiban.";$("debt-dialog").showModal()}
function openPayment(d){populateSelects();const rem=debtRemaining(d);$("payment-debt-id").value=d.id;$("payment-kind").value=d.kind;$("payment-amount").value=rem;$("payment-date").value=today();$("payment-account").value=d.accountId||state.accounts[0]?.id||"";$("payment-note").value="";$("payment-title").textContent=d.kind==="receivable"?"Pembayaran piutang":"Pembayaran kewajiban";$("payment-form").dataset.max=rem;$("payment-dialog").showModal()}

/* ---------- Simpan / hapus (logika tidak diubah) ---------- */
function submitTx(e){e.preventDefault();if(!state.accounts.length){toast("Tambahkan rekening terlebih dahulu.","error");return}
  const id=$("tx-id").value,type=$("tx-type").value,name=$("tx-name").value.trim(),amount=num($("tx-amount").value),date=$("tx-date").value,accountId=$("tx-account").value,toAccountId=$("tx-to-account").value;
  if(!name||amount<=0||!date||!accountId){toast("Lengkapi data transaksi.","error");return}
  if(["transfer","cash_withdrawal"].includes(type)&&(!toAccountId||toAccountId===accountId)){toast("Pilih rekening tujuan yang berbeda.","error");return}
  const obj={id:id||uid("tx"),name,amount,date,type,category:$("tx-category").value,accountId,toAccountId:["transfer","cash_withdrawal"].includes(type)?toAccountId:null,note:$("tx-note").value.trim(),createdAt:id?(state.transactions.find(t=>t.id===id)?.createdAt||Date.now()):Date.now()};
  if(id){const i=state.transactions.findIndex(t=>t.id===id);state.transactions[i]={...state.transactions[i],...obj}}else state.transactions.push(obj);
  save();$("transaction-dialog").close();toast(id?"Transaksi diperbarui.":"Transaksi tersimpan.");renderAll();
}
function submitAccount(e){e.preventDefault();const id=$("account-id").value,name=$("account-name").value.trim(),opening=num($("account-opening").value);if(!name){toast("Nama rekening wajib diisi.","error");return}if(id){const a=account(id);a.name=name;a.type=$("account-type").value;a.note=$("account-note").value.trim()}else state.accounts.push({id:uid("acc"),name,type:$("account-type").value,opening,note:$("account-note").value.trim()});save();$("account-dialog").close();toast(id?"Rekening diperbarui.":"Rekening ditambahkan.");renderAll()}
function submitDebt(e){e.preventDefault();if(!state.accounts.length){toast("Tambahkan rekening terlebih dahulu.","error");return}const id=$("debt-id").value,kind=$("debt-kind").value,party=$("debt-party").value.trim(),amount=num($("debt-amount").value),date=$("debt-date").value,accountId=$("debt-account").value;if(!party||amount<=0||!date||!accountId){toast("Lengkapi data piutang/kewajiban.","error");return}
  if(id){const d=debt(id);d.party=party;d.dueDate=$("debt-due").value;d.note=$("debt-note").value.trim()}else{const d={id:uid("debt"),kind,party,amount,date,dueDate:$("debt-due").value,accountId,note:$("debt-note").value.trim(),createdAt:Date.now()};state.debts.push(d);state.transactions.push({id:uid("tx"),name:kind==="receivable_create"?"":(kind==="receivable"?"Piutang: ":"Kewajiban: ")+party,amount,date,type:kind==="receivable"?"receivable_create":"liability_create",category:"Lainnya",accountId,toAccountId:null,note:d.note,linkedDebtId:d.id,createdAt:Date.now()})}
  save();$("debt-dialog").close();toast(id?"Data diperbarui.":"Data tersimpan dan saldo rekening diperbarui.");renderAll()}
function submitPayment(e){e.preventDefault();const d=debt($("payment-debt-id").value),amount=num($("payment-amount").value),max=Number($("payment-form").dataset.max||0),acc=$("payment-account").value;if(!d||amount<=0||amount>max||!acc){toast(amount>max?"Pembayaran melebihi sisa.":"Lengkapi pembayaran.","error");return}
  state.transactions.push({id:uid("tx"),name:(d.kind==="receivable"?"Penerimaan piutang: ":"Pembayaran kewajiban: ")+d.party,amount,date:$("payment-date").value,type:d.kind==="receivable"?"receivable_payment":"liability_payment",category:"Lainnya",accountId:acc,toAccountId:null,note:$("payment-note").value.trim(),linkedDebtId:d.id,createdAt:Date.now()});save();$("payment-dialog").close();toast("Pembayaran tersimpan.");renderAll()}

function deleteTx(id){const t=state.transactions.find(x=>x.id===id);if(!t)return;if(!confirm("Hapus transaksi ini? Perubahan saldo akan dibatalkan."))return;if(t.linkedDebtId&&(t.type==="receivable_create"||t.type==="liability_create")){const d=debt(t.linkedDebtId);if(d&&state.transactions.some(x=>x.linkedDebtId===d.id&&x.type===`${d.kind}_payment`)){toast("Tidak dapat menghapus transaksi pembuka karena sudah ada pembayaran.","error");return}state.debts=state.debts.filter(x=>x.id!==t.linkedDebtId)}state.transactions=state.transactions.filter(x=>x.id!==id);save();toast("Transaksi dihapus.");renderAll()}
function deleteAccount(id){if(state.transactions.some(t=>t.accountId===id||t.toAccountId===id)){toast("Rekening masih memiliki transaksi. Hapus/ubah transaksi terkait terlebih dahulu.","error");return}if(!confirm("Hapus rekening ini?"))return;state.accounts=state.accounts.filter(a=>a.id!==id);save();toast("Rekening dihapus.");renderAll()}
function deleteDebt(id){const d=debt(id);if(!d)return;if(!confirm("Hapus data ini dan transaksi terkait?"))return;state.transactions=state.transactions.filter(t=>t.linkedDebtId!==id);state.debts=state.debts.filter(x=>x.id!==id);save();toast("Data dihapus.");renderAll()}
async function backup(){
  const filename=`duitw-backup-${today()}.json`, content=JSON.stringify(state,null,2);
  if(window.duitwNative?.isNative?.()){
    try{await window.duitwNative.exportFile(filename,content,"application/json");toast("Backup siap disimpan atau dibagikan.")}
    catch(err){console.error(err);toast("Backup gagal dibuat. Coba lagi.","error")}
    return;
  }
  const blob=new Blob([content],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Backup JSON berhasil dibuat.")
}
function restore(){const f=$("restore-json").files[0];if(!f){toast("Pilih file JSON terlebih dahulu.","error");return}const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x||x.version!==1||!Array.isArray(x.accounts)||!Array.isArray(x.transactions)||!Array.isArray(x.debts))throw new Error();if(!confirm("Restore akan mengganti seluruh data saat ini. Lanjutkan?"))return;state=x;save();populateSelects();renderAll();toast("Data berhasil dipulihkan.")}catch{toast("File backup tidak valid.","error")}};r.readAsText(f)}
async function exportCSV(){
  const ts=getReportTransactions(),rows=[["Tanggal","Nama","Jenis","Kategori","Rekening","Rekening Tujuan","Nominal","Catatan"],...ts.map(t=>[t.date,t.name,txTypeLabel(t),t.category,account(t.accountId)?.name||"",account(t.toAccountId)?.name||"",t.amount,t.note||""])];
  const csv="\\ufeff"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\\n");
  const filename=`duitw-laporan-${report.month}.csv`;
  if(window.duitwNative?.isNative?.()){
    try{await window.duitwNative.exportFile(filename,csv,"text/csv");toast("Laporan CSV siap disimpan atau dibagikan.")}
    catch(err){console.error(err);toast("Ekspor CSV gagal.","error")}
    return;
  }
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),link=document.createElement("a");
  link.href=URL.createObjectURL(blob);link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast("CSV berhasil diekspor.")
}
function exportPDF(){window.print()}
function renderAll(){populateSelects();renderDashboard();if(currentView==="transactions")renderTransactions();if(currentView==="accounts")renderAccounts();if(currentView==="debts")renderDebts();if(currentView==="reports")renderReports()}

/* ---------- Event ---------- */
function openDebtForTab(){openDebt(debtTab==="receivables"?"receivable":"liability")}
document.addEventListener("click",e=>{
  const t=e.target;
  const nav=t.closest("[data-view]");if(nav){setView(nav.dataset.view);return}
  const jump=t.closest("[data-view-jump]");if(jump){if(jump.dataset.debtJump)debtTab=jump.dataset.debtJump;setView(jump.dataset.viewJump);return}
  const id=t.closest("button")?.id;
  if(id==="quick-income")openTx("income"); else if(id==="quick-expense"||id==="add-transaction"||id==="dashboard-add-transaction"||id==="fab-add")openTx("expense"); else if(id==="qa-transfer")openTx("transfer");
  else if(id==="add-account"||id==="add-account-m")openAccount(); else if(id==="add-receivable")openDebt("receivable"); else if(id==="add-liability")openDebt("liability"); else if(id==="add-debt-m")openDebtForTab();
  const tg=t.closest("[data-toggle-tx]");if(tg){const item=tg.closest(".tx-item"),open=!item.classList.contains("open");qsa(".tx-item.open").forEach(x=>{x.classList.remove("open");x.querySelector("[data-toggle-tx]")?.setAttribute("aria-expanded","false")});if(open){item.classList.add("open");tg.setAttribute("aria-expanded","true")}return}
  const tx=t.closest(".edit-tx");if(tx)openTx("expense",state.transactions.find(x=>x.id===tx.dataset.id));const dtx=t.closest(".delete-tx");if(dtx)deleteTx(dtx.dataset.id);
  const ea=t.closest(".edit-account");if(ea)openAccount(account(ea.dataset.id));const da=t.closest(".delete-account");if(da)deleteAccount(da.dataset.id);
  const ed=t.closest(".edit-debt");if(ed){const d=debt(ed.dataset.id);openDebt(d.kind,d)}const dd=t.closest(".delete-debt");if(dd)deleteDebt(dd.dataset.id);const pd=t.closest(".pay-debt");if(pd)openPayment(debt(pd.dataset.id));
  const tab=t.closest("[data-debt-tab]");if(tab){debtTab=tab.dataset.debtTab;renderDebts()}
  const chip=t.closest("[data-type-chip]");if(chip){$("transaction-type-filter").value=chip.dataset.typeChip;qsa("[data-type-chip]").forEach(x=>x.classList.toggle("active",x===chip));renderTransactions()}
  const type=t.closest("[data-tx-type]");if(type)setTxType(type.dataset.txType);
});
// Tutup dialog saat area gelap diketuk
qsa("dialog.modal").forEach(dlg=>dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close()}));
window.duitwNative?.onBackButton?.(()=>{
  const openDialog=qsa("dialog[open]")[0];
  if(openDialog){openDialog.close();return}
  if(currentView!=="dashboard"){setView("dashboard");return}
  window.duitwNative?.exitApp?.();
});

$("transaction-form").addEventListener("submit",submitTx);$("account-form").addEventListener("submit",submitAccount);$("debt-form").addEventListener("submit",submitDebt);$("payment-form").addEventListener("submit",submitPayment);
$("tx-cancel").onclick=()=>$("transaction-dialog").close();$("account-cancel").onclick=()=>$("account-dialog").close();$("debt-cancel").onclick=()=>$("debt-dialog").close();$("payment-cancel").onclick=()=>$("payment-dialog").close();
["tx-amount","account-opening","debt-amount","payment-amount"].forEach(id=>$(id).addEventListener("input",e=>{const n=num(e.target.value);e.target.value=n?new Intl.NumberFormat("id-ID").format(n):""}));
["transaction-search","transaction-type-filter","transaction-account-filter","transaction-category-filter"].forEach(id=>$(id).addEventListener(id==="transaction-search"?"input":"change",renderTransactions));
$("transaction-sort").onclick=()=>{txSortDesc=!txSortDesc;$("transaction-sort").textContent=txSortDesc?"Terbaru ↓":"Terlama ↑";renderTransactions()};
$("report-period").onchange=()=>{report.period=$("report-period").value;renderReports(true)};$("report-month").onchange=()=>renderReports(true);$("report-account").onchange=()=>renderReports(true);$("report-category").onchange=()=>renderReports(true);$("exclude-payroll").onchange=()=>renderReports(true);
$("backup-json").onclick=backup;$("restore-btn").onclick=restore;$("export-csv").onclick=exportCSV;$("export-pdf").onclick=exportPDF;
$("clear-data").onclick=()=>{if(confirm("Hapus SELURUH data duitw dari perangkat ini? Tindakan ini tidak dapat dibatalkan.")){state=structuredClone(DEFAULT);save();toast("Semua data lokal dihapus.");renderAll()}};
$("dashboard-month-picker").onclick=()=>setView("reports");
let rz;window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>charts.forEach(c=>{if(c.canvas.offsetParent)paintChart(c,1)}),120)});
window.addEventListener("beforeprint",()=>{if(currentView==="reports"){const c=charts.get("report-chart");if(c)c.hover=-1}});
$("report-month").value=report.month;
renderAll();
})();
