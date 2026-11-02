(() => {
  const cfg = window.MBM_SUPABASE;
  if (!cfg || !window.supabase) return;
  const client = window.supabase.createClient(cfg.url, cfg.key, { auth: { storageKey: "mbm_legacy_admin_auth_v1" } });
  const $ = (id) => document.getElementById(id);
  const status = (el, msg) => { if (el) el.textContent = msg; };
  const uuid = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  };
  let visitorId;
  try {
    visitorId = localStorage.getItem("mbm_visitor_id");
    if (!visitorId) { visitorId = uuid(); localStorage.setItem("mbm_visitor_id", visitorId); }
  } catch { visitorId = uuid(); }

  // El registro global de visitas de MBM se desactiva en la plataforma multiusuario.


  // Los antiguos likes y comentarios globales de MBM no se usan en perfiles individuales.

  // Un solo toque en el logotipo abre el acceso de administrador.
  const logo = document.querySelector(".brand");
  logo?.addEventListener("click", (event) => {
    if (!event.shiftKey) return;
    $("mbmAdminPanel").hidden = false;
    $("mbmAdminEmail")?.focus();
  });

  $("mbmAdminClose")?.addEventListener("click", () => $("mbmAdminPanel").hidden = true);
  $("mbmAdminLogin")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("mbmAdminMessage");
    const { error } = await client.auth.signInWithPassword({
      email: $("mbmAdminEmail").value.trim(),
      password: $("mbmAdminPassword").value
    });
    if (error) { status(message, "No se pudo iniciar sesión. Comprueba tus datos y autorización."); return; }
    $("mbmAdminLogin").hidden = true;
    $("mbmAdminDashboard").hidden = false;
    await loadSiteContent();
    fillEditor();
    await refreshAdmin();
  });
  $("mbmAdminLogout")?.addEventListener("click", async () => {
    await client.auth.signOut();
    $("mbmAdminDashboard").hidden = true;
    $("mbmAdminLogin").hidden = false;
  });

  const contentFields = ["name","eyebrow","tagline","bio","stamp","stampSmall","stampFoot","tagTop","tagBottom","aboutTitle","bioTitle","galleryTitle","footer","contact","interests"];
  const defaults = {
    name:"Marlon Báez Méndez", eyebrow:"MI ESPACIO PERSONAL",
    tagline:"Bienvenido a mi espacio personal. Conoce mis ideas, mis proyectos y un poco más sobre mí.",
    bio:"Soy una persona curiosa, creativa y apasionada por aprender y construir cosas nuevas. Este espacio es una pequeña ventana a mi mundo.",
    stamp:"Siempre hay algo nuevo por crear.", stampSmall:"NOTAS PERSONALES · 2026",
    stampFoot:"Curiosidad como punto de partida.", tagTop:"✦ BIENVENIDO A MBM",
    tagBottom:"CREATIVIDAD · IDEAS · VIDA", aboutTitle:"Un poco de mi universo.",
    bioTitle:"Hola, soy Marlon.", galleryTitle:"Momentos que cuentan.",
    footer:"Hecho con dedicación", contact:"",
    interests:["Tecnología","Creatividad","Proyectos","Aprendizaje"], extraInfoTitle:"Más cosas de mi mundo.", extraInfo:[], avatar:"", photos:[]
  };
  let siteContent = {...defaults};
  const fieldIds = {name:"editName",eyebrow:"editEyebrow",tagline:"editTagline",bio:"editBio",stamp:"editStamp",stampSmall:"editStampSmall",stampFoot:"editStampFoot",tagTop:"editTagTop",tagBottom:"editTagBottom",aboutTitle:"editAboutTitle",bioTitle:"editBioTitle",galleryTitle:"editGalleryTitle",footer:"editFooter",contact:"editContact"};
  function applySiteContent(data) {
    siteContent = {...defaults,...(data||{})};
    const put=(id,value)=>{const el=$(id);if(el&&value!==undefined)el.textContent=value};
    put("name",siteContent.name);put("eyebrow",siteContent.eyebrow);put("tagline",siteContent.tagline);
    put("bio",siteContent.bio);put("footerText",siteContent.footer);
    put("aboutTitle",siteContent.aboutTitle);put("bioTitle",siteContent.bioTitle);
    put("galleryTitle",siteContent.galleryTitle);put("extraInfoTitle",siteContent.extraInfoTitle);
    put("stampText",siteContent.stamp);put("stampSmall",siteContent.stampSmall);put("stampFoot",siteContent.stampFoot);
    put("tagTopText",siteContent.tagTop);put("tagBottomText",siteContent.tagBottom);
    if(siteContent.avatar) $("avatar").src=siteContent.avatar;
    if(siteContent.contact) $("contactBtn").href=siteContent.contact;
    const interests=$("interests");if(interests){interests.replaceChildren();(siteContent.interests||[]).forEach(v=>{const e=document.createElement("span");e.className="chip";e.textContent=v;interests.append(e)})}
    const extraSection=$("extraInfo"),extraCards=$("extraInfoCards");
    if(extraSection&&extraCards){extraCards.replaceChildren();(siteContent.extraInfo||[]).forEach(item=>{const card=document.createElement("article");card.className="extra-info-card";const title=document.createElement("h3");title.textContent=item.title;const body=document.createElement("p");body.textContent=item.body;card.append(title,body);extraCards.append(card)});extraSection.hidden=!(siteContent.extraInfo||[]).length}
    const gallery=$("photos");if(gallery&&siteContent.photos?.length){gallery.replaceChildren();siteContent.photos.forEach(src=>{const box=document.createElement("div");box.className="photo";const img=document.createElement("img");img.src=src;img.alt="Fotografía de la galería";img.loading="lazy";box.append(img);gallery.append(box)})}
  }
  async function loadSiteContent(){
    const {data,error}=await client.from("mbm_site_settings").select("content").eq("id",1).maybeSingle();
    if(!error&&data?.content)applySiteContent(data.content);
  }
  function fillEditor(){
    Object.entries(fieldIds).forEach(([key,id])=>{if($(id))$(id).value=siteContent[key]??""});
    $("editInterests").value=(siteContent.interests||[]).join(", ");
    $("editExtraInfoTitle").value=siteContent.extraInfoTitle||"";
    $("editExtraInfo").value=(siteContent.extraInfo||[]).map(item=>item.title+" | "+item.body).join("\n");
    renderGalleryAdmin();
  }
  function renderGalleryAdmin(){
    const box=$("editGalleryList");if(!box)return;box.replaceChildren();
    (siteContent.photos||[]).forEach((url,index)=>{
      const wrap=document.createElement("div");const img=document.createElement("img");img.src=url;img.alt="Foto "+(index+1);
      const del=document.createElement("button");del.type="button";del.textContent="Quitar";del.addEventListener("click",()=>{siteContent.photos.splice(index,1);renderGalleryAdmin()});
      wrap.append(img,del);box.append(wrap);
    });
  }
  async function uploadImage(file,folder){
    if(!file||!file.type.startsWith("image/"))throw new Error("Selecciona un archivo de imagen válido.");
    if(file.size>10*1024*1024)throw new Error("Cada imagen debe pesar menos de 10 MB.");
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    const path=folder+"/"+Date.now()+"-"+uuid()+"."+ext;
    const {error}=await client.storage.from("mbm-media").upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    return client.storage.from("mbm-media").getPublicUrl(path).data.publicUrl;
  }
  $("mbmSaveContent")?.addEventListener("click",async()=>{
    const msg=$("mbmEditorMessage"),btn=$("mbmSaveContent");btn.disabled=true;status(msg,"Guardando…");
    try{
      const next={...siteContent};
      Object.entries(fieldIds).forEach(([key,id])=>next[key]=$(id).value.trim());
      next.interests=$("editInterests").value.split(",").map(v=>v.trim()).filter(Boolean).slice(0,20);
      next.extraInfoTitle=$("editExtraInfoTitle").value.trim();
      next.extraInfo=$("editExtraInfo").value.split("\n").map(line=>{const parts=line.split("|");return {title:(parts.shift()||"").trim(),body:parts.join("|").trim()}}).filter(item=>item.title&&item.body).slice(0,12);
      const avatarFile=$("editAvatarFile").files[0];
      if(avatarFile)next.avatar=await uploadImage(avatarFile,"profile");
      const files=[...($("editGalleryFiles").files||[])];
      for(const file of files){next.photos.push(await uploadImage(file,"gallery"))}
      const {error}=await client.from("mbm_site_settings").upsert({id:1,content:next,updated_at:new Date().toISOString()});
      if(error)throw error;
      applySiteContent(next);fillEditor();
      $("editAvatarFile").value="";$("editGalleryFiles").value="";
      status(msg,"¡Cambios publicados correctamente!");
    }catch(error){console.error(error);status(msg,"No se pudieron guardar los cambios: "+(error.message||"revisa permisos y conexión"))}
    finally{btn.disabled=false}
  });
  // Interacción uses one profile row per account; do not apply legacy global site content here.

  async function refreshAdmin() {
    const [visits, visitTotal, comments, likes] = await Promise.all([
      client.from("profile_visits").select("id,visited_at,browser,device_type,ip_prefix").order("visited_at",{ascending:false}).limit(100),
      client.from("profile_visits").select("id",{count:"exact",head:true}),
      client.from("profile_comments").select("id,display_name,body,created_at,approved").order("created_at",{ascending:false}).limit(100),
      client.from("profile_likes").select("*",{count:"exact",head:true})
    ]);
    $("mbmAdminVisitsCount").textContent = visitTotal.error ? (visits.error ? "—" : String(visits.data.length)) : String(visitTotal.count ?? 0);
    $("mbmAdminLikesCount").textContent = String(likes.count || 0);
    const visitList = $("mbmAdminVisits"); visitList.replaceChildren();
    (visits.data || []).forEach(v => {
      const row = document.createElement("div"); row.className = "mbm-admin-row";
      const info = document.createElement("span");
      info.textContent = new Date(v.visited_at).toLocaleString("es") + " · " + v.device_type + " · " + v.browser + (v.ip_prefix ? " · IP parcial " + v.ip_prefix : "");
      row.append(info); visitList.append(row);
    });
    const commentList = $("mbmAdminComments"); commentList.replaceChildren();
    (comments.data || []).forEach(c => {
      const row = document.createElement("div"); row.className = "mbm-admin-row";
      const info = document.createElement("span"); info.textContent = c.display_name + ": " + c.body;
      const actions = document.createElement("div"); actions.className = "mbm-admin-actions";
      if (!c.approved) {
        const approve = document.createElement("button"); approve.textContent = "Aprobar";
        approve.addEventListener("click", async () => { await client.from("profile_comments").update({approved:true}).eq("id",c.id); await refreshAdmin(); });
        actions.append(approve);
      }
      const del = document.createElement("button"); del.textContent = "Eliminar";
      del.addEventListener("click", async () => { await client.from("profile_comments").delete().eq("id",c.id); await refreshAdmin(); });
      actions.append(del); row.append(info,actions); commentList.append(row);
    });
    if (visits.error || visitTotal.error || comments.error) status($("mbmAdminDataMessage"), "No se pudieron cargar todas las estadísticas. Comprueba tu conexión y permisos.");
    else status($("mbmAdminDataMessage"), "");
  }
})();