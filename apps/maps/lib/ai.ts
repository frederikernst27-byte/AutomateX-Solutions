const SYSTEM_PROMPT = `Du bist ein präziser Email-Parser für einen deutschen Handwerksbetrieb.
Analysiere die Email und entscheide, was sie für die Tourenplanung bedeutet.

Gib NUR valides JSON zurück, ohne Markdown-Codefences, mit folgendem Schema:
{
  "intent": "new_appointment" | "cancellation" | "reschedule" | "urgent_request" | "other",
  "confidence": 0.0 bis 1.0,
  "customer_name": string oder null,
  "address": string oder null (vollständige deutsche Adresse mit PLZ wenn möglich),
  "date": "YYYY-MM-DD" oder null (relativ wie "heute"/"morgen" → in absolutes Datum umrechnen, heute ist {{TODAY}}),
  "time_from": "HH:MM" oder null,
  "time_to": "HH:MM" oder null,
  "priority": 0 (normal), 1 (hoch), 2 (dringend),
  "notes": string oder null (kurze Zusammenfassung des Anliegens),
  "reasoning": string (1 Satz: warum diese Klassifikation)
}

Wenn keine konkrete Stop-Information enthalten ist, gib intent="other" mit confidence < 0.3 zurück.`;

export interface EmailParseResult {
  intent: "new_appointment" | "cancellation" | "reschedule" | "urgent_request" | "other";
  confidence: number;
  customer_name: string | null;
  address: string | null;
  date: string | null;
  time_from: string | null;
  time_to: string | null;
  priority: number;
  notes: string | null;
  reasoning: string;
}

export async function parseEmailWithAI(subject: string, from: string, body: string): Promise<EmailParseResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("OPENROUTER_API_KEY not set – using heuristic fallback");
    return heuristicParse(subject, from, body);
  }
  try {
    const today = new Date().toISOString().split("T")[0];
    const sys = SYSTEM_PROMPT.replace("{{TODAY}}", today);

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://maps.automate-x-solutions.de",
        "X-Title": "AutomateX Maps"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        max_tokens: 800,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Von: ${from}\nBetreff: ${subject}\n\n${body.slice(0, 4000)}` }
        ]
      })
    });

    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean) as EmailParseResult;
  } catch (e) {
    console.error("AI parse failed:", e);
    return heuristicParse(subject, from, body);
  }
}

function heuristicParse(subject: string, from: string, body: string): EmailParseResult {
  const text = `${subject} ${body}`.toLowerCase();
  let intent: EmailParseResult["intent"] = "other";
  let confidence = 0.4;
  if (/absage|stornier|cancel|fällt aus|kann nicht/i.test(text)) { intent = "cancellation"; confidence = 0.7; }
  else if (/dringend|sofort|notfall|eilig|asap/i.test(text)) { intent = "urgent_request"; confidence = 0.7; }
  else if (/termin|appointment|besuch|reparatur|wartung/i.test(text)) { intent = "new_appointment"; confidence = 0.55; }

  const addressMatch = body.match(/\b\d{5}\s+[A-Za-zÄÖÜäöüß\s-]+/);
  return {
    intent, confidence,
    customer_name: from.split("<")[0].trim().replace(/"/g, "") || null,
    address: addressMatch?.[0]?.trim() ?? null,
    date: null, time_from: null, time_to: null, priority: intent === "urgent_request" ? 2 : 0,
    notes: subject.slice(0, 100),
    reasoning: "Heuristic fallback (kein KI-Key konfiguriert)"
  };
}
