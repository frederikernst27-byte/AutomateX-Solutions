import Anthropic from "@anthropic-ai/sdk";

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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY not set – using heuristic fallback");
    return heuristicParse(subject, from, body);
  }
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const today = new Date().toISOString().split("T")[0];
    const sys = SYSTEM_PROMPT.replace("{{TODAY}}", today);

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: sys,
      messages: [{
        role: "user",
        content: `Von: ${from}\nBetreff: ${subject}\n\n${body.slice(0, 4000)}`
      }]
    });
    const text = msg.content.filter(b => b.type === "text").map(b => (b as { text: string }).text).join("");
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
