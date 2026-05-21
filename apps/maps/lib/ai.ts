const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const FREE_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string,
  maxTokens = 800
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const allMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://maps.automate-x-solutions.de",
        "X-Title": "AutomateX Maps",
      },
      body: JSON.stringify({ model: FREE_MODEL, max_tokens: maxTokens, messages: allMessages }),
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

// ─── Email parsing ────────────────────────────────────────────────────────────

const EMAIL_PARSE_PROMPT = `Du bist ein präziser Email-Parser für einen deutschen Handwerksbetrieb.
Analysiere die Email und entscheide, was sie für die Tourenplanung bedeutet.

Gib NUR valides JSON zurück, ohne Markdown-Codefences:
{
  "intent": "new_appointment" | "cancellation" | "reschedule" | "urgent_request" | "other",
  "confidence": 0.0 bis 1.0,
  "customer_name": string oder null,
  "address": string oder null,
  "date": "YYYY-MM-DD" oder null (heute ist {{TODAY}}),
  "time_from": "HH:MM" oder null,
  "time_to": "HH:MM" oder null,
  "priority": 0 (normal), 1 (hoch), 2 (dringend),
  "notes": string oder null,
  "reasoning": string
}`;

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

export async function parseEmailWithAI(
  subject: string,
  from: string,
  body: string
): Promise<EmailParseResult | null> {
  const today = new Date().toISOString().split("T")[0];
  const sys = EMAIL_PARSE_PROMPT.replace("{{TODAY}}", today);
  const text = await callOpenRouter(
    [{ role: "user", content: `Von: ${from}\nBetreff: ${subject}\n\n${body.slice(0, 4000)}` }],
    sys
  );
  if (!text) return heuristicParse(subject, from, body);
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean) as EmailParseResult;
  } catch {
    return heuristicParse(subject, from, body);
  }
}

function heuristicParse(subject: string, from: string, body: string): EmailParseResult {
  const text = `${subject} ${body}`.toLowerCase();
  let intent: EmailParseResult["intent"] = "other";
  let confidence = 0.4;
  if (/absage|stornier|cancel|fällt aus|kann nicht/i.test(text)) { intent = "cancellation"; confidence = 0.7; }
  else if (/dringend|sofort|notfall|eilig/i.test(text)) { intent = "urgent_request"; confidence = 0.7; }
  else if (/termin|appointment|besuch|reparatur|wartung/i.test(text)) { intent = "new_appointment"; confidence = 0.55; }
  const addressMatch = body.match(/\b\d{5}\s+[A-Za-zÄÖÜäöüß\s-]+/);
  return {
    intent, confidence,
    customer_name: from.split("<")[0].trim().replace(/"/g, "") || null,
    address: addressMatch?.[0]?.trim() ?? null,
    date: null, time_from: null, time_to: null,
    priority: intent === "urgent_request" ? 2 : 0,
    notes: subject.slice(0, 100),
    reasoning: "Heuristic fallback (kein KI-Key konfiguriert)"
  };
}

// ─── AI Chat Assistant ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface OrgContext {
  orgName?: string;
  todayStops?: Array<{ name: string; address: string; status: string }>;
  pendingCount?: number;
  doneCount?: number;
  insights?: Array<{ title: string; content: string }>;
}

export async function chatWithAI(
  messages: ChatMessage[],
  context: OrgContext
): Promise<string> {
  const stopsText = context.todayStops?.length
    ? context.todayStops.map(s => `- ${s.name} (${s.address}) [${s.status}]`).join("\n")
    : "Keine Stops heute";

  const insightsText = context.insights?.length
    ? context.insights.map(i => `- ${i.title}: ${i.content}`).join("\n")
    : "Noch keine Erkenntnisse";

  const systemPrompt = `Du bist der KI-Assistent von AutomateX Maps, einem intelligenten Routenplanungssystem für Handwerksbetriebe.

Aktuelle Situation heute (${new Date().toLocaleDateString("de-DE")}):
- Stops gesamt: ${context.todayStops?.length ?? 0}, Ausstehend: ${context.pendingCount ?? 0}, Erledigt: ${context.doneCount ?? 0}

Heutige Stops:
${stopsText}

Gelernte Erkenntnisse aus vergangenen Touren:
${insightsText}

Antworte präzise auf Deutsch. Hilf bei Routenplanung, Stop-Management und Optimierung.`;

  const result = await callOpenRouter(messages, systemPrompt, 600);
  return result ?? "Ich bin gerade nicht verfügbar. Bitte versuche es später.";
}

// ─── AI Learning / Insights ───────────────────────────────────────────────────

export interface FeedbackEntry {
  issue_type: string;
  notes: string | null;
  date: string;
  stop?: { name: string; address: string } | null;
}

export async function generateInsightsFromFeedback(
  feedback: FeedbackEntry[],
  existingInsights: string[]
): Promise<Array<{ insight_type: string; title: string; content: string; confidence: number }>> {
  if (!feedback.length) return [];

  const feedbackText = feedback
    .map(f => `- ${f.date}: ${f.issue_type}${f.notes ? ` – ${f.notes}` : ""}${f.stop ? ` (${f.stop.name}, ${f.stop.address})` : ""}`)
    .join("\n");

  const prompt = `Analysiere dieses Fahrer-Feedback und generiere Erkenntnisse für bessere Routenplanung.

Feedback (${feedback.length} Einträge):
${feedbackText}

Bestehende Erkenntnisse (nicht wiederholen):
${existingInsights.join("\n") || "keine"}

Gib NUR valides JSON-Array zurück (max. 3 neue Erkenntnisse):
[{"insight_type":"time_pattern"|"problem_area"|"optimization_tip"|"customer_pattern","title":"...","content":"...","confidence":0.0-1.0}]
Wenn keine neuen Erkenntnisse, gib [] zurück.`;

  const text = await callOpenRouter([{ role: "user", content: prompt }], undefined, 600);
  if (!text) return [];
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean);
  } catch { return []; }
}

// ─── Email suggestions ────────────────────────────────────────────────────────

export interface RouteStop {
  name: string;
  address: string;
}

export async function generateEmailSuggestions(
  routeStops: RouteStop[],
  orgName: string
): Promise<Array<{ recipient_name: string; recipient_address: string; subject: string; body: string; reason: string }>> {
  if (!routeStops.length) return [];

  const stopsText = routeStops.map(s => `- ${s.name}, ${s.address}`).join("\n");

  const prompt = `Du hilfst dem Handwerksbetrieb "${orgName}" potenzielle Neukunden auf ihrer Route anzuschreiben.

Heutige Route:
${stopsText}

Generiere 2 Vorschläge für Akquise-Emails an potenzielle Kunden in dieser Region.

Gib NUR valides JSON-Array zurück:
[{"recipient_name":"...","recipient_address":"...","subject":"...","body":"...","reason":"..."}]`;

  const text = await callOpenRouter([{ role: "user", content: prompt }], undefined, 800);
  if (!text) return [];
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean);
  } catch { return []; }
}

// ─── Driver notifications ─────────────────────────────────────────────────────

export async function generateRouteChangeMessage(
  changeType: "stop_added" | "stop_cancelled" | "route_changed",
  stopName: string,
  address: string,
  routeLength: number
): Promise<string> {
  const prompts: Record<string, string> = {
    stop_added: `Neuer Stop zur Route hinzugefügt: "${stopName}" in ${address}. Schreibe 1 kurze Fahrer-Benachrichtigung auf Deutsch.`,
    stop_cancelled: `Stop "${stopName}" entfernt. Route hat noch ${routeLength} Stops. Schreibe 1 kurze Fahrer-Info auf Deutsch.`,
    route_changed: `Route geändert (${routeLength} aktive Stops). Schreibe 1 kurze Fahrer-Info auf Deutsch.`,
  };
  const text = await callOpenRouter([{ role: "user", content: prompts[changeType] }], undefined, 80);
  return text?.trim() ?? `Route aktualisiert: ${stopName}`;
}
