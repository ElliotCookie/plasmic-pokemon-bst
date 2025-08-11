// pages/api/proxyMultiply.ts
import type { NextApiRequest, NextApiResponse } from "next";

const PY_BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://elliotcookie.pythonanywhere.com";

type Out = { result?: number; error?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Out>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send({ error: "Method not allowed" });
  }

  try {
    // Ensure we have JSON body with a numeric `value`
    const { value } = req.body ?? {};
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return res.status(400).json({ error: "Invalid 'value' in request body" });
    }

    // Proxy request to PythonAnywhere backend
    const paRes = await fetch(`${PY_BACKEND}/multiply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: numeric }),
    });

    const contentType = paRes.headers.get("content-type") ?? "";
    if (!paRes.ok) {
      // Try parse error body if JSON; otherwise return text
      if (contentType.includes("application/json")) {
        const errJson = await paRes.json().catch(() => ({}));
        return res.status(paRes.status).json({ error: errJson.error || "Backend error" });
      } else {
        const txt = await paRes.text().catch(() => "Backend error");
        return res.status(paRes.status).json({ error: txt });
      }
    }

    // parse JSON result
    if (contentType.includes("application/json")) {
      const data = await paRes.json().catch(() => ({}));
      return res.status(200).json({ result: data.result });
    } else {
      // Unexpected non-JSON response
      const txt = await paRes.text().catch(() => "");
      return res.status(502).json({ error: "Backend returned non-JSON: " + txt });
    }
  } catch (err: unknown) {
    console.error("proxyMultiply error:", err);
    return res.status(500).json({ error: String(err ?? "unknown error") });
  }
}
