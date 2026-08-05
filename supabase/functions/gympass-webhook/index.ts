// Webhook de check-in do Wellhub (ex-Gympass).
//
// Contexto: ninguém do time tem acesso ao Partner Portal, então NÃO sabemos com
// certeza o formato do payload nem o token que o Wellhub envia. A versão
// anterior chutava os nomes dos campos ('event', 'user_email') e respondia 200
// silenciosamente quando não reconhecia — o que deixava qualquer erro invisível
// (foram 19 dias sem um único check-in sem ninguém perceber). Esta versão
// registra tudo que chega em wellhub_webhook_log, inclusive as requisições
// rejeitadas, para que a primeira chamada real revele formato e token.
//
// Requer "Verify JWT with legacy secret" DESLIGADO nas Settings da função —
// senão o Supabase barra a chamada antes deste código rodar, já que o Wellhub
// manda x-api-key e não um JWT do Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type, x-gympass-signature',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Primeiro caminho que existir no objeto ('a.b.c' navega aninhado). */
function pick(obj: unknown, paths: string[]): unknown {
  for (const path of paths) {
    let cur: any = obj;
    let found = true;
    for (const part of path.split('.')) {
      if (cur && typeof cur === 'object' && part in cur) cur = cur[part];
      else { found = false; break; }
    }
    if (found && cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return undefined;
}

// Sem o contrato oficial do parceiro, aceitamos o conjunto de nomes que
// webhooks desse tipo costumam usar, em vez de exigir um só e falhar calado.
const EVENT_PATHS = ['event', 'event_type', 'eventType', 'type', 'action', 'data.event', 'data.type'];
const EMAIL_PATHS = [
  'user_email', 'member_email', 'email', 'userEmail', 'memberEmail',
  'user.email', 'member.email', 'data.user_email', 'data.email',
  'data.user.email', 'data.member.email', 'payload.user_email', 'payload.email',
];
const TIME_PATHS = [
  'check_in_time', 'checkin_at', 'checked_in_at', 'checkInTime', 'occurred_at',
  'timestamp', 'created_at', 'date', 'data.check_in_time', 'data.timestamp', 'data.occurred_at',
];

/** 'CHECK-IN', 'check_in', 'checkIn' → 'checkin' */
const normalizeEvent = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');

/** Só as pontas do token: dá pra comparar sem gravar a credencial inteira. */
const maskKey = (k: string | null) =>
  !k ? null
    : k.length <= 10 ? `${k.slice(0, 2)}*** (${k.length} chars)`
    : `${k.slice(0, 6)}***${k.slice(-4)} (${k.length} chars)`;

/** ilike trata _ e % como coringa — num e-mail isso casaria a pessoa errada. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Data no fuso do Brasil — o resto do app usa America/Sao_Paulo. Antes isso
 *  era UTC, então um check-in das 21h caía no dia seguinte. */
const brDate = (value?: string) => {
  const d = value ? new Date(value) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  return safe.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const rawBody = await req.text();
  let payload: any = null;
  try { payload = rawBody ? JSON.parse(rawBody) : null; } catch { /* segue null */ }

  const apiKey = req.headers.get('x-api-key') || req.headers.get('x-gympass-signature');

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    // Credenciais vão no campo próprio (mascaradas), não no dump de headers.
    if (['authorization', 'x-api-key', 'x-gympass-signature'].includes(key.toLowerCase())) return;
    headers[key] = value;
  });

  /** exposeKey: grava o token em claro — só na falha de autenticação. */
  const log = async (outcome: string, detail?: string, exposeKey = false) => {
    try {
      await supabase.from('wellhub_webhook_log').insert({
        method: req.method,
        headers,
        payload: payload ?? { _unparsed_body: rawBody.slice(0, 4000) },
        api_key_received: exposeKey ? apiKey : maskKey(apiKey),
        outcome,
        detail: detail ?? null,
      });
    } catch (err) {
      console.error('Falha ao gravar wellhub_webhook_log:', err);
    }
  };

  if (req.method !== 'POST') {
    await log('method_not_allowed', req.method);
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const secret = Deno.env.get('GYMPASS_WEBHOOK_SECRET');

  // A versão anterior fazia `if (secret && apiKey !== secret)`: sem o secret
  // configurado, ela aceitava QUALQUER requisição — qualquer um na internet
  // poderia forjar check-ins e distribuir XP. Agora a ausência recusa.
  if (!secret) {
    await log('no_secret_configured', 'GYMPASS_WEBHOOK_SECRET não está definido');
    return json({ error: 'webhook secret não configurado' }, 500);
  }

  if (apiKey !== secret) {
    await log('unauthorized', 'x-api-key não confere com GYMPASS_WEBHOOK_SECRET', true);
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  if (!payload) {
    await log('invalid_json', 'corpo vazio ou não é JSON');
    return json({ error: 'payload inválido' }, 400);
  }

  // Evento reconhecido e diferente de check-in: ignora. Nenhum campo de evento
  // reconhecível: segue mesmo assim — o webhook foi cadastrado no portal só
  // para check_in, então descartar seria pior que processar.
  const rawEvent = pick(payload, EVENT_PATHS);
  const event = normalizeEvent(rawEvent);
  if (rawEvent !== undefined && event && event !== 'checkin') {
    await log('not_check_in', `evento recebido: ${String(rawEvent)}`);
    return json({ ok: true, skipped: 'not a check_in event' });
  }

  const emailValue = pick(payload, EMAIL_PATHS);
  const userEmail = typeof emailValue === 'string' ? emailValue.trim() : '';
  if (!userEmail) {
    await log('no_email', 'nenhum campo de e-mail reconhecido — conferir payload no log');
    return json({ error: 'e-mail do atleta ausente no payload' }, 400);
  }

  const timeValue = pick(payload, TIME_PATHS);
  const checkinTime = typeof timeValue === 'string' ? timeValue : new Date().toISOString();
  const date = brDate(typeof timeValue === 'string' ? timeValue : undefined);

  // Case-insensitive: o e-mail no Wellhub pode ter capitalização diferente da
  // cadastrada aqui, e antes isso descartava o check-in em silêncio.
  const { data: matches } = await supabase
    .from('profiles')
    .select('id, name, xp, coins, level')
    .ilike('email', escapeLike(userEmail))
    .limit(1);

  const profile = matches?.[0];
  if (!profile) {
    await log('user_not_found', `e-mail: ${userEmail}`);
    return json({ ok: true, skipped: 'user_not_found', email: userEmail });
  }

  const { data: existing } = await supabase
    .from('checkins')
    .select('id')
    .eq('user_id', profile.id)
    .eq('date', date)
    .maybeSingle();

  if (existing) {
    await log('already_checked_in', `${profile.name} — ${date}`);
    return json({ ok: true, skipped: 'already_checked_in', user: profile.name });
  }

  try {
    await supabase.from('checkins').insert({
      user_id: profile.id,
      date,
      timestamp: checkinTime,
      // Antes ficava nulo, e a view wellhub_checkins_by_class agrupa por turma.
      // Rotular segue a convenção do app, que usa 'SOLO' no check-in solo.
      class_time: 'WELLHUB',
      source: 'wellhub',
    });

    // box_settings.rewards é a fonte principal do app; avatar_economy_settings
    // é só fallback. A versão anterior lia direto o fallback, então podia pagar
    // valores diferentes do resto do sistema.
    const [{ data: boxSettings }, { data: economy }] = await Promise.all([
      supabase.from('box_settings').select('rewards').maybeSingle(),
      supabase.from('avatar_economy_settings')
        .select('xp_per_checkin, coins_per_checkin, level_up_bonus_coins')
        .eq('is_active', true).maybeSingle(),
    ]);

    const r = boxSettings?.rewards ?? {};
    const xpGain       = r.xp_per_checkin       ?? economy?.xp_per_checkin       ?? 20;
    const coinsGain    = r.coins_per_checkin    ?? economy?.coins_per_checkin    ?? 5;
    const levelUpBonus = r.level_up_bonus_coins ?? economy?.level_up_bonus_coins ?? 50;

    const currentLevel = profile.level || 1;
    let newXp    = (profile.xp    || 0) + xpGain;
    let newCoins = (profile.coins || 0) + coinsGain;
    let newLevel = currentLevel;
    let leveledUp = false;

    // Mesma regra do addReward() do app: sobe de nível a cada 100 XP × nível,
    // e o level up paga bônus em moedas — a versão anterior não pagava.
    if (newXp >= currentLevel * 100) {
      newLevel += 1;
      leveledUp = true;
      newCoins += levelUpBonus;
      await supabase.from('reward_history').insert({
        user_id: profile.id,
        type: 'level_up',
        xp: 0,
        coins: levelUpBonus,
        description: `Level up! Nível ${newLevel} — bônus de ${levelUpBonus} BrazaCoins`,
      });
    }

    await supabase.from('profiles').update({
      xp: newXp, coins: newCoins, level: newLevel,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id);

    await supabase.from('reward_history').insert({
      user_id: profile.id,
      type: 'checkin',
      xp: xpGain,
      coins: coinsGain,
      description: 'Check-in via Wellhub',
    });

    await supabase.from('notifications').insert({
      user_id: profile.id,
      type: 'wellhub_checkin',
      title: '💪 Check-in Wellhub confirmado!',
      body: `+${xpGain} XP e +${coinsGain} moedas adicionados${leveledUp ? ` • Nível ${newLevel}! 🎉` : ''}`,
      data: { source: 'wellhub', xp: xpGain, coins: coinsGain },
    });

    const { data: staff } = await supabase
      .from('profiles').select('id').in('role', ['coach', 'admin']);

    if (staff?.length) {
      await supabase.from('notifications').insert(
        staff.map((s: { id: string }) => ({
          user_id: s.id,
          type: 'wellhub_checkin_coach',
          title: '🏋️ Check-in Wellhub',
          body: `${profile.name} acabou de fazer check-in pelo Wellhub`,
          data: { athlete_id: profile.id, athlete_name: profile.name, source: 'wellhub' },
        })),
      );
    }

    await log('ok', `${profile.name} — +${xpGain} XP, +${coinsGain} moedas${leveledUp ? `, nível ${newLevel}` : ''}`);
    return json({ ok: true, user: profile.name, xp: xpGain, coins: coinsGain, leveledUp });

  } catch (err) {
    await log('error', String(err));
    return json({ error: String(err) }, 500);
  }
});
