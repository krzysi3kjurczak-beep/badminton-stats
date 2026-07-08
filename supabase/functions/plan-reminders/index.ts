import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const appUrl = Deno.env.get("APP_PUBLIC_URL") ?? "https://krzysi3kjurczak-beep.github.io/badminton-stats/";

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

function isValidSub(sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }) {
  return !!(sub?.endpoint && sub.keys?.p256dh && sub.keys?.auth);
}

function collectSubs(map: Record<string, unknown>, playerIds: number[]) {
  const subs: PushSub[] = [];
  const seen = new Set<string>();
  for (const rawId of playerIds) {
    const entry = map[String(rawId)] as { subscription?: PushSub } | PushSub | undefined;
    const sub = (entry as { subscription?: PushSub })?.subscription || (entry as PushSub);
    if (isValidSub(sub) && !seen.has(sub.endpoint)) {
      seen.add(sub.endpoint);
      subs.push(sub);
    }
  }
  return subs;
}

function nextNotifId(notifs: { id?: number }[]) {
  return notifs.reduce((max, n) => Math.max(max, n.id || 0), 0) + 1;
}

function formatPlanWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pl-PL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function reminderCopy(type: string, when: string, venue: string) {
  const suffix = venue ? ` · ${venue}` : "";
  if (type === "plan_reminder_24h") {
    return { title: "Przypomnienie o grze", body: `Za 24 godziny: ${when}${suffix}` };
  }
  return { title: "Przypomnienie o grze", body: `Za 2 godziny: ${when}${suffix}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: "VAPID not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const leagueId = "default";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: row, error } = await sb
      .from("league_state")
      .select("payload")
      .eq("league_id", leagueId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const payload = (row?.payload || {}) as Record<string, unknown>;
    const plannedSessions = (Array.isArray(payload.plannedSessions) ? payload.plannedSessions : []) as Record<string, unknown>[];
    const planNotifications = (Array.isArray(payload.planNotifications) ? payload.planNotifications : []) as Record<string, unknown>[];
    const pushSubscriptions = (payload.pushSubscriptions || {}) as Record<string, unknown>;
    const players = (Array.isArray(payload.players) ? payload.players : []) as { id: number; isGuest?: boolean }[];

    const guestIds = new Set(players.filter((p) => p.isGuest).map((p) => p.id));
    const now = Date.now();
    let changed = false;
    const newNotifs: Record<string, unknown>[] = [];
    const pushes: { playerIds: number[]; title: string; body: string; data: Record<string, unknown> }[] = [];

    const getSlotIds = (slot: Record<string, unknown>) => {
      const ids: number[] = [];
      for (const side of ["teamA", "teamB"]) {
        const team = slot[side];
        if (Array.isArray(team)) team.forEach((id) => { if (id != null) ids.push(Number(id)); });
      }
      return ids;
    };

    for (const session of plannedSessions) {
      const status = String(session.status || "");
      if (status !== "open" && status !== "started") continue;
      const at = Date.parse(String(session.scheduledAt || ""));
      if (!at || at < now) continue;

      const participantIds = new Set<number>();
      const pool = session.pool;
      if (Array.isArray(pool)) pool.forEach((id) => { if (id != null) participantIds.add(Number(id)); });
      const slots = session.slots;
      if (Array.isArray(slots)) slots.forEach((slot) => getSlotIds(slot as Record<string, unknown>).forEach((id) => participantIds.add(id)));

      const notifiable = [...participantIds].filter((id) => !guestIds.has(id));
      if (!notifiable.length) continue;

      const reminderSent = (session.reminderSent || { "24h": [], "2h": [] }) as Record<string, number[]>;
      session.reminderSent = reminderSent;

      const when = formatPlanWhen(String(session.scheduledAt || ""));
      const venue = String(session.placeId || "");
      const token = String(session.token || "");
      const sessionId = Number(session.id);

      const windows = [
        { key: "24h", type: "plan_reminder_24h", ms: 24 * 60 * 60 * 1000, tolerance: 30 * 60 * 1000 },
        { key: "2h", type: "plan_reminder_2h", ms: 2 * 60 * 60 * 1000, tolerance: 15 * 60 * 1000 },
      ];

      for (const w of windows) {
        const delta = at - now;
        if (delta > w.ms + w.tolerance || delta < w.ms - w.tolerance) continue;
        const sentList = reminderSent[w.key] || [];
        const pending = notifiable.filter((pid) => !sentList.includes(pid));
        if (!pending.length) continue;

        for (const pid of pending) {
          sentList.push(pid);
          const notifId = nextNotifId([...planNotifications, ...newNotifs]);
          const notif = {
            id: notifId,
            type: w.type,
            playerId: pid,
            sessionId,
            token,
            fromPlayerId: session.createdByPlayerId ?? null,
            dedupeKey: `plan-${w.key}-${sessionId}-${pid}`,
            createdAt: now,
          };
          newNotifs.push(notif);
          const copy = reminderCopy(w.type, when, venue);
          pushes.push({
            playerIds: [pid],
            title: copy.title,
            body: copy.body,
            data: {
              kind: "plan",
              planToken: token,
              notifId,
              notifType: w.type,
              tag: `league-notif-${notifId}`,
              url: `${appUrl}?plan=${encodeURIComponent(token)}`,
            },
          });
        }
        reminderSent[w.key] = sentList;
        changed = true;
      }
    }

    if (!changed) {
      return new Response(JSON.stringify({ sent: 0, reminders: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mergedNotifs = [...planNotifications, ...newNotifs].slice(-200);
    const nextPayload = { ...payload, planNotifications: mergedNotifs, plannedSessions };
    const { error: upErr } = await sb.from("league_state").upsert({
      league_id: leagueId,
      payload: nextPayload,
      updated_at: new Date().toISOString(),
    });
    if (upErr) throw new Error(upErr.message);

    let sent = 0;
    for (const push of pushes) {
      const subs = collectSubs(pushSubscriptions, push.playerIds);
      const body = JSON.stringify({ title: push.title, body: push.body, data: push.data });
      await Promise.all(subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, body);
          sent += 1;
        } catch (_) {}
      }));
    }

    return new Response(JSON.stringify({ sent, reminders: newNotifs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
