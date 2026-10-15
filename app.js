const CONFIG = {
  cafeName: "Station One Cafe",
  currency: "BYN",
  place: {
    address: "Гомель, Советская улица, 29А (2 этаж)",
    phone: "+375 33 333-52-33",
    hours: "",
    lat: 52.434714, lng: 31.009511,
    wifiName: "", wifiPass: "",
    yandexOrg: "https://yandex.by/maps/org/station_one_cafe/112602723149/",
    googleMaps: "",
    googlePlaceId: "",
    tags: ["Кальян", "Wi-Fi", "Летняя терраса", "Бизнес-ланч", "Детское меню", "Оплата картой", "Доставка", "С собой"],
    social: { instagram: "https://www.instagram.com/station_one_gomel/", vk: "https://vk.ru/cafestationone", facebook: "https://facebook.com/cafestationone" },
    gisUrl: ""
  },
  apiUrl: "https://cafe-nfc-menu-api.gde-nikita.workers.dev",
  demoAdminPassword: "060109",
  storageKey: "cafe_menu_v3"
};

const PAYMENT = {
  provider: "bepaid",
  endpoint: "",
  async createCheckout(order){
    if(!this.endpoint) return {ok:false, reason:"not_configured"};
    const res = await fetch(this.endpoint,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({orderId:order.id, amount:order.total, currency:CONFIG.currency,
        description:"Заказ "+order.id, items:order.items.map(i=>({id:i.id,qty:i.qty}))})
    });
    if(!res.ok) return {ok:false, reason:"server_error"};
    const data = await res.json();
    return data.redirect_url ? {ok:true, url:data.redirect_url} : {ok:false, reason:"no_url"};
  }
};

const ORDERS = {
  async submit(order){
    if(!CONFIG.apiUrl){ console.log("ORDER (демо)", order); return {ok:true, id:order.id}; }
    try{
      const r = await fetch(CONFIG.apiUrl+"/order",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({table:order.table,type:order.type,name:order.name,phone:order.phone,comment:order.comment,
          items:order.items.map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty}))})});
      const d = await r.json();
      return r.ok && d.ok ? {ok:true,id:d.id} : {ok:false};
    }catch(e){ return {ok:false}; }
  }
};

const DEFAULT_MENU = [
  {id:1,category:"Закуски",name:"Картофель фри",desc:"Хрустящий снаружи, мягкий внутри · 100 г",price:6,img:""},
  {id:2,category:"Закуски",name:"Мутабаль",desc:"Печёные баклажаны, кунжутная паста, оливковое масло · 185 г",price:19,img:""},
  {id:3,category:"Пицца",name:"Ветчина и грибы",desc:"Томатный соус, ветчина, грибы, моцарелла · 30 см, 460 г",price:19.5,img:""},
  {id:4,category:"Пицца",name:"Ди маре",desc:"Креветки, мидии, каперсы, маслины, черри, моцарелла · 510 г",price:26,img:""},
  {id:5,category:"Пицца",name:"Шаверма-пицца",desc:"Чесночный соус, курица, маринованные огурцы, томат, моцарелла · 490 г",price:19.5,img:""},
  {id:6,category:"Шаверма и сэндвичи",name:"Фалафель сэндвич",desc:"Фалафель, маринованный огурец, томаты, лук, тахини · 350 г",price:9.5,img:""},
  {id:7,category:"Шаверма и сэндвичи",name:"Шаверма говяжья",desc:"Говядина, огурцы, томаты, лук, тахини · 350 г",price:12.9,img:""},
  {id:8,category:"Шаверма и сэндвичи",name:"Шаверма куриная",desc:"Куриная грудка, огурцы, чесночный соус, картофель фри · 350 г",price:11.5,img:""},
  {id:9,category:"Горячее",name:"Барбекю из говядины",desc:"Говяжья вырезка, огурчик, лук, хумус · 340 г",price:39,img:""},
  {id:10,category:"Горячее",name:"Филадельфия",desc:"Куриное филе, грибы, болгарский перец, сыр, картофель фри · 370 г",price:25,img:""}
];
let state = {cafeName:CONFIG.cafeName, menu:DEFAULT_MENU};
try{ const s = JSON.parse(localStorage.getItem(CONFIG.storageKey)||"null"); if(s && Array.isArray(s.menu)) state = s; }catch(e){}
state.cafeName = CONFIG.cafeName;
function save(){ try{ localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); }catch(e){} }

const TABLE = (new URLSearchParams(location.search).get("table")||"").replace(/[^0-9A-Za-zА-Яа-я-]/g,"").slice(0,10);
if(TABLE){ const b=document.getElementById("tableBadge"); b.textContent="Стол "+TABLE; b.style.display="inline-block"; }
let adminPass = "";
async function loadRemoteMenu(){
  if(!CONFIG.apiUrl) return;
  try{
    const r = await fetch(CONFIG.apiUrl+"/menu"); const d = await r.json();
    if(d && Array.isArray(d.menu)){ state = {cafeName:CONFIG.cafeName, menu:d.menu}; cart=[]; renderCats(); refresh(); }
  }catch(e){ }
}
async function pushRemoteMenu(){
  if(!CONFIG.apiUrl) return true;
  try{
    const r = await fetch(CONFIG.apiUrl+"/menu",{method:"PUT",headers:{"Content-Type":"application/json","X-Admin-Password":adminPass},body:JSON.stringify(state)});
    return r.ok;
  }catch(e){ return false; }
}
let cart = [], cat = "Все", isAdmin = false, editId = null;
const $ = id => document.getElementById(id);
const esc = s => String(s??"").replace(/[&<>"']/g, ch => { const m={"&":"amp","<":"lt",">":"gt",'"':"quot","'":"#39"}; return m[ch]?"&"+m[ch]+";":ch; });
const money = n => n.toFixed(2)+" "+CONFIG.currency;

function renderCats(){
  const cats = ["Все", ...new Set(state.menu.map(i=>i.category))];
  if(!cats.includes(cat)) cat = "Все";
  $("cats").innerHTML = cats.map(c=>`<button type="button" class="chip ${c===cat?"on":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}
function thumb(i){
  if(i.img) return `<img class="ph" src="${esc(i.img)}" alt="" loading="lazy">`;
  const letter = (i.name||"?").trim().charAt(0).toUpperCase();
  return `<div class="ph">${esc(letter)}</div>`;
}
function refresh(){
  $("cafe").textContent = state.cafeName || CONFIG.cafeName;
  $("sub").textContent = ((CONFIG.place.address||"").replace(/,?\s*\(.*\)/,"")).replace(/^г\.\s*/,"") || "";
  document.title = state.cafeName || CONFIG.cafeName;
  const term = ($("q")?$("q").value:"").trim().toLowerCase();
  let list = cat==="Все" ? state.menu : state.menu.filter(i=>i.category===cat);
  if(term) list = list.filter(i=>(i.name+" "+i.desc).toLowerCase().includes(term));
  $("menu").innerHTML = list.map(i=>{
    const q = (cart.find(c=>c.id==i.id)||{}).qty||0;
    const ctl = i.stop ? `<span class="msg">Нет в наличии</span>` : q ? `<div class="qty"><button type="button" data-dec="${i.id}" aria-label="Минус">−</button><b>${q}</b><button type="button" data-inc="${i.id}" aria-label="Плюс">+</button></div>`
                  : `<button type="button" class="btn sm" data-inc="${i.id}">Добавить</button>`;
    return `<article class="item${i.stop?" stop":""}">${thumb(i)}<div class="info"><div class="name">${esc(i.name)}</div><div class="desc">${esc(i.desc)}</div><div class="row"><span class="price">${money(i.price)}</span>${ctl}</div></div></article>`;
  }).join("") || '<p class="msg">Меню пока пустое.</p>';
  const cnt = cart.reduce((s,i)=>s+i.qty,0), sum = cart.reduce((s,i)=>s+i.price*i.qty,0);
  $("bar").classList.toggle("hide", !cnt);
  $("barCnt").textContent = "Корзина · "+cnt;
  $("barSum").textContent = money(sum);
}

const total = () => cart.reduce((s,i)=>s+i.price*i.qty,0);
function add(id, d){
  const item = state.menu.find(m=>m.id==id); if(!item||item.stop) return;
  const c = cart.find(x=>x.id==id);
  if(c){ c.qty = Math.max(0, c.qty+d); if(!c.qty) cart = cart.filter(x=>x.id!=id); }
  else if(d>0) cart.push({id:item.id,name:item.name,price:item.price,qty:1});
  refresh();
}
document.addEventListener("click", e=>{
  const qtyBtn = e.target.closest("[data-inc],[data-dec]");
  if(qtyBtn){
    e.preventDefault();
    const id = Number(qtyBtn.getAttribute("data-inc") || qtyBtn.getAttribute("data-dec"));
    if(!Number.isFinite(id)) return;
    add(id, qtyBtn.hasAttribute("data-inc") ? 1 : -1);
    return;
  }
  const chip = e.target.closest("[data-cat]");
  if(chip){ cat = chip.getAttribute("data-cat"); renderCats(); refresh(); return; }
  if(e.target.closest("[data-close]")) closeSheets();
});

function openSheet(id){ $("shade").classList.add("on"); $(id).classList.add("on"); }
function closeSheets(){ $("shade").classList.remove("on"); document.querySelectorAll(".sheet").forEach(s=>s.classList.remove("on")); }
$("shade").onclick = closeSheets;
$("openCart").onclick = ()=>{ renderCart(); $("cartView").classList.remove("hidden"); $("okView").classList.add("hidden"); openSheet("cartSheet"); };
function renderCart(){
  $("cartItems").innerHTML = cart.map(i=>`<div class="ci"><div><b>${esc(i.name)}</b><div class="msg">${money(i.price)}</div></div>
    <div class="qty"><button type="button" data-dec="${i.id}">−</button><b>${i.qty}</b><button type="button" data-inc="${i.id}">+</button></div></div>`).join("") || '<p class="msg">Корзина пуста</p>';
  $("cartTotal").textContent = "Итого: "+money(total());
  if(TABLE) $("cTable").value = TABLE;
}
async function placeOrder(type){
  if(!cart.length){ toast("Корзина пуста"); return; }
  let table = ($("cTable").value||TABLE||"").trim();
  if(!table){ toast("Укажите номер стола"); return; }
  const order = {id:"ORD-"+Math.floor(Math.random()*1e6), table, type, name:$("cName").value.trim(), phone:$("cPhone").value.trim(), comment:$("cNote").value.trim(), items:cart.map(i=>({...i})), total:total()};
  $("payMsg").textContent = "Отправка...";
  const res = await ORDERS.submit(order);
  if(!res.ok){ $("payMsg").textContent = "Не удалось отправить заказ"; return; }
  $("cartView").classList.add("hidden"); $("okView").classList.remove("hidden");
  const payText = type==="cash" ? "наличными при получении" : type==="terminal" ? "через терминал" : "онлайн";
  $("okText").textContent = "Оплатите "+money(order.total)+" "+payText+".";
  $("okId").textContent = "Номер заказа: "+(res.id||order.id);
  cart = []; refresh();
}
$("payCash").onclick = ()=>placeOrder("cash");
$("payTerminal").onclick = ()=>placeOrder("terminal");
$("newOrder").onclick = ()=>{ closeSheets(); };

function toast(t){ const el=document.createElement("div"); el.className="toast"; el.textContent=t; document.body.appendChild(el); setTimeout(()=>el.remove(),2500); }
const lastCall = {};
async function callStaff(kind){
  let table = TABLE || $("cTable").value.trim();
  if(!table) table = (prompt("Номер вашего стола?")||"").trim();
  if(!/^[0-9A-Za-zА-Яа-я-]{1,10}$/.test(table)){ toast("Укажите номер стола"); return; }
  if(Date.now()-(lastCall[kind]||0) < 60000){ toast("Запрос уже отправлен, подождите минуту"); return; }
  if(!CONFIG.apiUrl){ toast("Демо-режим: запрос не отправлен"); return; }
  try{
    const r = await fetch(CONFIG.apiUrl+"/call",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({table,kind})});
    if(r.ok){ lastCall[kind]=Date.now(); toast(kind==="bill"?"Официант скоро принесёт счёт":"Официант скоро подойдёт"); }
    else if(r.status===429) toast("Запрос уже отправлен, подождите минуту");
    else toast("Не удалось отправить, попробуйте ещё раз");
  }catch(e){ toast("Нет связи с сервером"); }
}
$("qCall").onclick = ()=>callStaff("waiter");
$("qBill").onclick = ()=>callStaff("bill");

const P = CONFIG.place;
const hasXY = () => P.lat && P.lng;
const mapQuery = () => encodeURIComponent((state.cafeName+" "+((P.address||"Гомель").replace(/\s*\(.*\)/,""))).trim());
const LINKS = {
  yandex:  () => P.yandexOrg || (hasXY() ? `https://yandex.by/maps/?pt=${P.lng},${P.lat}&z=17&l=map` : `https://yandex.by/maps/?text=${mapQuery()}`),
  google:  () => P.googleMaps || (hasXY() ? `https://www.google.com/maps?q=${P.lat},${P.lng}` : `https://www.google.com/maps/search/?api=1&query=${mapQuery()}`),
  gis:     () => P.gisUrl || `https://2gis.by/gomel/search/${mapQuery()}`,
  apple:   () => hasXY() ? `https://maps.apple.com/?ll=${P.lat},${P.lng}&q=${encodeURIComponent(state.cafeName)}` : `https://maps.apple.com/?q=${mapQuery()}`,
  yandexRv:() => P.yandexOrg ? P.yandexOrg.replace(/\/?$/,"")+"/reviews/" : LINKS.yandex(),
  googleRv:() => P.googlePlaceId ? `https://search.google.com/local/writereview?placeid=${P.googlePlaceId}` : LINKS.google(),
  gisRv:   () => LINKS.gis()
};
function renderInfo(){
  const row = (k,v) => v ? `<div class="irow"><span>${k}</span><span>${v}</span></div>` : "";
  const a = (href, label) => href ? `<a class="btn sec" href="${esc(href)}" target="_blank" rel="noopener">${label}</a>` : "";
  let h = `<h3 style="margin-bottom:6px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;font-size:.9rem">${esc(state.cafeName)}</h3>`;
  h += row("Адрес", esc(P.address));
  if(P.phone) h += row("Телефон", `<a href="tel:${esc(P.phone.replace(/[^\d+]/g,""))}" style="color:var(--text)">${esc(P.phone)}</a>`);
  if(P.wifiName) h += row("Wi-Fi", `${esc(P.wifiName)}${P.wifiPass?` <button type="button" class="btn sec sm" data-copy="${esc(P.wifiPass)}">Пароль</button>`:""}`);
  if(P.tags && P.tags.length) h += `<div class="tags">${P.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>`;
  h += `<div class="ih">Как добраться</div><div class="pay">${a(LINKS.yandex(),"Яндекс Карты")}${a(LINKS.google(),"Google Карты")}${a(LINKS.gis(),"2ГИС")}${a(LINKS.apple(),"Карты Apple")}</div>`;
  h += `<div class="ih">Оставить отзыв</div><div class="payv">${a(LINKS.yandexRv(),"Отзыв в Яндекс Картах")}${a(LINKS.googleRv(),"Отзыв в Google")}${a(LINKS.gisRv(),"Отзыв в 2ГИС")}</div>`;
  const so = P.social || {}; const sl = [["instagram","Instagram"],["vk","ВКонтакте"],["facebook","Facebook"]].filter(x=>so[x[0]]);
  if(sl.length) h += `<div class="ih">Мы в соцсетях</div><div class="pay">${sl.map(x=>a(so[x[0]],x[1])).join("")}</div>`;
  h += `<p class="msg" style="margin-top:14px">Спасибо, что выбрали нас! Ваш отзыв помогает нам становиться лучше.</p>`;
  $("infoBody").innerHTML = h;
}
$("qInfo").onclick = ()=>{ renderInfo(); openSheet("infoSheet"); };
$("q").oninput = refresh;

$("admBtn").onclick = ()=>{ $("admLogin").classList.remove("hidden"); $("admMain").classList.add("hidden"); $("admErr").textContent=""; openSheet("admSheet"); };
$("admGo").onclick = async ()=>{
  const p = ($("admPass").value||"").trim();
  if(!p){ $("admErr").textContent="Введите пароль"; return; }
  let ok = false;
  if(CONFIG.apiUrl){
    try{
      const r = await fetch(CONFIG.apiUrl+"/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:p})});
      if(r.ok){ adminPass = p; ok = true; }
    }catch(e){ /* offline */ }
  }
  if(!ok && p === CONFIG.demoAdminPassword){ adminPass = p; ok = true; }
  if(!ok){ $("admErr").textContent="Неверный пароль"; return; }
  isAdmin = true; $("admLogin").classList.add("hidden"); $("admMain").classList.remove("hidden"); renderAdm();
};
function renderAdm(){
  $("admName").value = state.cafeName;
  $("admList").innerHTML = state.menu.map(i=>`<div class="adm"><div style="min-width:0"><b>${esc(i.name)}</b><div class="msg">${esc(i.category)} · ${money(i.price)}</div></div>
    <div style="display:flex;gap:6px"><button type="button" class="btn sec sm" data-edit="${i.id}">Изм.</button><button type="button" class="btn sec sm" data-del="${i.id}">Удал.</button></div></div>`).join("");
}
function openForm(id){
  editId = id; const i = state.menu.find(m=>m.id===id)||{name:"",desc:"",category:"",price:"",img:"",stop:false};
  $("fName").value=i.name; $("fDesc").value=i.desc||""; $("fCat").value=i.category||""; $("fPrice").value=i.price??""; $("fImg").value=i.img||""; $("fStop").checked=!!i.stop;
  $("admForm").classList.remove("hidden");
}
function commit(){ save(); renderCats(); refresh(); renderAdm(); }
$("admName").onchange = ()=>{ state.cafeName = $("admName").value.trim()||CONFIG.cafeName; commit(); };
$("pubMenu").onclick = async ()=>{ const ok = await pushRemoteMenu(); $("admMsg").textContent = ok ? "Сохранено на сервере" : "Ошибка сохранения"; };
$("addDish").onclick = ()=>openForm(null);
$("fCancel").onclick = ()=>$("admForm").classList.add("hidden");
$("fSave").onclick = ()=>{
  const name=$("fName").value.trim(), price=parseFloat($("fPrice").value);
  if(!name || !(price>=0)){ alert("Название и цена обязательны"); return; }
  const data = {name, desc:$("fDesc").value.trim(), category:$("fCat").value.trim()||"Без категории", price, img:$("fImg").value.trim(), stop:$("fStop").checked};
  if(editId){ const i=state.menu.find(m=>m.id===editId); Object.assign(i, data); }
  else { data.id = (state.menu.reduce((m,i)=>Math.max(m,i.id),0)||0)+1; state.menu.push(data); }
  $("admForm").classList.add("hidden"); commit();
};
document.addEventListener("click", e=>{
  const ed = e.target.closest("[data-edit]"); if(ed){ openForm(+ed.dataset.edit); return; }
  const del = e.target.closest("[data-del]"); if(del){ if(confirm("Удалить блюдо?")){ state.menu=state.menu.filter(m=>m.id!==+del.dataset.del); commit(); } }
  const cp = e.target.closest("[data-copy]"); if(cp){ navigator.clipboard.writeText(cp.dataset.copy); toast("Скопировано"); }
});
$("admOut").onclick = ()=>{ isAdmin=false; adminPass=""; closeSheets(); };
$("expJson").onclick = ()=>{ navigator.clipboard.writeText(JSON.stringify(state,null,2)); toast("JSON скопирован"); };
$("impJson").onclick = ()=>{ const raw=prompt("Вставьте JSON меню"); if(!raw) return;
  try{ const s=JSON.parse(raw); if(!Array.isArray(s.menu)) throw 0; state={cafeName:String(s.cafeName||CONFIG.cafeName),menu:s.menu}; cart=[]; commit(); $("admMsg").textContent="Меню загружено"; }
  catch(e){ alert("Некорректный JSON"); }
};

/* Swipe categories like Telegram folders */
(function setupSwipe(){
  const zone = document.getElementById("menu") || document.body;
  let x0 = null, y0 = null, locked = null;
  const catsList = () => ["Все", ...new Set(state.menu.map(i=>i.category))];
  function go(dir){
    const list = catsList();
    let i = list.indexOf(cat);
    if(i < 0) i = 0;
    i = (i + dir + list.length) % list.length;
    cat = list[i];
    renderCats();
    refresh();
    const on = document.querySelector(".chip.on");
    if(on) on.scrollIntoView({inline:"center", block:"nearest", behavior:"smooth"});
  }
  zone.addEventListener("touchstart", e=>{
    if(e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; locked = null;
  }, {passive:true});
  zone.addEventListener("touchmove", e=>{
    if(x0 == null) return;
    const dx = e.touches[0].clientX - x0;
    const dy = e.touches[0].clientY - y0;
    if(locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
      locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
  }, {passive:true});
  zone.addEventListener("touchend", e=>{
    if(x0 == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    if(locked === "h" && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    x0 = y0 = locked = null;
  }, {passive:true});
})();

renderCats(); refresh(); loadRemoteMenu();
