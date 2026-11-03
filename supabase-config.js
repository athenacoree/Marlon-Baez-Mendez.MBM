// Cliente único de Supabase para toda la plataforma Interacción.
// Evita que varias instancias compitan por la misma sesión de autenticación.
window.MBM_SUPABASE = {
  url: "https://akkotzmreadksrcuykhs.supabase.co",
  key: "sb_publishable_iera0nuspNKNZp0BaXleOw_BRo5ocki"
};
if (window.supabase && !window.MBM_DB) {
  window.MBM_DB = window.supabase.createClient(window.MBM_SUPABASE.url, window.MBM_SUPABASE.key);
}