create schema if not exists private;

create table if not exists public.confession_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{8,48}$'),
  title text not null default 'Confesiones',
  description text not null default 'Deja aquí un mensaje. Puedes hacerlo de forma anónima.',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.confessions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.confession_links(id) on delete cascade,
  body text not null check (char_length(body) between 2 and 1200),
  author_name text check (author_name is null or char_length(author_name) between 1 and 40),
  visibility text not null default 'public' check (visibility in ('public','private')),
  status text not null default 'visible' check (status in ('visible','hidden')),
  access_token_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.confession_replies (
  id uuid primary key default gen_random_uuid(),
  confession_id uuid not null references public.confessions(id) on delete cascade,
  author_role text not null check (author_role in ('owner','sender')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.confession_reactions (
  id uuid primary key default gen_random_uuid(),
  confession_id uuid not null references public.confessions(id) on delete cascade,
  visitor_hash text not null,
  emoji text not null check (emoji in ('❤️','😂','😮','🥹','🔥','👏','💜')),
  created_at timestamptz not null default now(),
  unique(confession_id, visitor_hash)
);

create table if not exists public.confession_visits (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.confession_links(id) on delete cascade,
  visitor_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.confession_reports (
  id uuid primary key default gen_random_uuid(),
  confession_id uuid not null references public.confessions(id) on delete cascade,
  reporter_hash text not null,
  reason text not null check (reason in ('spam','acoso','contenido_inapropiado','otro')),
  created_at timestamptz not null default now(),
  unique(confession_id, reporter_hash)
);

create table if not exists private.confession_rate_limits (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists confession_links_slug_idx on public.confession_links(slug);
create index if not exists confessions_link_created_idx on public.confessions(link_id, created_at desc);
create index if not exists confession_replies_confession_created_idx on public.confession_replies(confession_id, created_at);
create index if not exists confession_reactions_confession_idx on public.confession_reactions(confession_id);
create index if not exists confession_visits_link_created_idx on public.confession_visits(link_id, created_at desc);
create index if not exists confession_reports_confession_idx on public.confession_reports(confession_id, created_at desc);
create index if not exists confession_rate_limits_ip_action_idx on private.confession_rate_limits(ip_hash, action, created_at desc);

alter table public.confession_links enable row level security;
alter table public.confessions enable row level security;
alter table public.confession_replies enable row level security;
alter table public.confession_reactions enable row level security;
alter table public.confession_visits enable row level security;
alter table public.confession_reports enable row level security;
alter table private.confession_rate_limits enable row level security;

revoke all on public.confession_links, public.confessions, public.confession_replies, public.confession_reactions, public.confession_visits, public.confession_reports from anon, authenticated;
revoke all on private.confession_rate_limits from anon, authenticated;
grant all on public.confession_links, public.confessions, public.confession_replies, public.confession_reactions, public.confession_visits, public.confession_reports to service_role;
grant usage on schema private to service_role;
grant all on private.confession_rate_limits to service_role;
