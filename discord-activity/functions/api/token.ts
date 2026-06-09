type Env = {
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  VITE_DISCORD_CLIENT_ID?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json<{ code?: string }>().catch(() => ({}));

    if (!body.code || typeof body.code !== "string") {
      return json({ error: "Missing OAuth code" }, 400);
    }

    const clientId =
      env.DISCORD_CLIENT_ID ||
      env.VITE_DISCORD_CLIENT_ID ||
      "1499896817138012271";

    const clientSecret = env.DISCORD_CLIENT_SECRET;

    if (!clientSecret) {
      return json(
        {
          error: "Missing DISCORD_CLIENT_SECRET",
          error_description: "Set DISCORD_CLIENT_SECRET as a Cloudflare Pages secret."
        },
        500
      );
    }

    const discordResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: body.code
      })
    });

    const tokenJson = await discordResponse.json().catch(() => null);

    if (!discordResponse.ok) {
      return json(
        {
          error: tokenJson?.error || "discord_token_exchange_failed",
          error_description:
            tokenJson?.error_description ||
            `Discord token endpoint returned ${discordResponse.status}`
        },
        discordResponse.status
      );
    }

    if (!tokenJson?.access_token) {
      return json({ error: "Discord response did not include access_token" }, 502);
    }

    return json({
      access_token: tokenJson.access_token
    });
  } catch (error) {
    return json(
      {
        error: "token_function_failed",
        error_description: error instanceof Error ? error.message : "Unknown token function error"
      },
      500
    );
  }
};

export const onRequest: PagesFunction<Env> = async () => {
  return json({ error: "Method not allowed" }, 405);
};
