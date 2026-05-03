const MODEL = "openrouter/free";

function fallbackPlan(email) {
  const lower = String(email || "").toLowerCase();
  const cancelledStop = lower.includes("bottrop") ? "Bottrop Zentrallager" : "der abgesagte Termin";
  const urgentStop = lower.includes("bochum") ? "Bochum Eilauftrag" : "der naechste priorisierte Auftrag";

  return {
    aiMode: false,
    steps: [
      {
        title: "Absage erkannt",
        text: `${cancelledStop} wird aus der laufenden Tour entfernt.`
      },
      {
        title: "Zeitfenster freigegeben",
        text: "Das frei gewordene Zeitfenster wird mit Restfahrzeiten und Servicezeiten abgeglichen."
      },
      {
        title: "Route neu vorgeschlagen",
        text: `${urgentStop} wird vorgezogen, danach werden Duisburg und Essen nach Distanz sortiert.`
      }
    ],
    summary:
      `AutomateX wuerde ${cancelledStop} streichen, die frei gewordene Zeit vor Mittag nutzen und ${urgentStop} nach vorne ziehen. ` +
      "Die Resttour bleibt nachvollziehbar: erst der priorisierte Auftrag, danach die naechsten Stopps mit kurzen Anschlusswegen."
  };
}

function fallbackResponse(email, fallbackMode, modeLabel) {
  return {
    ...fallbackPlan(email),
    fallbackMode,
    modeLabel
  };
}

function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/```\s*([\s\S]*?)\s*```/i);
  const candidates = [];

  if (fenced?.[1]) candidates.push(fenced[1].trim());
  candidates.push(text);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch {}
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String(req.body?.email || "").slice(0, 5000);
  if (!email.trim()) {
    return res.status(400).json({ error: "Bitte eine Beispiel-E-Mail eingeben." });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(200).json(fallbackResponse(
      email,
      "missing-key",
      "Lokaler Demo-Modus: OPENROUTER_API_KEY ist nicht gesetzt."
    ));
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://automatex.vercel.app",
        "X-Title": "AutomateX Routing Demo"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 420,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Du bist die KI-Routenplanung von AutomateX. Analysiere deutsche Dispositions-E-Mails. " +
              "Antworte ausschliesslich als JSON mit Feldern steps und summary. steps ist ein Array aus genau 3 Objekten mit title und text. " +
              "Bleibe konkret, kurz und beschreibe, wie eine Tour nach einer Absage neu geplant wird."
          },
          {
            role: "user",
            content:
              "Aktuelle Route: Essen Nord 09:20, Bottrop Zentrallager 11:30, Duisburg Service 12:40, Bochum Eilauftrag flexibel aber priorisiert. " +
              "E-Mail:\n" + email
          }
        ]
      })
    });

    const responseBody = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(responseBody);
    } catch {}

    if (!response.ok) {
      const isRateLimit = response.status === 429;
      const modeLabel = isRateLimit
        ? "OpenRouter ist aktiv, aber das Free-Rate-Limit ist gerade erreicht. Die Demo zeigt deshalb den lokalen Plan."
        : `OpenRouter war nicht verfuegbar (${response.status}). Die Demo zeigt deshalb den lokalen Plan.`;

      return res.status(200).json({
        ...fallbackResponse(email, isRateLimit ? "rate-limit" : "openrouter-error", modeLabel),
        summary: fallbackPlan(email).summary + `\n\n${modeLabel}`
      });
    }

    const content = payload?.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject(content);
    if (!parsed?.steps || !parsed?.summary) {
      return res.status(200).json({
        ...fallbackResponse(
          email,
          "invalid-json",
          "OpenRouter ist aktiv, aber die Antwort hatte kein gueltiges JSON. Die Demo zeigt deshalb den lokalen Plan."
        ),
        summary: fallbackPlan(email).summary + "\n\nOpenRouter ist aktiv, aber die Antwort hatte kein gueltiges JSON. Die Demo zeigt deshalb den lokalen Plan."
      });
    }

    return res.status(200).json({
      aiMode: true,
      model: MODEL,
      modeLabel: "KI-Modus: OpenRouter aktiv.",
      steps: parsed.steps.slice(0, 3),
      summary: parsed.summary
    });
  } catch (error) {
    return res.status(200).json({
      ...fallbackResponse(
        email,
        "request-error",
        "OpenRouter konnte gerade nicht erreicht werden. Die Demo zeigt deshalb den lokalen Plan."
      ),
      summary: fallbackPlan(email).summary + "\n\nOpenRouter konnte gerade nicht erreicht werden. Die Demo zeigt deshalb den lokalen Plan."
    });
  }
};
