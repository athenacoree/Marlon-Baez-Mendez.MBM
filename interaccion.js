(()=> {
 "use strict";
 const cfg=window.MBM_SUPABASE;
 if(!cfg||!window.supabase)return;
 const db=window.supabase.createClient(cfg.url,cfg.key);
 const $=id=>document.getElementById(id);
 const authModal=$("ia-auth-modal"),editModal=$("ia-edit-modal");
 let mode="signup",currentUser=null,currentProfile=null;
 const decodePath=()=>{const u=new URL(location.href);const forwarded=u.searchParams.get("__interaccion_path");if(forwarded){u.searchParams.delete("__interaccion_path");history.replaceState({}, "",u.pathname+(u.search?u.search:"")+u.hash);return forwarded;}return location.pathname;};
 let routePath=decodePath();
 const findBase=path=>{const marker="/interaccion/";const at=path.indexOf(marker);if(at>=0)return path.slice(0,at+1)||"/";const clean=path.endsWith("/")?path:path.slice(0,path.lastIndexOf("/")+1);return clean||"/";};
 let basePath=findBase(routePath);
 const getHandle=path=>{const m=path.match(/\/interaccion\/([^/?#]+)/);return m?decodeURIComponent(m[1]).replace(/^@/,"").toLowerCase():"";};
 const routeTo=(handle,replace=false)=>{const path=basePath+"interaccion/"+encodeURIComponent(handle);history[replace?"replaceState":"pushState"]({}, "",path);routePath=path;loadRoute();};
 const show=(el,on)=>el.classList.toggle("open",!!on);
 const setMsg=(id,msg)=>{const el=$(id);if(el)el.textContent=msg||""};
 function authMode(next){mode=next;$("ia-auth-title").textContent=next==="signup"?"Crea tu perfil":"Bienvenido de nuevo";$("ia-auth-subtitle").textContent=next==="signup"?"Elige cómo quieres aparecer. No necesitas poner apellidos.":"Entra con el correo y la contraseña de tu cuenta."; $("ia-name-label").hidden=next!=="signup";$("ia-name").required=next==="signup";$("ia-password").autocomplete=next==="signup"?"new-password":"current-password";$("ia-auth-submit").textContent=next==="signup"?"Crear mi perfil":"Entrar";$("ia-auth-switch").textContent=next==="signup"?"Ya tengo una cuenta · Entrar":"Soy nuevo · Crear perfil";$("ia-auth-form").reset();setMsg("ia-auth-message","");show(authModal,true);}
 $("ia-signup-open").addEventListener("click",()=>authMode("signup"));
 $("ia-login-open").addEventListener("click",()=>authMode("login"));
 $("ia-auth-switch").addEventListener("click",()=>authMode(mode==="signup"?"login":"signup"));
 $("ia-auth-close").addEventListener("click",()=>show(authModal,false));
 $("ia-edit-close").addEventListener("click",()=>show(editModal,false));
 authModal.addEventListener("click",e=>{if(e.target===authModal)show(authModal,false)});
 editModal.addEventListener("click",e=>{if(e.target===editModal)show(editModal,false)});
 $("ia-auth-form").addEventListener("submit",async e=>{
  e.preventDefault();const button=$("ia-auth-submit");button.disabled=true;setMsg("ia-auth-message","Un momento…");
  const email=$("ia-email").value.trim(),password=$("ia-password").value;
  try{
   if(mode==="signup"){
    const name=$("ia-name").value.trim();
    if(!name)throw new Error("Escribe el nombre que aparecerá en tu perfil.");
    const {data,error}=await db.auth.signUp({email,password,options:{data:{display_name:name}}});
    if(error)throw error;
    if(!data.session){setMsg("ia-auth-message","Cuenta creada. Revisa tu correo para confirmar el registro y luego entra.");return;}
    currentUser=data.user;await ensureProfile(name);show(authModal,false);$("ia-login-open").hidden=true;$("ia-signup-open").hidden=true;$("ia-account-open").hidden=false;routeTo(currentProfile.handle);
   }else{
    const {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;
    currentUser=data.user;await ensureProfile();show(authModal,false);$("ia-login-open").hidden=true;$("ia-signup-open").hidden=true;$("ia-account-open").hidden=false;routeTo(currentProfile.handle);
   }
  }catch(err){setMsg("ia-auth-message",err.message||"No se pudo completar el acceso.");}
  finally{button.disabled=false;}
 });
 async function ensureProfile(fallbackName){
  const {data:userData}=await db.auth.getUser();currentUser=userData.user||currentUser;
  if(!currentUser)throw new Error("No se pudo validar la sesión.");
  let {data,error}=await db.from("profiles").select("id,name,handle,bio,avatar_url,cover_url").eq("id",currentUser.id).maybeSingle();
  if(error)throw error;
  if(!data){
   const name=fallbackName||currentUser.user_metadata?.display_name||currentUser.email?.split("@")[0]||"Usuario";
   const {data:created,error:createError}=await db.from("profiles").insert({id:currentUser.id,name,handle:"user-"+currentUser.id.replace(/-/g,"").slice(0,10),bio:"✨ Nuevo en Interacción"}).select("id,name,handle,bio,avatar_url,cover_url").single();
   if(createError)throw createError;data=created;
  }
  currentProfile=data;return data;
 }
 async function refreshSession(){
  const {data}=await db.auth.getSession();currentUser=data.session?.user||null;
  if(currentUser){try{await ensureProfile();$("ia-login-open").hidden=true;$("ia-signup-open").hidden=true;$("ia-account-open").hidden=false;}catch(err){console.error("No se pudo cargar el perfil:",err);}}
  else{$("ia-login-open").hidden=false;$("ia-signup-open").hidden=false;$("ia-account-open").hidden=true;}
 }
 function applyProfile(profile,isOwner){
  document.body.classList.remove("ia-home-mode");document.body.classList.add("ia-profile-mode");
  $("eyebrow").textContent="PERFIL DE INTERACCIÓN";
  $("name").textContent=profile.name||"Usuario";
  $("tagline").textContent=profile.bio||"Este perfil todavía no tiene una descripción.";
  $("contactBtn").textContent="Compartir perfil ↗";$("contactBtn").href=location.href;$("contactBtn").onclick=null;
  $("avatar").src=profile.avatar_url||"assets/profile.jpg";$("avatar").alt="Foto de "+(profile.name||"usuario");
  $("year").textContent=new Date().getFullYear();$("footerText").textContent="Perfil de "+(profile.name||"usuario");
  document.title=(profile.name||"Perfil")+" · Interacción";
  let actions=$("ia-profile-actions");if(!actions){actions=document.createElement("div");actions.id="ia-profile-actions";actions.className="ia-profile-actions";$("contactBtn").parentElement.append(actions);}
  actions.replaceChildren();
  const share=document.createElement("button");share.textContent="Compartir perfil";share.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.href);share.textContent="Enlace copiado";}catch{share.textContent=location.href;}});actions.append(share);
  if(isOwner){const edit=document.createElement("button");edit.textContent="Editar perfil";edit.addEventListener("click",()=>{ $("ia-edit-name").value=profile.name||"";$("ia-edit-handle").value=profile.handle||"";$("ia-edit-bio").value=profile.bio||"";setMsg("ia-edit-message","");show(editModal,true);});actions.append(edit);const out=document.createElement("button");out.textContent="Cerrar sesión";out.addEventListener("click",async()=>{await db.auth.signOut();currentUser=null;currentProfile=null;history.pushState({},"",basePath);loadRoute();await refreshSession();});actions.append(out);}
 }
 $("ia-edit-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!currentUser||!currentProfile)return;
  const name=$("ia-edit-name").value.trim(),handle=$("ia-edit-handle").value.trim().toLowerCase().replace(/^@/,"").replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,""),bio=$("ia-edit-bio").value.trim();
  if(!name||!handle){setMsg("ia-edit-message","El nombre y la dirección son obligatorios.");return;}
  const btn=e.submitter; if(btn)btn.disabled=true;setMsg("ia-edit-message","Guardando…");
  const {data,error}=await db.from("profiles").update({name,handle,bio}).eq("id",currentUser.id).select("id,name,handle,bio,avatar_url,cover_url").single();
  if(error){setMsg("ia-edit-message",error.code==="23505"?"Esa dirección ya está ocupada. Prueba otra.":error.message);if(btn)btn.disabled=false;return;}
  currentProfile=data;show(editModal,false);routeTo(data.handle,true);if(btn)btn.disabled=false;
 });
 async function loadRoute(){
  const handle=getHandle(routePath);
  if(!handle){
   document.body.classList.remove("ia-profile-mode");document.body.classList.add("ia-home-mode");
   $("eyebrow").textContent="UNA RED PARA CONECTAR";
   $("name").innerHTML="Tu nombre.<br><em>Tu espacio.</em>";
   $("tagline").textContent="Crea tu perfil, comparte lo que te representa y conecta con otras personas.";
   $("contactBtn").textContent="Crear mi perfil ↗";$("contactBtn").href="#";
   $("contactBtn").onclick=e=>{e.preventDefault();authMode("signup");};
   document.title="Interacción · Tu espacio en la red";
   const actions=$("ia-profile-actions");if(actions)actions.remove();
   return;
  }
  let {data,error}=await db.from("profiles").select("id,name,handle,bio,avatar_url,cover_url").eq("handle",handle).maybeSingle();
  if(!error&&!data){const legacy=await db.from("profiles").select("id,name,handle,bio,avatar_url,cover_url").eq("handle","@"+handle).maybeSingle();data=legacy.data;error=legacy.error;}
  if(error||!data){const oldActions=$("ia-profile-actions");if(oldActions)oldActions.remove();document.body.classList.remove("ia-profile-mode");document.body.classList.add("ia-home-mode");$("eyebrow").textContent="PERFIL NO ENCONTRADO";$("name").textContent="Este perfil no está disponible."; $("tagline").textContent="Comprueba que el enlace esté escrito correctamente.";return;}
  const owner=!!currentUser&&currentUser.id===data.id;currentProfile=owner?data:currentProfile;applyProfile(data,owner);
 }
 $("ia-account-open").addEventListener("click",()=>{if(currentProfile)routeTo(currentProfile.handle);});
 document.querySelector(".brand")?.addEventListener("click",()=>{history.pushState({},"",basePath);routePath=basePath;loadRoute();});
 window.addEventListener("popstate",()=>{routePath=location.pathname;basePath=findBase(routePath);loadRoute();});
 refreshSession().then(loadRoute);
})();