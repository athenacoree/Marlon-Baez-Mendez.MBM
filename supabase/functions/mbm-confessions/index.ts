import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const secretKeys = (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); } catch { return {}; } })();
const publishableKeys = (() => { try { return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"); } catch { return {}; } })();
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secretKeys.default;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || publishableKeys.default || "";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const fail = (message: string, status = 400) => json({ error: message }, status);
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
const randomHex = (n = 32) => {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
};
const hash = async (value: string) => {
  const data = new TextEncoder().encode(SERVICE + ":" + value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
};
async function userFrom(req: Request) {
  const bearer = req.headers.get("authorization") || "";
  const token = bearer.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!token || token.startsWith("sb_") || !ANON) return null;
  const client = createClient(URL, ANON, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}
async function checkRate(req: Request, action: string, max: number, windowMinutes = 5) {
  const forwarded = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = await hash(forwarded);
  const since = new Date(Date.now() - windowMinutes * 60000).toISOString();
  const { count, error } = await admin.from("confession_rate_limits").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).eq("action", action).gte("created_at", since);
  if (error) throw error;
  if ((count || 0) >= max) return false;
  const { error: insertError } = await admin.from("confession_rate_limits").insert({ ip_hash: ipHash, action });
  if (insertError) throw insertError;
  await admin.from("confession_rate_limits").delete().lt("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
  return true;
}
async function getLink(slug: string) {
  const { data, error } = await admin.from("confession_links").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}
async function ownerLink(userId: string) {
  const { data, error } = await admin.from("confession_links").select("*").eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
async function mustOwn(linkId: string, userId: string) {
  const { data, error } = await admin.from("confession_links").select("*").eq("id", linkId).eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No tienes permiso para administrar este enlace.");
  return data;
}
async function getThread(confessionId: string) {
  const { data, error } = await admin.from("confessions").select("*").eq("id", confessionId).maybeSingle();
  if (error) throw error;
  return data;
}
async function ownerOfLink(linkId: string, userId: string) {
  const { data, error } = await admin.from("confession_links").select("id").eq("id", linkId).eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  return !!data;
}
function allowedVisibility(v: string) { return v === "private" ? "private" : "public"; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Método no permitido.", 405);
  try {
    const input = await req.json();
    const action = clean(input.action, 32);
    const user = await userFrom(req);

    if (action === "get") {
      const slug = clean(input.slug, 48);
      const link = await getLink(slug);
      if (!link) return fail("Este enlace no existe.", 404);
      const isOwner = !!user && user.id === link.owner_id;
      if (!link.is_enabled && !isOwner) return fail("Este buzón está pausado.", 404);
      let messagesQuery = admin.from("confessions").select("id,link_id,body,author_name,visibility,status,created_at,access_token_hash").eq("link_id", link.id).order("created_at", { ascending: false }).limit(100);
      if (!isOwner) messagesQuery = messagesQuery.eq("visibility", "public").eq("status", "visible");
      const { data: baseMessages, error: messagesError } = await messagesQuery;
      if (messagesError) throw messagesError;
      let messages = baseMessages || [];
      const token = clean(input.token, 160);
      if (!isOwner && token) {
        const tokenHash = await hash(token);
        const { data: privateThread, error: tokenError } = await admin.from("confessions").select("id,link_id,body,author_name,visibility,status,created_at,access_token_hash").eq("link_id", link.id).eq("access_token_hash", tokenHash).maybeSingle();
        if (tokenError) throw tokenError;
        if (privateThread && !messages.some(m => m.id === privateThread.id)) messages = [privateThread, ...messages];
      }
      const ids = messages.map(m => m.id);
      let replies: any[] = [], reactions: any[] = [];
      if (ids.length) {
        const [r, a] = await Promise.all([
          admin.from("confession_replies").select("id,confession_id,author_role,body,created_at").in("confession_id", ids).order("created_at", { ascending: true }).limit(3000),
          admin.from("confession_reactions").select("confession_id,emoji").in("confession_id", ids).limit(5000)
        ]);
        if (r.error) throw r.error; if (a.error) throw a.error;
        replies = r.data || []; reactions = a.data || [];
      }
      const output = messages.map(m => ({
        id: m.id, body: m.body, author_name: m.author_name || "Anónimo", visibility: m.visibility, status: m.status, created_at: m.created_at,
        replies: replies.filter(r => r.confession_id === m.id),
        reactions: reactions.filter(r => r.confession_id === m.id).reduce((acc: Record<string, number>, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})
      }));
      const { data: ownerProfile } = await admin.from("profiles").select("name,handle,avatar_url").eq("id", link.owner_id).maybeSingle();
      return json({ link: { id: link.id, slug: link.slug, title: link.title, description: link.description, is_enabled: link.is_enabled }, owner: ownerProfile || null, isOwner, messages: output });
    }

    if (action === "create_link" || action === "update_link") {
      if (!user) return fail("Inicia sesión para administrar tu enlace.", 401);
      let link = await ownerLink(user.id);
      if (!link && action === "create_link") {
        const slug = "conf-" + randomHex(8);
        const { data, error } = await admin.from("confession_links").insert({ owner_id: user.id, slug }).select("*").single();
        if (error) throw error;
        link = data;
      }
      if (!link) return fail("Primero crea tu enlace de confesiones.", 404);
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof input.title === "string") update.title = clean(input.title, 70) || "Confesiones";
      if (typeof input.description === "string") update.description = clean(input.description, 240);
      if (typeof input.is_enabled === "boolean") update.is_enabled = input.is_enabled;
      const { data, error } = await admin.from("confession_links").update(update).eq("id", link.id).eq("owner_id", user.id).select("*").single();
      if (error) throw error;
      return json({ link: data });
    }

    if (action === "submit") {
      const slug = clean(input.slug, 48), body = clean(input.body, 1200), author = clean(input.author_name, 40);
      if (body.length < 2) return fail("Escribe un mensaje de al menos 2 caracteres.");
      const link = await getLink(slug);
      if (!link || !link.is_enabled) return fail("Este buzón no está disponible.", 404);
      if (!await checkRate(req, "submit", 5, 5)) return fail("Has enviado varios mensajes. Espera unos minutos.", 429);
      const token = randomHex(32);
      const { data, error } = await admin.from("confessions").insert({ link_id: link.id, body, author_name: author || null, visibility: allowedVisibility(clean(input.visibility, 10)), access_token_hash: await hash(token) }).select("id,visibility,created_at").single();
      if (error) throw error;
      return json({ confession: data, access_token: token });
    }

    if (action === "reply") {
      const confessionId = clean(input.confession_id, 64), body = clean(input.body, 1000), token = clean(input.token, 160);
      if (body.length < 1) return fail("Escribe una respuesta.");
      const confession = await getThread(confessionId);
      if (!confession) return fail("El mensaje ya no está disponible.", 404);
      const isOwner = !!user && await ownerOfLink(confession.link_id, user.id);
      const isSender = !!token && confession.access_token_hash === await hash(token);
      const canPublicReply = confession.visibility === "public" && confession.status === "visible";
      if (!isOwner && !isSender && !canPublicReply) return fail("No tienes acceso a esta conversación.", 403);
      if (!await checkRate(req, "reply", 12, 5)) return fail("Espera un momento antes de enviar otra respuesta.", 429);
      const { data, error } = await admin.from("confession_replies").insert({ confession_id: confessionId, author_role: isOwner ? "owner" : "sender", body }).select("id,confession_id,author_role,body,created_at").single();
      if (error) throw error;
      return json({ reply: data });
    }

    if (action === "react") {
      const confessionId = clean(input.confession_id, 64), emoji = clean(input.emoji, 8), visitorId = clean(input.visitor_id, 100), token = clean(input.token, 160);
      const allowed = ["❤️","😂","😮","🥹","🔥","👏","💜"];
      if (!allowed.includes(emoji) || !visitorId) return fail("Reacción no válida.");
      const confession = await getThread(confessionId);
      if (!confession || confession.status !== "visible") return fail("Este mensaje no está disponible.", 404);
      const isOwner = !!user && await ownerOfLink(confession.link_id, user.id);
      const isSender = !!token && confession.access_token_hash === await hash(token);
      if (confession.visibility === "private" && !isOwner && !isSender) return fail("Esta confesión es privada.", 403);
      if (!await checkRate(req, "react", 40, 5)) return fail("Espera un momento antes de reaccionar otra vez.", 429);
      const { error } = await admin.from("confession_reactions").upsert({ confession_id: confessionId, visitor_hash: await hash(visitorId), emoji }, { onConflict: "confession_id,visitor_hash" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "report") {
      const confessionId = clean(input.confession_id, 64), visitorId = clean(input.visitor_id, 100), reason = clean(input.reason, 32);
      if (!visitorId || !["spam","acoso","contenido_inapropiado","otro"].includes(reason)) return fail("Reporte no válido.");
      const confession = await getThread(confessionId);
      if (!confession || confession.visibility !== "public" || confession.status !== "visible") return fail("Este mensaje no está disponible.", 404);
      if (!await checkRate(req, "report", 5, 10)) return fail("Espera antes de enviar otro reporte.", 429);
      const { error } = await admin.from("confession_reports").upsert({ confession_id: confessionId, reporter_hash: await hash(visitorId), reason }, { onConflict: "confession_id,reporter_hash" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "visit") {
      const slug = clean(input.slug, 48), visitorId = clean(input.visitor_id, 100);
      const link = await getLink(slug);
      if (!link || !link.is_enabled || !visitorId) return json({ ok: true });
      if (!await checkRate(req, "visit", 80, 5)) return json({ ok: true });
      const visitorHash = await hash(visitorId);
      const since = new Date(Date.now() - 30 * 60000).toISOString();
      const { data: recent, error: recentError } = await admin.from("confession_visits").select("id").eq("link_id", link.id).eq("visitor_hash", visitorHash).gte("created_at", since).limit(1);
      if (recentError) throw recentError;
      if (!recent?.length) {
        const { error } = await admin.from("confession_visits").insert({ link_id: link.id, visitor_hash: visitorHash });
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (action === "stats" || action === "delete_all" || action === "moderate" || action === "delete_message") {
      if (!user) return fail("Inicia sesión para continuar.", 401);
      const link = await ownerLink(user.id);
      if (!link) return fail("No tienes un enlace de confesiones todavía.", 404);
      if (action === "delete_all") {
        const { error: e1 } = await admin.from("confessions").delete().eq("link_id", link.id);
        if (e1) throw e1;
        const { error: e2 } = await admin.from("confession_visits").delete().eq("link_id", link.id);
        if (e2) throw e2;
        return json({ ok: true });
      }
      if (action === "moderate") {
        const id = clean(input.confession_id, 64), status = clean(input.status, 16);
        if (!["visible","hidden"].includes(status)) return fail("Estado no válido.");
        const { data, error } = await admin.from("confessions").update({ status }).eq("id", id).eq("link_id", link.id).select("id,status").single();
        if (error) throw error;
        return json({ confession: data });
      }
      if (action === "delete_message") {
        const id = clean(input.confession_id, 64);
        const { error } = await admin.from("confessions").delete().eq("id", id).eq("link_id", link.id);
        if (error) throw error;
        return json({ ok: true });
      }
      const [c, v] = await Promise.all([
        admin.from("confessions").select("id,visibility,status,created_at").eq("link_id", link.id).order("created_at", { ascending: false }).limit(5000),
        admin.from("confession_visits").select("created_at").eq("link_id", link.id).order("created_at", { ascending: false }).limit(10000)
      ]);
      if (c.error) throw c.error;
      if (v.error) throw v.error;
      const messages = c.data || [], visits = v.data || [], ids = messages.map((x: any) => x.id);
      let replies: any[] = [], reactions: any[] = [], reportRows: any[] = [];
      if (ids.length) {
        const [r, a, rp] = await Promise.all([
          admin.from("confession_replies").select("id,created_at,confession_id").in("confession_id", ids).limit(10000),
          admin.from("confession_reactions").select("id,emoji,created_at,confession_id").in("confession_id", ids).limit(10000),
          admin.from("confession_reports").select("id,reason,created_at,confession_id").in("confession_id", ids).limit(5000)
        ]);
        if (r.error) throw r.error; if (a.error) throw a.error; if (rp.error) throw rp.error;
        replies = r.data || []; reactions = a.data || []; reportRows = rp.data || [];
      }      const daily: Record<string, any> = {};
      for (let i=13;i>=0;i--) { const d=new Date(); d.setDate(d.getDate()-i); const key=d.toISOString().slice(0,10); daily[key]={date:key,visits:0,messages:0,replies:0,reactions:0}; }
      const addDay=(date:string,key:string)=>{const day=date.slice(0,10);if(daily[day])daily[day][key]++;};
      visits.forEach(x=>addDay(x.created_at,"visits"));messages.forEach(x=>addDay(x.created_at,"messages"));replies.forEach(x=>addDay(x.created_at,"replies"));reactions.forEach(x=>addDay(x.created_at,"reactions"));
      return json({
        link, totals:{visits:visits.length,messages:messages.length,public:messages.filter(x=>x.visibility==="public").length,private:messages.filter(x=>x.visibility==="private").length,replies:replies.length,reactions:reactions.length,reports:reportRows.filter(x=>messages.some(m=>m.id===x.confession_id)).length},
        daily:Object.values(daily), messages:messages.map(m=>({...m,reply_count:replies.filter(x=>x.confession_id===m.id).length,reaction_count:reactions.filter(x=>x.confession_id===m.id).length,report_count:reportRows.filter(x=>x.confession_id===m.id).length})),
      });
    }
    return fail("Acción desconocida.");
  } catch (error) {
    console.error("mbm-confessions:", error);
    return fail(error instanceof Error ? error.message : "No se pudo completar la operación.", 500);
  }
});