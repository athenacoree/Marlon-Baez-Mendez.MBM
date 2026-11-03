(()=>{
"use strict";
const cfg=window.MBM_SUPABASE;
if(!cfg||!window.supabase||window.__MBM_CONFESSIONS)return;
window.__MBM_CONFESSIONS=true;
const db=window.supabase.createClient(cfg.url,cfg.key),FN="mbm-confessions";
const $=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const api=async body=>{const {data,error}=await db.functions.invoke(FN,{body});if(error)throw new Error(data?.error||error.message||"No se pudo conectar con el servicio.");if(data?.error)throw new Error(data.error);return data};
const visitor=()=>{let v=localStorage.getItem("mbm_conf_visitor");if(!v){v=crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();localStorage.setItem("mbm_conf_visitor",v)}return v};
const date=v=>new Date(v).toLocaleString("es-ES",{dateStyle:"medium",timeStyle:"short"});
const routePath=()=>window.__MBM_ROUTE_PATH||location.pathname;
const baseFrom=path=>{const marks=["/interaccion/","/confesiones/"].map(m=>path.indexOf(m)).filter(i=>i>=0);const at=marks.length?Math.min(...marks):-1;return at>=0?(path.slice(0,at+1)||"/"):(path.slice(0,path.lastIndexOf("/")+1)||"/")};
const tokenFromHash=()=>{const m=location.hash.match(/(?:^#|&)access=([^&]+)/);return m?decodeURIComponent(m[1]):""};
const shareUrl=token=>location.origin+baseFrom(routePath())+"confesiones/"+currentSlug+(token?"#access="+encodeURIComponent(token):"");
const copy=async(v)=>{try{await navigator.clipboard.writeText(v);return true}catch{const t=document.createElement("textarea");t.value=v;document.body.append(t);t.select();const ok=document.execCommand("copy");t.remove();return ok}};
const showError=(box,msg)=>{box.textContent=msg;box.classList.add("error")};
const page=document.createElement("main");page.id="mbmConfessionsApp";
function button(label,cls,fn){const b=$("button",cls,label);b.type="button";b.addEventListener("click",fn);return b}
function makeOwnerButton(){
 const path=routePath();if(!path.includes("/interaccion/"))return;
 const match=path.match(/\/interaccion\/([^/]+)/);if(!match||document.querySelector(".mbm-conf-owner-trigger"))return;
 if(window.__mbmConfOwnerChecking)return;window.__mbmConfOwnerChecking=true;
 (async()=>{try{
  const {data:{user}}=await db.auth.getUser();if(!user)return;
  const handle=decodeURIComponent(match[1]).replace(/^@/,"").toLowerCase();
  const {data:profile,error}=await db.from("profiles").select("id").eq("handle",handle).maybeSingle();
  if(error||!profile||profile.id!==user.id)return;
  const mast=document.querySelector(".ps-masthead");if(mast)mast.append(button("✉ Mi enlace de confesiones","mbm-conf-owner-trigger",openOwnerDashboard));
 }catch(e){console.warn("No se pudo preparar Confesiones",e)}finally{window.__mbmConfOwnerChecking=false}})();
}
const observer=new MutationObserver(makeOwnerButton);observer.observe(document.documentElement,{childList:true,subtree:true});
db.auth.onAuthStateChange(()=>setTimeout(makeOwnerButton,0));makeOwnerButton();
function buildPage(){document.body.classList.add("mbm-confession-page");document.body.append(page)}
function publicHeader(data){
 const header=$("header","mc-head"),brand=$("a","mc-brand","INTERACCIÓN");brand.href=baseFrom(location.pathname);
 header.append(brand,$("span","mc-head-label","UN ESPACIO PARA DECIRLO"));
 const hero=$("section","mc-hero"),avatar=$("div","mc-avatar");
 if(data.owner?.avatar_url){const im=$("img");im.src=data.owner.avatar_url;im.alt="";avatar.append(im)}else avatar.textContent=(data.owner?.name||"✦").slice(0,1).toUpperCase();
 hero.append(avatar,$("div","mc-kicker","BUZÓN PERSONAL"),$("h1","mc-title",data.link.title||"Confesiones"),$("p","mc-description",data.link.description||"Puedes dejar un mensaje aquí."));
 const by=$("div","mc-byline");by.append($("span","mc-byline-avatar",(data.owner?.name||"✦").slice(0,1).toUpperCase()),$("span","","Un espacio de "+(data.owner?.name||"esta persona")));hero.append(by);
 return [header,hero];
}
function renderMessage(m,ownerMode=false,token=""){
 const card=$("article","mc-message"+(m.visibility==="private"?" private":""));
 const top=$("div","mc-message-top");top.append($("strong","mc-author",m.author_name||"Anónimo"),$("span","mc-visibility",m.visibility==="private"?"PRIVADO":"PÚBLICO"),$("time","mc-time",date(m.created_at)));card.append(top,$("p","mc-message-body",m.body));
 if(m.status==="hidden")card.append($("span","mc-hidden-label","Oculto para visitantes"));
 const reactions=$("div","mc-reactions");
 ["❤️","😂","😮","🥹","🔥","👏","💜"].forEach(emoji=>{const count=m.reactions?.[emoji]||0;const b=button(emoji+(count?" "+count:""),"mc-reaction",async()=>{b.classList.add("pop");try{await api({action:"react",confession_id:m.id,emoji,visitor_id:visitor(),token});await refreshAfterChange()}catch(e){alert(e.message)}});reactions.append(b)});card.append(reactions);
 const replies=$("div","mc-replies");(m.replies||[]).forEach(r=>{const row=$("div","mc-reply"+(r.author_role==="owner"?" owner":""));row.append($("strong","mc-reply-author",r.author_role==="owner"?"Propietario":"Respuesta anónima"),$("p","",r.body),$("time","",date(r.created_at)));replies.append(row)});if((m.replies||[]).length)card.append(replies);
 if(m.visibility==="public"||ownerMode||token){
  const form=$("form","mc-reply-form"),input=$("textarea","");input.rows=2;input.maxLength=1000;input.placeholder="Escribe una respuesta…";input.required=true;
  const send=$("button","mc-send-small","Responder ↗");send.type="submit";const msg=$("span","mc-form-msg","");
  form.append(input,send,msg);form.addEventListener("submit",async e=>{e.preventDefault();send.disabled=true;try{await api({action:"reply",confession_id:m.id,body:input.value.trim(),token});input.value="";await refreshAfterChange()}catch(err){showError(msg,err.message)}finally{send.disabled=false}});card.append(form);
 }
 if(!ownerMode&&m.visibility==="public")card.append(button("Reportar","mc-report",async()=>{const choice=prompt("Motivo del reporte:\n1. Spam\n2. Acoso\n3. Contenido inapropiado\n4. Otro");const reason=({"1":"spam","2":"acoso","3":"contenido_inapropiado","4":"otro"})[choice];if(!reason)return;try{await api({action:"report",confession_id:m.id,visitor_id:visitor(),reason});alert("Gracias. El reporte fue enviado.")}catch(e){alert(e.message)}}));
 if(ownerMode){const actions=$("div","mc-owner-actions");actions.append(button(m.status==="hidden"?"Mostrar":"Ocultar","mc-quiet",async()=>{try{await api({action:"moderate",confession_id:m.id,status:m.status==="hidden"?"visible":"hidden"});await refreshAfterChange()}catch(e){alert(e.message)}}),button("Eliminar","mc-danger",async()=>{if(!confirm("¿Eliminar este mensaje y todas sus respuestas y reacciones?"))return;try{await api({action:"delete_message",confession_id:m.id});await refreshAfterChange()}catch(e){alert(e.message)}}));card.append(actions)}
 return card;
}
let currentSlug="",currentToken="";
async function reloadCurrent(){if(!currentSlug)return;const data=await api({action:"get",slug:currentSlug,token:currentToken});renderPublic(data)}
async function refreshAfterChange(){if(currentSlug)await refreshAfterChange();if(window.__mcRefreshDashboard)await window.__mcRefreshDashboard()}
function renderPublic(data){
 page.replaceChildren();const [header,hero]=publicHeader(data);page.append(header,hero);
 if(data.isOwner)page.append(button("Abrir panel de administración","mc-owner-open",openOwnerDashboard));
 const formCard=$("section","mc-compose");formCard.append($("div","mc-section-kicker","TU MENSAJE"),$("h2","mc-section-title","Deja algo que quieras decir"),$("p","mc-subtle","No necesitas registrarte. Si no escribes un nombre, aparecerás como Anónimo."));
 const form=$("form","mc-form"),name=$("input","");name.maxLength=40;name.placeholder="Tu nombre (opcional)";
 const body=$("textarea","");body.rows=5;body.maxLength=1200;body.minLength=2;body.placeholder="Escribe aquí tu mensaje…";body.required=true;
 const visibility=$("div","mc-visibility-picker"),publicLabel=$("label","mc-choice selected"),pub=$("input",""),privateLabel=$("label","mc-choice"),priv=$("input","");
 pub.type=priv.type="radio";pub.name=priv.name="visibility";pub.value="public";priv.value="private";pub.checked=true;
 publicLabel.append(pub,$("span","","Público"),$("small","","Cualquiera podrá leerlo"));privateLabel.append(priv,$("span","","Privado"),$("small","","Solo tú y el propietario"));
 [pub,priv].forEach(i=>i.addEventListener("change",()=>{publicLabel.classList.toggle("selected",pub.checked);privateLabel.classList.toggle("selected",priv.checked)}));
 visibility.append(publicLabel,privateLabel);
 const privacy=$("p","mc-privacy-note","Los mensajes privados no aparecen en el muro público. Guarda el enlace de seguimiento que recibirás para volver a tu conversación.");
 const send=$("button","mc-send","Enviar mensaje ↗");send.type="submit";const feedback=$("div","mc-feedback","");feedback.setAttribute("aria-live","polite");
 form.append(name,body,visibility,privacy,send,feedback);
 form.addEventListener("submit",async e=>{e.preventDefault();send.disabled=true;feedback.className="mc-feedback";feedback.textContent="Enviando…";try{
  const result=await api({action:"submit",slug:currentSlug,body:body.value.trim(),author_name:name.value.trim(),visibility:priv.checked?"private":"public"});
  const url=shareUrl(result.access_token);feedback.className="mc-success";feedback.textContent=priv.checked?"Tu mensaje privado fue enviado. Copia el enlace de seguimiento para consultar las respuestas.":"Tu mensaje fue publicado. Guarda el enlace de seguimiento si quieres volver a tu conversación.";
  const copyBtn=button("Copiar enlace de seguimiento","mc-copy",async()=>{const ok=await copy(url);copyBtn.textContent=ok?"Enlace copiado":"No se pudo copiar"});feedback.append(copyBtn);
  body.value="";name.value="";currentToken=result.access_token;await reloadCurrent();
  const latestFeedback=page.querySelector(".mc-feedback");if(latestFeedback){latestFeedback.className="mc-success";latestFeedback.textContent=priv.checked?"Tu mensaje privado fue enviado. Guarda este enlace para consultar las respuestas.":"Tu mensaje fue publicado. Guarda el enlace para volver a tu conversación.";const latestCopy=button("Copiar enlace de seguimiento","mc-copy",async()=>{const ok=await copy(url);latestCopy.textContent=ok?"Enlace copiado":"No se pudo copiar"});latestFeedback.append(latestCopy)}
 }catch(err){showError(feedback,err.message)}finally{send.disabled=false}});
 page.append(formCard);
 const wall=$("section","mc-wall"),wallHead=$("div","mc-wall-head");wallHead.append($("div","mc-section-kicker","EL MURO"),$("h2","mc-section-title",data.isOwner?"Mensajes recibidos":"Mensajes públicos"),$("p","mc-subtle",data.messages.length+" mensajes en este enlace"));wall.append(wallHead);
 if(!data.messages.length)wall.append($("div","mc-empty","Todavía no hay mensajes. Puedes ser la primera persona en escribir."));else data.messages.forEach(m=>wall.append(renderMessage(m,!!data.isOwner,currentToken)));
 page.append(wall,$("footer","mc-foot","Interacción · Un lugar para expresarte con respeto"));
}
function openOwnerDashboard(){openDashboard().catch(e=>alert(e.message))}
async function openDashboard(){
 const {data:{user}}=await db.auth.getUser();if(!user)throw new Error("Inicia sesión en tu perfil para administrar este enlace.");
 const result=await api({action:"create_link"}),link=result.link,modal=$("div","mc-admin-modal");modal.id="mc-admin-modal";
 const panel=$("section","mc-admin-panel"),head=$("div","mc-admin-head"),title=$("div","");title.append($("div","mc-kicker","INTERACCIÓN · PANEL PRIVADO"),$("h2","","Tu enlace de confesiones"));head.append(title,button("×","mc-admin-close",()=>{modal.remove();delete window.__mcRefreshDashboard}));panel.append(head);
 const linkBox=$("div","mc-link-box"),linkInput=$("input","");linkInput.readOnly=true;linkInput.value=location.origin+baseFrom(routePath())+"confesiones/"+link.slug;
 linkBox.append(linkInput,button("Copiar","mc-copy",async()=>{await copy(linkInput.value)}),button("Abrir ↗","mc-quiet",()=>window.open(linkInput.value,"_blank","noopener")));panel.append(linkBox);
 const settings=$("form","mc-settings"),titleField=$("label","","Título del enlace"),ti=$("input","");ti.maxLength=70;ti.value=link.title||"Confesiones";titleField.append(ti);
 const descField=$("label","","Descripción"),de=$("textarea","");de.rows=2;de.maxLength=240;de.value=link.description||"";descField.append(de);
 const enabledLabel=$("label","mc-toggle"),enabled=$("input","");enabled.type="checkbox";enabled.checked=link.is_enabled;enabledLabel.append(enabled,$("span","","Enlace activo"));
 const save=$("button","mc-send","Guardar ajustes");save.type="submit";const settingsMsg=$("span","mc-form-msg","");
 settings.append(titleField,descField,enabledLabel,save,settingsMsg);settings.addEventListener("submit",async e=>{e.preventDefault();save.disabled=true;try{await api({action:"update_link",title:ti.value,description:de.value,is_enabled:enabled.checked});settingsMsg.textContent="Cambios guardados";await refreshDashboard()}catch(err){showError(settingsMsg,err.message)}finally{save.disabled=false}});panel.append(settings);
 const stats=$("div","mc-stats"),chart=$("section","mc-chart"),messages=$("section","mc-admin-messages");panel.append(stats,chart,messages);
 const danger=$("section","mc-danger-zone");danger.append($("h3","","Zona de cuidado"),$("p","","Borrar toda la interacción elimina mensajes, respuestas, reacciones, reportes y estadísticas de visitas. El enlace y sus ajustes se conservan."),button("Borrar toda la interacción","mc-danger-wide",async()=>{const typed=prompt("Esta acción no se puede deshacer. Escribe BORRAR para confirmar.");if(typed!=="BORRAR")return;try{await api({action:"delete_all"});await refreshDashboard();alert("La interacción de este enlace fue borrada.")}catch(e){alert(e.message)}}));panel.append(danger);
 modal.append(panel);document.body.append(modal);modal.addEventListener("click",e=>{if(e.target===modal){modal.remove();delete window.__mcRefreshDashboard}});window.__mcRefreshDashboard=refreshDashboard;await refreshDashboard();
 async function refreshDashboard(){
  const [s,g]=await Promise.all([api({action:"stats"}),api({action:"get",slug:link.slug})]),t=s.totals||{};
  stats.replaceChildren();[["Visitas",t.visits],["Mensajes",t.messages],["Públicos",t.public],["Privados",t.private],["Respuestas",t.replies],["Reacciones",t.reactions],["Reportes",t.reports]].forEach(([k,v])=>{const c=$("div","mc-stat");c.append($("small","",k),$("strong","",String(v||0)));stats.append(c)});
  chart.replaceChildren($("h3","","Actividad · últimos 14 días"));const days=s.daily||[],max=Math.max(1,...days.map(d=>Math.max(d.visits,d.messages,d.replies))),graph=$("div","mc-bars");
  days.forEach(d=>{const col=$("div","mc-bar-col"),bars=$("div","mc-bar-stack");[["visits",d.visits],["messages",d.messages],["replies",d.replies]].forEach(([key,val])=>{const bar=$("i","mc-bar mc-"+key);bar.style.height=Math.max(2,(val/max)*100)+"%";bar.title=key+": "+val;bars.append(bar)});col.append(bars,$("small","",d.date.slice(5)));graph.append(col)});
  chart.append(graph,$("div","mc-legend","Visitas · Mensajes · Respuestas"));
  messages.replaceChildren($("h3","","Buzón y moderación"));if(!(g.messages||[]).length)messages.append($("p","mc-subtle","Todavía no has recibido mensajes."));else g.messages.forEach(m=>messages.append(renderMessage(m,true,"")));
 }
}
async function loadPublic(slug){currentSlug=slug;currentToken=tokenFromHash();buildPage();page.append($("div","mc-loading","Cargando tu espacio…"));try{const data=await api({action:"get",slug,token:currentToken});await api({action:"visit",slug,visitor_id:visitor()}).catch(()=>{});renderPublic(data)}catch(e){page.replaceChildren($("div","mc-error-page","Este enlace no está disponible"),$("p","mc-subtle",e.message),button("Volver a Interacción","mc-send",()=>location.href=baseFrom(location.pathname)))}}
const match=routePath().match(/\/confesiones\/([^/]+)/);if(match)loadPublic(decodeURIComponent(match[1]));
})();