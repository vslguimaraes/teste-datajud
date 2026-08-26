-- Cache de consultas ao DataJud.
--
-- Motivo: a chave de API do CNJ é pública e COMPARTILHADA entre todos os
-- consumidores — não temos cota própria e não sabemos o teto. Ao mesmo tempo,
-- o dado do outro lado é replicado em lote e chega a ficar meses atrasado
-- (o TJSP consultado em 25/08/2026 estava atualizado até 28/04/2026).
--
-- Logo, guardar a resposta por horas não custa frescor nenhum e corta a
-- maior parte das chamadas. Cache aqui é proteção de cota, não performance.

create table if not exists public.consulta_cache (
  numero          char(20) primary key,
  alias           text        not null,
  estado          text        not null check (estado in ('encontrado', 'nao_indexado')),
  ficha           jsonb,
  consultado_em   timestamptz not null default now(),
  expira_em       timestamptz not null,
  -- Quantas vezes o cache evitou uma chamada ao CNJ. Serve para sabermos,
  -- no fim do beta, se o TTL escolhido faz sentido.
  acertos         integer     not null default 0,

  constraint ficha_presente_quando_encontrado
    check ((estado = 'encontrado') = (ficha is not null))
);

create index if not exists consulta_cache_expira_em_idx
  on public.consulta_cache (expira_em);

-- A tabela é escrita e lida exclusivamente pela edge function, que usa a
-- service role key. Nenhum cliente fala com ela direto, então RLS fica
-- ligado sem nenhuma policy: isso nega acesso a anon e authenticated.
alter table public.consulta_cache enable row level security;

comment on table public.consulta_cache is
  'Cache de consultas ao DataJud. Escrito apenas pela edge function processo.';
comment on column public.consulta_cache.estado is
  'nao_indexado NAO significa que o processo nao existe: sigilo, numero '
  'inexistente e lacuna de replicacao sao indistinguiveis pela API publica.';
