(() => {
  const cfg = window.MBM_SUPABASE;
  if (!cfg || !window.supabase) return;
  const client = window.supabase.createClient(cfg.url, cfg.key);
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

  // Registro básico y transparente: sin huella digital ni IP completa.
  fetch(cfg.url + "/functions/v1/mbm-record-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.key, Authorization: "Bearer " + cfg.key },
    body: "{}",
    keepalive: true
  }).catch(() => {});

  async function loadLikes() {
    const countEl = $("mbmLikeCount");
    if (!countEl) return;
    const [{ count }, { data: own }] = await Promise.all([
      client.from("profile_likes").select("*", { count: "exact", head: true }),
      client.from("profile_likes").select("id").eq("visitor_id", visitorId).maybeSingle()
    ]);
    countEl.textContent = String(count || 0);
    if (own) {
      $("mbmLikeButton")?.classList.add("liked");
      $("mbmLikeButton")?.setAttribute("aria-pressed", "true");
    }
  }
  $("mbmLikeButton")?.addEventListener("click", async () => {
    const button = $("mbmLikeButton");
    button.disabled = true;
    const { data: existing } = await client.from("profile_likes").select("id").eq("visitor_id", visitorId).maybeSingle();
    if (!existing) {
      const { error } = await client.from("profile_likes").insert({ visitor_id: visitorId });
      if (!error) button.classList.add("liked");
    }
    await loadLikes();
    button.disabled = false;
  });
  async function loadComments() {
    const list = $("mbmCommentsList");
    if (!list) return;
    const { data, error } = await client.from("profile_comments").select("id,display_name,body,created_at").eq("approved", true).order("created_at", { ascending: false }).limit(50);
    list.replaceChildren();
    if (error || !data?.length) {
      const empty = document.createElement("p"); empty.className = "mbm-muted"; empty.textContent = "Todavía no hay comentarios publicados."; list.append(empty); return;
    }
    data.forEach(item => {
      const card = document.createElement("article"); card.className = "mbm-comment";
      const head = document.createElement("div"); head.className = "mbm-comment-head";
      const name = document.createElement("strong"); name.textContent = item.display_name;
      const date = document.createElement("time"); date.dateTime = item.created_at; date.textContent = new Date(item.created_at).toLocaleDateString("es", {day:"numeric",month:"short",year:"numeric"});
      const body = document.createElement("p"); body.textContent = item.body;
      head.append(name,date); card.append(head,body); list.append(card);
    });
  }
  $("mbmCommentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("mbmCommentName").value.trim();
    const body = $("mbmCommentBody").value.trim();
    const message = $("mbmCommentMessage");
    if (!name || !body) return;
    const submit = $("mbmCommentSubmit"); submit.disabled = true;
    const { error } = await client.from("profile_comments").insert({ display_name: name, body, approved: false });
    status(message, error ? "No se pudo enviar. Inténtalo más tarde." : "¡Comentario enviado! Aparecerá cuando sea aprobado.");
    if (!error) event.target.reset();
    submit.disabled = false;
  });

  // Un solo toque en el logotipo abre el acceso de administrador.
  const logo = document.querySelector(".brand");
  logo?.addEventListener("click", () => {
    $("mbmAdminPanel").hidden = false;
    $("mbmAdminEmail")?.focus();
  });

  $("mbmAdminClose")?.addEventListener("click", () => $("mbmAdminPanel").hidden = true);
  $("mbmAdminSignup")?.addEventListener("click", async () => {
    const email = $("mbmAdminEmail").value.trim();
    const password = $("mbmAdminPassword").value;
    const message = $("mbmAdminMessage");
    if (!email || password.length < 8) {
      status(message, "Escribe tu correo y una contraseña de al menos 8 caracteres.");
      return;
    }
    const { error } = await client.auth.signUp({ email, password });
    status(message, error ? "No se pudo crear la cuenta. Comprueba el correo o si ya existe." : "Cuenta creada. Revisa tu correo para confirmar. Después habrá que autorizarla como administradora.");
  });
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
    await refreshAdmin();
  });
  $("mbmAdminLogout")?.addEventListener("click", async () => {
    await client.auth.signOut();
    $("mbmAdminDashboard").hidden = true;
    $("mbmAdminLogin").hidden = false;
  });
  async function refreshAdmin() {
    const [visits, comments, likes] = await Promise.all([
      client.from("profile_visits").select("id,visited_at,browser,device_type,ip_prefix").order("visited_at",{ascending:false}).limit(100),
      client.from("profile_comments").select("id,display_name,body,created_at,approved").order("created_at",{ascending:false}).limit(100),
      client.from("profile_likes").select("*",{count:"exact",head:true})
    ]);
    $("mbmAdminVisitsCount").textContent = visits.error ? "—" : String(visits.data.length);
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
    if (visits.error || comments.error) status($("mbmAdminDataMessage"), "Tu cuenta aún no tiene permisos de administrador.");
    else status($("mbmAdminDataMessage"), "");
  }
  loadLikes(); loadComments();
})();