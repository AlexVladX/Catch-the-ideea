(function(){
"use strict";
const STAGES={
  nou:{label:"Noi",one:"Încă nedecis",state:"Nedecisă",hint:"Încă neanalizată"},
  acum:{label:"Lucrez acum",one:"Lucrez acum",state:"Lucrez acum la ea",hint:"Maximum 2 idei deodată"},
  explorez:{label:"Testez",one:"Testez",state:"O testez",hint:"Lucruri mici, fără grabă"},
  parcare:{label:"Mai târziu",one:"Mai târziu",state:"Pentru mai târziu",hint:"O recitesc la o dată"},
  realizat:{label:"Realizate",one:"Am realizat-o",state:"Realizată",hint:"Am pus-o în practică"},
  renuntat:{label:"Renunțate",one:"Renunț",state:"Renunțată",hint:"Nu o mai urmăresc"}
};
const CRIT=[
  ["potential","Potențial de câștig",["Foarte mic","Mic","Mediu","Mare","Foarte mare"]],
  ["viteza","Primii bani vin",["Foarte târziu","Târziu","Mediu","Repede","Foarte repede"]],
  ["cost","Cost de pornire",["Foarte mare","Mare","Mediu","Mic","Foarte mic"]],
  ["timp","Timp cerut",["Foarte mult","Mult","Mediu","Puțin","Foarte puțin"]],
  ["durabil","Are sens pe termen lung",["Deloc","Puțin","Posibil","Probabil","Sigur"]]
];
const DRAFT_KEY="atelier-draft", MAX_ACUM=2, REVIEW_DAYS=7, CFG=window.ATELIER_CONFIG||{};
let sb=null, user=null, ideas=[], meta={}, loaded=false, view="azi", filter="acum";
let draft=null, draftId=null, advice="";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* Date locale, ca text AAAA-LL-ZZ */
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const parse=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const today=()=>iso(new Date());
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const diff=(a,b)=>Math.round((parse(a)-parse(b))/864e5);
const nice=s=>parse(s).toLocaleDateString("ro-RO",{day:"numeric",month:"short"});
function dueLabel(s){
  if(!s)return{t:"fără termen",c:""};
  const n=diff(s,today());
  if(n<0)return{t:(n===-1?"întârziat 1 zi":"întârziat "+(-n)+" zile"),c:"late"};
  if(n===0)return{t:"azi",c:"today"};
  if(n===1)return{t:"mâine",c:"today"};
  return{t:nice(s),c:""};
}

/* Recomandarea din note */
function advise(s){
  const v=CRIT.map(c=>s&&s[c[0]]);
  if(v.some(x=>!x))return null;
  const total=v.reduce((a,b)=>a+b,0);
  const quick=(s.viteza+s.cost+s.timp)/3, long=(s.potential+s.durabil)/2;
  if(total<=9)return{stage:"renuntat",total,why:"Notele sunt mici pe aproape toate criteriile."};
  if(quick>=3.5&&s.potential>=3)return{stage:"acum",total,why:"Pornește repede, cu puțini bani și are potențial."};
  if(long>=3.7)return{stage:"explorez",total,why:"Merită pe termen lung. Începe cu pași mici de cercetare."};
  return{stage:"parcare",total,why:"Nu este prioritară acum. Pune o dată la care o recitești."};
}

function attentionItems(){
  const t=today(), out=[];
  ideas.forEach(i=>{
    if(i.stage==="nou"&&diff(t,(i.createdAt||t).slice(0,10))>=3)out.push({i,msg:"Așteaptă analiza"});
    if((i.stage==="acum"||i.stage==="explorez")&&!i.nextStep)out.push({i,msg:"Alege ce faci mai departe"});
    if((i.stage==="acum"||i.stage==="explorez")&&i.decisionDate&&i.decisionDate<=t)out.push({i,msg:"A venit data deciziei"});
    if(i.stage==="parcare"&&i.reviewDate&&i.reviewDate<=t)out.push({i,msg:"E timpul să o recitești"});
  });
  return out;
}
const needsReview=()=>ideas.filter(i=>(i.stage==="acum"||i.stage==="explorez")&&(!i.lastReviewed||diff(today(),i.lastReviewed)>=REVIEW_DAYS)).sort((a,b)=>(a.lastReviewed||"").localeCompare(b.lastReviewed||""));
const steps=()=>ideas.filter(i=>i.nextStep&&(i.stage==="acum"||i.stage==="explorez")).sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));

/* Randare */
function ideaRow(i,opts){
  opts=opts||{};
  const d=dueLabel(i.dueDate), a=advise(i.scores);
  let m="";
  if(opts.step){
    m=`<span class="pill ${d.c}">${esc(d.t)}</span><span>${esc(i.title)}</span>`;
    return `<li><div class="row"><button class="tick" type="button" data-done="${esc(i.id)}" aria-label="Bifează: ${esc(i.nextStep)}"><span></span></button>
    <button class="open" type="button" data-open="${esc(i.id)}"><strong>${esc(i.nextStep)}</strong><span class="meta">${m}</span></button></div></li>`;
  }
  if(opts.review)m=`<span>${i.lastReviewed?"Revizuită pe "+esc(nice(i.lastReviewed)):"Nerevizuită încă"}</span>`;
  else if(opts.msg)m=`<span class="pill today">${esc(opts.msg)}</span>`;
  else if(i.stage==="realizat")m=`<span>${i.doneDate?"Realizată pe "+esc(nice(i.doneDate)):"Realizată"}</span>`;
  else if(i.stage==="parcare"&&i.reviewDate)m=`<span>Recitesc pe ${esc(nice(i.reviewDate))}</span>`;
  else if(i.nextStep)m=`<span class="pill ${d.c}">${esc(d.t)}</span><span>${esc(i.nextStep)}</span>`;
  else if(i.stage==="nou")m=`<span>Adăugată pe ${esc(nice((i.createdAt||today()).slice(0,10)))}</span>`;
  if(a&&!opts.msg)m+=`<span>${a.total}/25</span>`;
  return `<li><button class="open pad" type="button" data-open="${esc(i.id)}"><strong>${esc(i.title)}</strong><span class="meta">${m}</span></button></li>`;
}
function renderAzi(){
  const att=attentionItems();
  $("attention").innerHTML=att.length?`<div class="section"><div class="section-head"><h2>Cere o decizie</h2><span class="count">${att.length}</span></div><ul class="list">${att.map(x=>ideaRow(x.i,{msg:x.msg})).join("")}</ul></div>`:"";
  const s=steps();
  let html=`<div class="section"><div class="section-head"><h2>De făcut</h2><span class="count">${s.length}</span></div>`;
  if(s.length)html+=`<ul class="list">${s.map(i=>ideaRow(i,{step:true})).join("")}</ul>`;
  else html+=`<p class="empty" style="margin:0">${loaded?"Aici apare ce ai de făcut, cu termene. Adaugă o idee, analizeaz-o și alege „Lucrez acum” sau „Testez”.":"Se încarcă ideile tale…"}</p>`;
  $("todo").innerHTML=html+"</div>";
}
function renderIdei(){
  const n=k=>ideas.filter(i=>i.stage===k).length;
  const active=n("acum")+n("explorez");
  const withStep=steps().length;
  $("pipeline").innerHTML=[["Prind",n("nou")],["Analizez",ideas.filter(i=>advise(i.scores)&&i.stage!=="renuntat"&&i.stage!=="realizat").length],["Decid",active+n("parcare")],["Acționez",withStep]]
    .map(p=>`<div><b>${p[1]}</b>${p[0]}</div>`).join("");
  $("chips").innerHTML=Object.keys(STAGES).map(k=>`<button class="chip" type="button" data-filter="${k}" aria-pressed="${filter===k}">${STAGES[k].label} ${n(k)}</button>`).join("");
  $("ideaWarn").innerHTML=(filter==="acum"&&n("acum")>MAX_ACUM)?`<p class="warn" style="margin:0">Ai ${n("acum")} idei la „Lucrez acum”. Lasă cel mult ${MAX_ACUM}, ca fiecare să primească timp real.</p>`:"";
  const rows=ideas.filter(i=>i.stage===filter).sort((a,b)=>(advise(b.scores)?.total||0)-(advise(a.scores)?.total||0));
  $("ideaList").innerHTML=rows.length?`<ul class="list">${rows.map(i=>ideaRow(i)).join("")}</ul>`:`<p class="empty" style="margin:0">${loaded?"Nicio idee aici.":"Se încarcă ideile tale…"}</p>`;
}
function renderRevizuire(){
  const t=today(), n=k=>ideas.filter(i=>i.stage===k);
  const late=steps().filter(i=>i.dueDate&&i.dueDate<t).length;
  const nostep=ideas.filter(i=>(i.stage==="acum"||i.stage==="explorez")&&!i.nextStep).length;
  const dec=ideas.filter(i=>(i.stage==="acum"||i.stage==="explorez")&&i.decisionDate&&i.decisionDate<=addDays(t,7)).length;
  const park=n("parcare").filter(i=>i.reviewDate&&i.reviewDate<=addDays(t,7)).length;
  const items=[[n("nou").length,"Analizează ideile noi","Dă note și alege unde merge fiecare."],[late,"Rezolvă ce a întârziat","Fă lucrul, mută termenul sau alege altceva."],[nostep,"Alege ce faci mai departe la ideile active","O idee fără nimic de făcut nu avansează."],[dec,"Ia deciziile din următoarele 7 zile","Continui, schimbi direcția sau te oprești."],[park,"Recitește ideile puse pentru mai târziu","Le activezi sau le muți data."],[needsReview().length,"Revizuiește ideile active","Deschide fiecare idee din lista de mai jos și apasă „Am revizuit ideea”."]];
  $("reviewList").innerHTML=items.map(x=>`<li><div class="check"><b class="${x[0]?"":"zero"}">${x[0]}</b><span>${x[1]}<small>${x[2]}</small></span></div></li>`).join("");
  let box=$("reviewIdeas");
  if(!box){box=document.createElement("div");box.id="reviewIdeas";box.className="section";$("reviewList").after(box)}
  const rv=needsReview();
  box.hidden=!rv.length;
  box.innerHTML=rv.length?`<div class="section-head"><h2>Idei de revizuit</h2><span class="count">${rv.length}</span></div><ul class="list">${rv.map(i=>ideaRow(i,{review:true})).join("")}</ul>`:"";
  $("reviewLast").textContent=meta.lastReview?("Ultima revizuire: "+nice(meta.lastReview)+" · Următoarea: "+nice(addDays(meta.lastReview,7))):"Fă-o o dată pe săptămână, la aceeași oră.";
}
function render(){
  renderAzi();renderIdei();renderRevizuire();
  const c=attentionItems().length+steps().filter(i=>i.dueDate&&i.dueDate<=today()).length;
  $("navBadge").innerHTML=c?`<span class="badge">${c}</span>`:"";
}
function show(v){
  view=v;
  ["azi","idei","revizuire"].forEach(k=>{$("view-"+k).hidden=k!==v});
  document.querySelectorAll("nav button").forEach(b=>{b.dataset.view===v?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current")});
  window.scrollTo(0,0);
}
let toastT;
function toast(m,undo){const t=$("toast");t.textContent=m;if(undo){const b=document.createElement("button");b.type="button";b.textContent="Anulează";b.onclick=()=>{t.hidden=true;undo()};t.appendChild(b)}t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true},undo?7000:3200)}

/* Date: Supabase, cu copie locală și coadă pentru ideile noi */
const K=n=>"atelier-"+n+"-"+(user?user.id:"anon");
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(_){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
const newId=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():"i"+Date.now().toString(36)+Math.random().toString(36).slice(2);
function withTimeout(p){return Promise.race([p,new Promise((_,r)=>setTimeout(()=>r({code:"timeout"}),12000))])}
function failMsg(){return navigator.onLine===false?"Nu ai internet. Încearcă din nou când revii online.":"Nu am putut salva. Încearcă din nou."}
const check=r=>{if(r&&r.error)throw r.error;return r};
async function putIdea(id,data){check(await withTimeout(sb.from("ideas").upsert({user_id:user.id,id,data,updated_at:new Date().toISOString()},{onConflict:"user_id,id"})))}
function setLocal(id,data){const i=ideas.findIndex(x=>x.id===id),row=Object.assign({id},data);if(i<0)ideas.push(row);else ideas[i]=row;lsSet(K("cache"),ideas);render()}
let boxMem=null,boxFor="";
function getBox(){const k=K("outbox");if(boxFor!==k){boxFor=k;boxMem=lsGet(k,[])}return boxMem}
function setBox(v){boxFor=K("outbox");boxMem=v;lsSet(boxFor,v)}
function queue(id,data){setBox(getBox().filter(x=>x.id!==id).concat([{id,data,t:Date.now()+Math.random()}]))}
async function doFlush(){
  if(!user)return false;
  for(const it of getBox().slice()){
    try{await putIdea(it.id,it.data);setBox(getBox().filter(x=>!(x.id===it.id&&x.t===it.t)))}catch(_){return false}
  }
  return true;
}
let flushChain=Promise.resolve();
function flushOutbox(){const p=flushChain.then(doFlush,doFlush);flushChain=p.catch(()=>{});return p}
const mergeBox=()=>getBox().forEach(b=>{const k=ideas.findIndex(i=>i.id===b.id),row=Object.assign({id:b.id},b.data);if(k<0)ideas.push(row);else ideas[k]=row});
let refreshing=false;
async function refresh(){
  if(!user||refreshing)return; refreshing=true;
  try{
    await flushOutbox();
    const r=check(await withTimeout(sb.from("ideas").select("id,data")));
    ideas=r.data.map(x=>Object.assign({id:x.id},x.data));
    mergeBox();
    lsSet(K("cache"),ideas);
    const s=check(await withTimeout(sb.from("user_settings").select("last_review,target_date").maybeSingle()));
    meta=s.data?{lastReview:s.data.last_review||"",targetDate:s.data.target_date||""}:{};
    lsSet(K("meta"),meta);
    status("");
  }catch(_){status(navigator.onLine===false?"Lucrezi fără internet. Ideile noi se trimit când revii online.":"Nu pot actualiza ideile acum. Vezi ultima copie salvată pe acest dispozitiv.")}
  loaded=true;refreshing=false;drawTarget();render();
}
async function saveSettings(patch){
  meta=Object.assign({},meta,patch);lsSet(K("meta"),meta);
  check(await withTimeout(sb.from("user_settings").upsert({user_id:user.id,last_review:meta.lastReview||null,target_date:meta.targetDate||null,updated_at:new Date().toISOString()},{onConflict:"user_id"})));
}

/* Captură */
$("captureText").addEventListener("input",e=>{try{localStorage.setItem(DRAFT_KEY,e.target.value)}catch(_){}});
try{const d=localStorage.getItem(DRAFT_KEY);if(d)$("captureText").value=d}catch(_){}
$("captureForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const el=$("captureText"), text=el.value.trim();
  if(!text){el.focus();return}
  const lines=text.split("\n"), title=lines[0].slice(0,90), note=(lines[0].length>90?lines[0].slice(90)+"\n":"")+lines.slice(1).join("\n");
  const id=newId(), data={title,note:note.trim(),stage:"nou",scores:{},nextStep:"",dueDate:"",test:"",decisionDate:"",stopRule:"",reviewDate:"",log:[],createdAt:new Date().toISOString()};
  queue(id,data);
  setLocal(id,data);
  el.value="";try{localStorage.removeItem(DRAFT_KEY)}catch(_){}
  const ok=await flushOutbox();
  toast(ok?"Idee salvată în Noi.":"Idee păstrată pe dispozitiv. O trimit când revii online.");
});

/* Fișa ideii */
let openSec={}, saveT=null, dirty=false, sheetStage="";
function openSheet(id,focusStep){
  const i=ideas.find(x=>x.id===id); if(!i)return;
  draft=JSON.parse(JSON.stringify(i)); draft.scores=draft.scores||{}; draftId=id; advice=""; dirty=false; sheetStage=draft.stage;
  const isNew=draft.stage==="nou";
  openSec={note:isNew,analiza:isNew,plan:!isNew||!!focusStep,istoric:false};
  drawSheet();setSaveState("Modificările se salvează singure");
  $("sheet").hidden=false;$("sheetBar").hidden=false;$("sheet").scrollTop=0;document.body.style.overflow="hidden";
  if(focusStep){const f=$("fStep");if(f){f.scrollIntoView({block:"center"});f.focus()}}
}
function closeSheet(skip){
  if(draft&&!skip){
    if(dirty&&!draft.title.trim())toast("Ideea nu are titlu, așa că ultimele modificări nu s-au salvat.");
    else if(dirty)saveDraft();
    if(draft.stage!==sheetStage){filter=draft.stage;renderIdei()}
  }
  clearTimeout(saveT);saveT=null;dirty=false;
  draft=null;draftId=null;$("sheet").hidden=true;$("sheetBar").hidden=true;document.body.style.overflow="";
}
function setSaveState(t){const s=$("saveState");if(s)s.textContent=t}
function touch(now){
  dirty=true;clearTimeout(saveT);
  if(now)saveDraft();else{setSaveState("Se salvează…");saveT=setTimeout(saveDraft,800)}
}
async function saveDraft(){
  clearTimeout(saveT);saveT=null;
  if(!draft)return;
  if(!draft.title.trim()){setSaveState("Scrie un titlu ca să pot salva");return}
  dirty=false;
  const {id,...data}=JSON.parse(JSON.stringify(draft)), forId=draftId;
  queue(forId,data);setLocal(forId,data);setSaveState("Se salvează…");
  const ok=await flushOutbox();
  if(draftId===forId&&!dirty)setSaveState(ok?"Salvat":"Salvat pe dispozitiv. Trimit când revii online.");
}
function heads(){
  const a=advise(draft.scores), s=draft.stage, note=(draft.note||"").trim().replace(/\s+/g," ");
  return {
    note:note?(note.length>34?note.slice(0,34)+"…":note):"Fără note",
    analiza:a?"Scor "+a.total+" din 25":"Neanalizată",
    plan:STAGES[s].state,
    istoric:draft.lastReviewed?"Revizuită pe "+nice(draft.lastReviewed):"Nerevizuită încă"
  };
}
function summaryHtml(){
  const s=draft.stage, d=dueLabel(draft.dueDate), a=advise(draft.scores);
  let rows=`<strong>${esc(STAGES[s].state)}${s==="realizat"&&draft.doneDate?" pe "+esc(nice(draft.doneDate)):""}</strong>`;
  if(s==="acum"||s==="explorez")rows+=draft.nextStep?`<span>De făcut: ${esc(draft.nextStep)} <span class="pill ${d.c}">${esc(d.t)}</span></span>`:`<span>Alege ce faci mai departe, la „Decizie și plan”.</span>`;
  else if(s==="parcare")rows+=`<span>${draft.reviewDate?"O recitesc pe "+esc(nice(draft.reviewDate)):"Alege o dată la care o recitești."}</span>`;
  else if(s==="nou")rows+=`<span>Analizeaz-o, apoi alege ce faci cu ea.</span>`;
  if(a)rows+=`<span>Scor ${a.total} din 25</span>`;
  return rows;
}
function updSummary(){
  const b=$("sumBox");if(b)b.innerHTML=summaryHtml();
  const h=heads();
  document.querySelectorAll("#sheet details[data-sec]").forEach(el=>{const sm=el.querySelector("summary small");if(sm)sm.textContent=h[el.dataset.sec]||""});
}
function verdictHtml(){
  const a=advise(draft.scores);
  if(!a)return `<div class="verdict"><span>Alege câte o variantă la toate cele 5 criterii ca să primești o recomandare.</span></div>`;
  return `<div class="verdict"><strong>Scor ${a.total} din 25 · Recomandare: ${esc(STAGES[a.stage].one)}</strong><span>${esc(a.why)}</span></div>`;
}
function scoresHtml(){
  return CRIT.map(c=>`<div class="score"><div class="score-top"><span>${c[1]}</span></div><div class="seg" role="group" aria-label="${c[1]}">${c[2].map((w,n)=>`<button type="button" data-crit="${c[0]}" data-val="${n+1}" aria-pressed="${draft.scores[c[0]]===n+1}">${w}</button>`).join("")}</div></div>`).join("");
}
function stageFields(){
  const s=draft.stage;
  if(s==="acum"||s==="explorez"){
    const t=today();
    return `<div class="group">
    <div class="field"><label for="fStep">Ce fac mai departe</label><input type="text" id="fStep" data-f="nextStep" value="${esc(draft.nextStep)}" placeholder="Un lucru clar, de maximum 2 ore"></div>
    <div class="field"><label for="fDue">Până când</label><input type="date" id="fDue" data-f="dueDate" value="${esc(draft.dueDate)}">
    <div class="quick"><button type="button" data-due="${addDays(t,1)}">Mâine</button><button type="button" data-due="${addDays(t,3)}">În 3 zile</button><button type="button" data-due="${addDays(t,7)}">Într-o săptămână</button></div></div>
    <div class="field"><label for="fTest">Cum îmi dau seama că merită</label><input type="text" id="fTest" data-f="test" value="${esc(draft.test)}" placeholder="Un rezultat pe care îl pot număra"></div>
    <div class="field"><label for="fDec">Data la care decid dacă merg mai departe</label><input type="date" id="fDec" data-f="decisionDate" value="${esc(draft.decisionDate)}"></div>
    <div class="field"><label for="fStop">Mă opresc dacă</label><input type="text" id="fStop" data-f="stopRule" value="${esc(draft.stopRule)}" placeholder="Condiția clară de oprire"></div></div>`;
  }
  if(s==="parcare")return `<div class="field"><label for="fRev">Recitesc ideea pe</label><input type="date" id="fRev" data-f="reviewDate" value="${esc(draft.reviewDate)}"></div>`;
  return "";
}
function drawSheet(){
  const logs=(draft.log||[]).slice().reverse(), h=heads();
  const sec=(k,title,body)=>`<details class="sec" data-sec="${k}"${openSec[k]?" open":""}><summary><span>${title}</span><small>${esc(h[k])}</small></summary><div class="group">${body}</div></details>`;
  $("sheet").innerHTML=`<div class="sheet-in">
  <div class="field"><label for="fTitle">Ideea</label><input class="title-input" type="text" id="fTitle" data-f="title" value="${esc(draft.title)}"></div>
  <div class="verdict" id="sumBox">${summaryHtml()}</div>
  ${sec("note","Note",`<div class="field"><label for="fNote">Pentru cine e, ce problemă rezolvă, cu cine o faci</label><textarea id="fNote" data-f="note" rows="5">${esc(draft.note)}</textarea></div>`)}
  ${sec("analiza","Analiză",`<button class="btn alt" type="button" id="askAi" style="justify-self:start">Analizează cu AI</button>
    ${advice?`<div class="verdict"><strong>Propunerea analizei</strong><span>${esc(advice)}</span></div>`:""}
    <div class="field"><label for="fCost">Cheltuieli lunare estimate</label><textarea id="fCost" data-f="costRange" rows="2" placeholder="Interval în lei">${esc(draft.costRange)}</textarea></div>
    <div class="field"><label for="fRevenue">Venituri lunare estimate</label><textarea id="fRevenue" data-f="revenueRange" rows="2" placeholder="Interval în lei">${esc(draft.revenueRange)}</textarea></div>
    <div class="field"><label for="fApproach">Cum aș putea aborda ideea</label><textarea id="fApproach" data-f="approach" rows="3" placeholder="Apasă Analizează cu AI sau scrie propriile idei">${esc(draft.approach)}</textarea></div>
    <p class="hint" style="margin:0">Variantele din dreapta sunt cele mai favorabile.</p>
    <div class="group" id="scoreBox">${scoresHtml()}</div><div id="verdict">${verdictHtml()}</div>
    <button class="btn bare" type="button" id="copyPrompt" style="justify-self:start">Copiază cererea pentru Claude</button>
    <div class="paste" id="pasteBox" hidden><label class="flabel" for="fPaste">Lipește aici răspunsul primit de la Claude</label><textarea id="fPaste" rows="4"></textarea><button class="btn alt" type="button" id="applyPaste">Aplică analiza</button></div>`)}
  ${sec("plan","Decizie și plan",`<div class="stages" role="group" aria-label="Decizie">${Object.keys(STAGES).map(k=>`<button type="button" data-stage="${k}" aria-pressed="${draft.stage===k}">${STAGES[k].one}<small>${STAGES[k].hint}</small></button>`).join("")}</div>
    <div id="stageBox">${stageFields()}</div>`)}
  ${sec("istoric","Revizuire și istoric",`<p class="hint" style="margin:0">${draft.lastReviewed?"Ultima revizuire: "+esc(nice(draft.lastReviewed)):"Ideea nu a fost revizuită încă."}</p><button class="btn alt" type="button" id="markReviewed" style="justify-self:start">Am revizuit ideea</button>
    ${logs.length?`<div class="flabel">Ce am făcut</div><ol class="history">${logs.map(l=>`<li>${esc(l.text)} (${esc(nice(l.date))})</li>`).join("")}</ol>`:""}
    <div id="delBox"><button class="btn danger" type="button" id="delAsk">Șterge ideea</button></div>`)}
  </div>`;
}
$("sheet").addEventListener("toggle",e=>{const k=e.target.dataset&&e.target.dataset.sec;if(k)openSec[k]=e.target.open},true);
$("sheet").addEventListener("input",e=>{const f=e.target.dataset.f;if(f&&draft){draft[f]=e.target.value;updSummary();touch()}});
$("sheet").addEventListener("click",async e=>{
  const b=e.target.closest("button"); if(!b||!draft)return;
  if(b.dataset.crit){
    const k=b.dataset.crit,v=+b.dataset.val; draft.scores[k]=v;
    $("scoreBox").innerHTML=scoresHtml();$("verdict").innerHTML=verdictHtml();updSummary();touch(true);
  }else if(b.dataset.stage){
    draft.stage=b.dataset.stage;
    if(draft.stage==="realizat"){if(!draft.doneDate)draft.doneDate=today()}else draft.doneDate="";
    document.querySelectorAll("[data-stage]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.stage===draft.stage));
    $("stageBox").innerHTML=stageFields();updSummary();touch(true);
  }else if(b.dataset.due){
    draft.dueDate=b.dataset.due;$("fDue").value=b.dataset.due;updSummary();touch(true);
  }else if(b.id==="markReviewed"){
    if(!draft.title.trim()){toast("Scrie un titlu pentru idee.");return}
    draft.lastReviewed=today();dirty=true;closeSheet();toast("Revizuire notată.");
  }else if(b.id==="askAi"){
    if(!draft.title.trim()){toast("Scrie un titlu pentru idee.");return}
    b.disabled=true;b.textContent="Se analizează…";
    const sheetFor=draftId;
    try{
      const res=await withTimeout(sb.functions.invoke("analyze",{body:{title:draft.title,note:draft.note,today:today()}}));
      if(res.error){const e=new Error("ai");e.status=res.error.context&&res.error.context.status;throw e}
      if(draftId===sheetFor)applyAnalysis(res.data);
    }catch(err){
      toast(err.status===429?"Ai folosit toate analizele de azi. Revino mâine.":err.status===503?"Analiza AI nu este disponibilă acum. Poți alege variantele singur.":"Analiza nu a mers. Încearcă din nou sau alege variantele singur.");
      const x=$("askAi");if(x){x.disabled=false;x.textContent="Analizează cu AI"}
    }
  }else if(b.id==="copyPrompt"){
    const text=analysisPrompt();
    $("pasteBox").hidden=false;
    try{await navigator.clipboard.writeText(text);toast("Copiat. Trimite cererea în Claude și lipește răspunsul aici.")}
    catch(_){$("fPaste").value=text;$("fPaste").select();toast("Copiază manual textul selectat.")}
  }else if(b.id==="applyPaste"){
    const raw=$("fPaste").value;
    try{applyAnalysis(JSON.parse(raw.slice(raw.indexOf("{"),raw.lastIndexOf("}")+1)))}
    catch(_){toast("Nu am găsit analiza în text. Lipește tot răspunsul.")}
  }else if(b.id==="delAsk"){
    $("delBox").innerHTML=`<p style="margin:0 0 8px">Ștergi ideea?</p><div class="quick"><button type="button" id="delYes">Da, șterge</button><button type="button" id="delNo">Nu</button></div>`;
  }else if(b.id==="delNo"){
    $("delBox").innerHTML=`<button class="btn danger" type="button" id="delAsk">Șterge ideea</button>`;
  }else if(b.id==="delYes"){
    const id=draftId, {id:_x,...kept}=JSON.parse(JSON.stringify(ideas.find(x=>x.id===id)||draft));
    try{await flushOutbox();check(await withTimeout(sb.from("ideas").delete().eq("id",id)));
      setBox(getBox().filter(x=>x.id!==id));
      ideas=ideas.filter(x=>x.id!==id);lsSet(K("cache"),ideas);render();closeSheet(true);
      toast("Idee ștearsă.",()=>{queue(id,kept);setLocal(id,kept);flushOutbox();toast("Idee readusă.")});
    }catch(err){toast(navigator.onLine===false?"Nu ai internet. Ștergerea merge doar online.":"Nu am putut șterge. Încearcă din nou.")}
  }
});
function analysisPrompt(){
  return `Ești un consilier practic pentru cineva care vrea să testeze idei de afaceri cu buget mic. Azi este ${today()}.
Analizează ideea de mai jos și răspunde doar cu JSON valid, în română, cu cheile:
scores (obiect cu potential, viteza, cost, timp, durabil, fiecare număr întreg 1-5; 5 înseamnă mereu favorabil: potențial mare, bani repede, cost mic, timp puțin, are sens pe termen lung),
stage ("acum", "explorez", "parcare" sau "renuntat"),
reason (maximum două fraze, onest, cu principalul risc),
costRange (interval de cheltuieli lunare în lei, cu ipoteza între paranteze),
revenueRange (interval de venituri lunare în lei, cu ipoteza între paranteze),
approach (2-3 rânduri cu idei concrete despre cum ar putea fi abordată ideea: unghi, primii clienți, ce să evite),
nextStep (o acțiune concretă de maximum 2 ore),
dueDate (AAAA-LL-ZZ),
test (rezultat măsurabil de validare),
decisionDate (AAAA-LL-ZZ),
stopRule (condiție clară de oprire),
reviewDate (AAAA-LL-ZZ, doar pentru parcare).
Ideea: ${JSON.stringify({titlu:draft.title,note:draft.note})}`;
}
function applyAnalysis(r){
  const before=JSON.stringify(draft), forId=draftId;
  const ok=n=>Number.isInteger(n)&&n>=1&&n<=5;
  if(r&&r.scores)CRIT.forEach(c=>{if(ok(r.scores[c[0]]))draft.scores[c[0]]=r.scores[c[0]]});
  if(STAGES[r.stage]&&r.stage!=="nou"&&r.stage!=="realizat"){draft.stage=r.stage;draft.doneDate=""}
  ["nextStep","dueDate","test","decisionDate","stopRule","reviewDate"].forEach(k=>{if(typeof r[k]==="string"&&r[k]&&!draft[k])draft[k]=r[k]});
  ["approach","costRange","revenueRange"].forEach(k=>{if(typeof r[k]==="string"&&r[k].trim())draft[k]=r[k].trim()});
  advice=typeof r.reason==="string"?r.reason:"";
  openSec.analiza=true;openSec.plan=true;
  drawSheet();touch(true);
  toast("Analiză aplicată.",()=>{if(draftId!==forId)return;draft=JSON.parse(before);advice="";drawSheet();touch(true)});
}
(function(){
  const save=$("sheetSave"), close=$("sheetClose");
  close.hidden=true;save.textContent="Gata";
  const st=document.createElement("span");st.id="saveState";st.className="save-state";st.setAttribute("role","status");
  save.parentNode.insertBefore(st,save);
  save.addEventListener("click",()=>closeSheet());
})();

/* Clicuri în liste și navigare */
$("app").addEventListener("click",async e=>{
  const b=e.target.closest("button"); if(!b)return;
  if(b.dataset.open)openSheet(b.dataset.open);
  else if(b.dataset.filter){filter=b.dataset.filter;renderIdei()}
  else if(b.dataset.done){
    const i=ideas.find(x=>x.id===b.dataset.done); if(!i)return;
    const {id,...prev}=JSON.parse(JSON.stringify(i));
    const data=Object.assign({},prev,{log:(prev.log||[]).concat([{text:prev.nextStep,date:today()}]),nextStep:"",dueDate:""});
    queue(id,data);setLocal(id,data);flushOutbox();openSheet(id,true);
    toast("Bifat. Ce faci mai departe?",()=>{if(draftId===id)closeSheet(true);queue(id,prev);setLocal(id,prev);flushOutbox()});
  }
});
$("nav").addEventListener("click",e=>{const b=e.target.closest("button");if(b)show(b.dataset.view)});
$("reviewDone").addEventListener("click",async()=>{
  try{await saveSettings({lastReview:today()});render();toast("Revizuire notată.")}catch(_){toast(failMsg())}
});
$("targetDate").addEventListener("change",async e=>{
  try{await saveSettings({targetDate:e.target.value});drawTarget();toast("Termen salvat.")}catch(_){toast(failMsg())}
});

/* Export și import */
$("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),settings:meta,ideas},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="atelier-de-idei-"+today()+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
});
$("importBtn").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",async e=>{
  const f=e.target.files[0];e.target.value="";if(!f)return;
  try{
    const o=JSON.parse(await f.text());
    const list=(o.ideas||[]).filter(x=>x&&typeof x.id==="string"&&typeof x.title==="string"&&STAGES[x.stage]).slice(0,1000);
    if(!list.length){toast("Fișierul nu conține idei valide.");return}
    toast("Import "+list.length+" idei…");
    const rows=list.map(({id,...data})=>({user_id:user.id,id,data,updated_at:new Date().toISOString()}));
    for(let k=0;k<rows.length;k+=100)check(await withTimeout(sb.from("ideas").upsert(rows.slice(k,k+100),{onConflict:"user_id,id"})));
    if(o.settings&&(o.settings.lastReview||o.settings.targetDate))await saveSettings({lastReview:o.settings.lastReview||meta.lastReview,targetDate:o.settings.targetDate||meta.targetDate});
    await refresh();toast("Am importat "+list.length+" idei.");
  }catch(_){toast("Importul nu a reușit. Verifică fișierul și internetul.")}
});

/* Cont */
let authMode="login";
function setMode(m){
  authMode=m;
  $("passField").hidden=m==="forgot";
  $("authPass").required=m!=="forgot";
  $("authEmail").closest(".field").hidden=m==="newpass";
  $("authEmail").required=m!=="newpass";
  $("authPass").autocomplete=m==="login"?"current-password":"new-password";
  $("authSubmit").textContent={login:"Intră în cont",signup:"Creează contul",forgot:"Trimite linkul de resetare",newpass:"Salvează parola nouă"}[m];
  $("authMode").textContent=m==="login"?"Nu am cont":"Am deja cont";
  $("authForgot").hidden=m!=="login";
  $("authMsg").textContent="";
}
$("authMode").addEventListener("click",()=>setMode(authMode==="login"?"signup":"login"));
$("authForgot").addEventListener("click",()=>setMode("forgot"));
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("authEmail").value.trim(), password=$("authPass").value, back=location.origin+location.pathname, msg=$("authMsg"), btn=$("authSubmit");
  btn.disabled=true;msg.textContent="";
  try{
    if(authMode==="login"){
      const r=await sb.auth.signInWithPassword({email,password});
      if(r.error)msg.textContent="Email sau parolă greșită, ori contul nu e confirmat încă.";
    }else if(authMode==="signup"){
      const r=await sb.auth.signUp({email,password,options:{emailRedirectTo:back}});
      if(r.error)msg.textContent="Nu am putut crea contul. Parola trebuie să aibă cel puțin 8 caractere.";
      else if(!r.data.session)msg.textContent="Verifică emailul și apasă linkul de confirmare.";
    }else if(authMode==="forgot"){
      const r=await sb.auth.resetPasswordForEmail(email,{redirectTo:back});
      msg.textContent=r.error?"Nu am putut trimite emailul. Încearcă mai târziu.":"Dacă adresa are cont, primești un link pe email.";
    }else{
      const r=await sb.auth.updateUser({password});
      if(r.error)msg.textContent="Nu am putut schimba parola. Folosește cel puțin 8 caractere.";
      else{recovering=false;setMode("login");enter(r.data.user)}
    }
  }catch(_){msg.textContent="Nu ajung la server. Verifică internetul."}
  btn.disabled=false;
});
$("logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();location.reload()});
let recovering=false;
function lock(){user=null;$("auth").hidden=false;$("app").hidden=true;$("nav").hidden=true}
function enter(u){
  if(user&&user.id===u.id)return;
  user=u;$("auth").hidden=true;$("app").hidden=false;$("nav").hidden=false;
  $("accountLine").textContent="Cont: "+(u.email||"");
  ideas=lsGet(K("cache"),[]);meta=lsGet(K("meta"),{});
  mergeBox();
  drawTarget();render();refresh();
}

/* Pornire */
function status(msg){const s=$("status");s.hidden=!msg;s.textContent=msg||""}
function drawTarget(){
  const t=meta.targetDate||"", left=t?diff(t,today()):0;
  $("targetDate").value=t;
  $("countdown").innerHTML=left>0?`<b>${left}</b> zile până la termen`:"";
}
$("today").textContent=new Date().toLocaleDateString("ro-RO",{weekday:"long",day:"numeric",month:"long"});
window.addEventListener("online",refresh);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
(async function boot(){
  if(!CFG.supabaseUrl||!CFG.supabaseKey){$("auth").hidden=false;$("authForm").hidden=true;$("authMode").hidden=true;$("authForgot").hidden=true;$("auth").querySelector("p").textContent="Aplicația nu este configurată încă. Completează config.js după instrucțiunile din README.";return}
  sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey);
  sb.auth.onAuthStateChange((ev,session)=>{
    if(ev==="PASSWORD_RECOVERY"){recovering=true;lock();setMode("newpass");return}
    if(recovering)return;
    if(session&&session.user)setTimeout(()=>enter(session.user),0);
    else if(ev==="SIGNED_OUT"||ev==="INITIAL_SESSION")lock();
  });
})();
})();
