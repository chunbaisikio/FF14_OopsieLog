interface Env {
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const payload: any = await request.json();
      
      // Basic validation
      if (!payload || !payload.action) {
        return new Response("Bad Request", { status: 400, headers: corsHeaders });
      }

      // Insert into D1
      await env.DB.prepare(
        "INSERT INTO telemetry_events (action, boss_id, mechanic_id, total_pulls, mistake_count) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          payload.action,
          payload.bossId || 'unknown',
          payload.mechanicId || '',
          payload.totalPulls || 0,
          payload.mistakeCount || 0
        )
        .run();

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (error) {
      console.error(error);
      return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
    }
  },
};
