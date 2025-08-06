/* ChatGPT Virtual DOM - viewport build  (auto-toggle & live check) */

(() => {

/* === Static config =========================================== */
const MSG_SEL    = "article[data-testid^='conversation-turn']";
const SCROLL_SEL = "main div[class*='overflow-y-auto']";

const WIN_BEFORE = 40, WIN_AFTER = 40, PAD = 800;
const MAX_DETACH = 25;
const VERBOSE    = false;
/* ============================================================== */

/* === prefs keys + defaults =================================== */
const K_ENABLED   = "virtualEnabled";      // null → auto, true / false
const K_AUTO      = "virtualAuto";         // default true
const K_THRESHOLD = "virtualThreshold";    // default 120

const DEF_AUTO      = true;
const DEF_THRESHOLD = 120;
/* ============================================================== */

const tag = "%cvirtual-dom";
const log = (...a)=>console.log(tag,"color:#2da4ff",...a);
const dbg = (...a)=>VERBOSE&&console.debug(tag,"color:#888",...a);

/* ---------- utils ------------------------------------------- */
const rafDebounce = fn => { let id=0; return (...a)=>{ if(id)cancelAnimationFrame(id);
   id=requestAnimationFrame(()=>{id=0;fn(...a);}); }; };
const idle = cb => ("requestIdleCallback"in window)
      ? requestIdleCallback(cb,{timeout:500})
      : setTimeout(cb,32);

/* ---------- runtime state ------------------------------------ */
let enabled      = false;      // current virtual-dom state
let autoMode     = DEF_AUTO;
let threshold    = DEF_THRESHOLD;
let scroller     = null;

const cache   = new Map();     // id -> {html,height}
const detachQ = [];
let flushing  = false;

let spin, toggleBtnEl;

/* ---------- spinner ----------------------------------------- */
function addSpinner(){
  spin=document.createElement("div");
  spin.innerHTML=`<div style="width:40px;height:40px;border:4px solid #cbd5e1;
    border-top-color:#0ea5e9;border-radius:50%;animation:vspin .8s linear infinite"></div>`;
  spin.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9998;pointer-events:none;display:none;opacity:.9;";
  const css=document.createElement("style");
  css.textContent="@keyframes vspin{to{transform:rotate(360deg)}}";
  document.head.appendChild(css); document.body.appendChild(spin);
}
const show = ()=> spin.style.display="block";
const hide = ()=> spin.style.display="none";

/* ---------- detach / revive --------------------------------- */
const makeId = n =>
  n.getAttribute("data-turn-id") ?? n.getAttribute("data-testid") ??
  `turn-${Math.random().toString(36).slice(2)}`;

function detach(n){
  if(!n.offsetHeight) return;
  const id=makeId(n);
  cache.set(id,{html:n.outerHTML,height:n.offsetHeight});
  const ph=document.createElement("div");
  ph.setAttribute("data-placeholder-id",id);
  ph.style.cssText=`height:${n.offsetHeight}px;pointer-events:none`;
  n.replaceWith(ph);
}
function revive(ph){
  const id=ph.getAttribute("data-placeholder-id");
  const d = cache.get(id);
  if(!d){
    ph.innerHTML="<em style='opacity:.6;font:12px sans-serif'>(unavailable)</em>";
    ph.removeAttribute("data-placeholder-id"); return;
  }
  const wrap=document.createElement("div"); wrap.innerHTML=d.html;
  ph.replaceWith(wrap.firstElementChild); cache.delete(id);
}
const reviveAll = ()=>document.querySelectorAll("[data-placeholder-id]").forEach(revive);

/* ---------- batching ---------------------------------------- */
function enqueue(n){ detachQ.push(n); if(!flushing) flush(); }
function flush(){
  flushing=true;
  idle(dl=>{
    const vis=document.querySelector("[data-placeholder-id]");
    if(vis && vis.getBoundingClientRect().bottom>=-PAD &&
       vis.getBoundingClientRect().top<=innerHeight+PAD){
      flushing=false; if(detachQ.length) flush(); refresh(); return;
    }
    let n=0;
    while((dl.timeRemaining()>6||dl.didTimeout)&&n<MAX_DETACH&&detachQ.length){
      detach(detachQ.shift()); n++;
    }
    flushing=detachQ.length>0;
    if(flushing) flush(); refresh();
  });
}

/* ---------- auto-toggle helper ------------------------------- */
function maybeAutoEnable(msgCountOverride=null){
  if(enabled) return;                 // already on
  if(!autoMode) return;               // user disabled auto
  const total = msgCountOverride ?? document.querySelectorAll(MSG_SEL).length;
  if(total >= threshold){
    enabled = true;
    chrome.storage.sync.set({[K_ENABLED]: true});
    paintToggle();
    attachHeavyObservers();
    refresh();
    log(`Auto-enabled after message count hit ${total}`);
  }
}

/* ---------- viewport refresh -------------------------------- */
const refresh = rafDebounce(()=>{
  if(document.hidden){ return; }

  /* re-check auto when not enabled */
  if(!enabled){ maybeAutoEnable(); reviveAll(); hide(); return; }

  const turns=[...document.querySelectorAll(MSG_SEL)];
  if(!turns.length) return;

  let first=-1,last=-1,h=innerHeight;
  for(let i=0;i<turns.length;i++){
    const r=turns[i].getBoundingClientRect();
    if(first===-1 && r.bottom>=0) first=i;
    if(r.top<=h) last=i;
  }
  if(first===-1) return;

  const keepF=Math.max(0,first-WIN_BEFORE);
  const keepT=Math.min(turns.length-1,last+WIN_AFTER);

  /* pass 1: revive everything in keep range */
  for(let i=keepF;i<=keepT;i++){
    const n=turns[i];
    if(n.hasAttribute("data-placeholder-id")) revive(n);
  }

  /* pass 2: enqueue stashes outside keep */
  for(let i=0;i<turns.length;i++){
    if(i>=keepF && i<=keepT) continue;
    const n=turns[i];
    if(!n.hasAttribute("data-placeholder-id")) enqueue(n);
  }

  let near=false;
  document.querySelectorAll("[data-placeholder-id]").forEach(ph=>{
    const r=ph.getBoundingClientRect();
    if(r.bottom>=-PAD && r.top<=h+PAD){ near=true; revive(ph); }
  });
  near?show():hide();
  dbg(`keep[${keepF}-${keepT}] q=${detachQ.length} cache=${cache.size}`);
});

/* ---------- memory cleanup ---------------------------------- */
function clearVirtualState(){ cache.clear(); detachQ.length=0; }

/* ---------- observers attach/detach ------------------------- */
let heavyAttached=false, heavyMO;
function attachHeavyObservers(){
  if(heavyAttached) return;
  scroller.addEventListener("scroll",refresh,{passive:true});
  heavyMO=new MutationObserver(muts=>{
    let add=0; muts.forEach(m=>add+=m.addedNodes.length);
    if(add) { maybeAutoEnable(); refresh(); }
  });
  heavyMO.observe(document.documentElement,{childList:true,subtree:true});
  heavyAttached=true;
}
function detachHeavyObservers(){
  if(!heavyAttached) return;
  scroller.removeEventListener("scroll",refresh);
  heavyMO.disconnect();
  heavyAttached=false;
}

/* ---------- UI buttons -------------------------------------- */
function paintToggle(){ toggleBtnEl.style.background=enabled?"#21c55d":"#687076"; }
function makeToggleBtn(){
  const b=document.createElement("button");
  b.textContent="Virtual DOM";
  b.title="Toggle virtual-DOM. Great for long conversations to remove any lag (Detaches off-screen turns for speed)";
  b.style.cssText="position:fixed;bottom:16px;right:31px;z-index:9999;" +
      "padding:6px 12px;border-radius:6px;font:12px/1.2 sans-serif;" +
      "background:#21c55d;color:#fff;border:none;cursor:pointer;" +
      "box-shadow:0 2px 4px rgba(0,0,0,.2);opacity:.9;";
  b.onclick=()=>{
    const was=enabled;
    enabled=!enabled;
    chrome.storage.sync.set({[K_ENABLED]:enabled});
    paintToggle();
    if(!enabled){
      detachHeavyObservers();
      reviveAll(); clearVirtualState(); hide();
    }else if(!was){
      attachHeavyObservers(); refresh();
    }
  };
  toggleBtnEl=b; paintToggle(); document.body.appendChild(b);
}
function makeSettingsBtn(){
  const s=document.createElement("button");
  s.textContent="⚙";
  s.title="Virtual DOM settings";
  s.style.cssText="position:fixed;bottom:16px;right:13px;z-index:9999;" +
     "padding:6.5px 5px;border-radius:0 6px 6px 0;font:14px/1 sans-serif;" +
     "background:#5b6b83;color:#fff;border:none;cursor:pointer;" +
     "box-shadow:0 2px 4px rgba(0,0,0,.2);";
  s.onclick=()=>chrome.runtime.sendMessage({cmd:"openOptions"});
  document.body.appendChild(s);
}

/* ---------- bootstrap --------------------------------------- */
function initWithPrefs(prefs){
  autoMode  = prefs[K_AUTO];
  threshold = prefs[K_THRESHOLD];

  if(prefs[K_ENABLED]!==undefined && prefs[K_ENABLED]!==null){
    enabled = prefs[K_ENABLED];
  }else{ enabled=false; }               // start disabled; auto may flip later

  scroller=document.querySelector(SCROLL_SEL)||window;

  addSpinner(); makeToggleBtn(); makeSettingsBtn();

  /* lightweight MO always on to watch size for auto */
  const countWatcher=new MutationObserver(()=>maybeAutoEnable());
  countWatcher.observe(document.documentElement,{childList:true,subtree:true});

  if(enabled) attachHeavyObservers();

  /* visibility / focus re-sync */
  const onVis=()=>{ if(!document.hidden){ 
    hide(); 
    reviveAll(); 
    if(enabled) refresh(); 
  }};
  document.addEventListener("visibilitychange",onVis);
  window.addEventListener("focus",onVis);

  maybeAutoEnable(); // in case threshold already met on load
  if(enabled) refresh();
  log("virtual DOM ready");
}

function start(){
  chrome.storage.sync.get(
    {[K_ENABLED]:undefined,[K_AUTO]:DEF_AUTO,[K_THRESHOLD]:DEF_THRESHOLD},
    initWithPrefs);
}

document.readyState==="complete" ? start() : window.addEventListener("load",start);

})();
