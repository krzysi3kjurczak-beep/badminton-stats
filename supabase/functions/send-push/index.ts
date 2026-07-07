import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

function collectSubsFromLeague(payload: Record<string, unknown>, playerIds: number[]) {
  const map = (payload?.pushSubscriptions || {}) as Record<string, { subscription?: { endpoint?: string }; endpoint?: string }>;
  const subs: { endpoint: string; keys?: { p256dh: string; auth: string } }[] = [];
  const seen = new Set<string>();
  for (const rawId of playerIds) {
    const entry = map[String(rawId)] || map[rawId as unknown as string];
    const sub = entry?.subscription || entry;
    if (sub?.endpoint && !seen.has(sub.endpoint)) {
      seen.add(sub.endpoint);
      subs.push(sub as { endpoint: string; keys?: { p256dh: string; auth: string } });
    }
  }
  return subs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: "VAPID not configured", sent: 0 }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { subscriptions, playerIds, leagueId = "default", title, body, data } = await req.json();
    let subs = Array.isArray(subscriptions)
      ? subscriptions.filter((s: { endpoint?: string }) => s?.endpoint)
      : [];

    if (Array.isArray(playerIds) && playerIds.length) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const { data: row, error } = await sb
        .from("league_state")
        .select("payload")
        .eq("league_id", leagueId)
        .maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: error.message, sent: 0 }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const fromLeague = collectSubsFromLeague(row?.payload || {}, playerIds);
      const seen = new Set(subs.map((s: { endpoint: string }) => s.endpoint));
      for (const s of fromLeague) {
        if (!seen.has(s.endpoint)) {
          seen.add(s.endpoint);
          subs.push(s);
        }
      }
    }

    if (!subs.length) {
      return new Response(JSON.stringify({ sent: 0, error: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: title || "Badminton App",
      body: body || "",
      data: data || {},
      tag: data?.tag || undefined,
    });

    let sent = 0;
    const errors: string[] = [];
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, payload);
          sent += 1;
        } catch (e) {
          errors.push(String(e));
        }
      }),
    );

    return new Response(JSON.stringify({ sent, errors: errors.length ? errors : undefined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), sent: 0 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
