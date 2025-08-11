// pages/api/proxyMultiply.ts
import type { NextApiRequest, NextApiResponse } from "next";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://elliotcookie.pythonanywhere.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Forward JSON body to your PA multiply endpoint
    const body = req.body ?? {};
    // Optional: sanitize/validate here
    const resp = await fetch(`${BACKEND}/multiply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const contentType = resp.headers.get("content-type") ?? "";
    if (!resp.ok) {
      // forward status and body
      let payload: any;
      try { payload = await resp.json(); } catch (e) { payload = { error: await resp.text() }; }
      return res.status(resp.status).json(payload);
    }

    if (contentType.includes("application/json")) {
      const json = await resp.json();
      return res.status(200).json(json);
    } else {
      const text = await resp.text();
      return res.status(200).send(text);
    }
  } catch (err: any) {
    console.error("proxyMultiply error:", err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
