export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    try {
      const data = await request.json();

      // Cloudflare Analytics Engine can store blobs (strings) and doubles (numbers).
      // We store the JSON representation in the blob so it's easy to query with SQL.
      
      const payload = {
        action: data.action || 'ping',
        bossId: data.bossId || 'unknown',
        totalPulls: data.totalPulls || 0,
        mechanicId: data.mechanicId || '',
        mistakeCount: data.mistakeCount || 0,
      };

      env.TELEMETRY_DATA.writeDataPoint({
        blobs: [
          payload.action,
          payload.bossId,
          payload.mechanicId
        ],
        doubles: [
          payload.totalPulls,
          payload.mistakeCount
        ],
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
