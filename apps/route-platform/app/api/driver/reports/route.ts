import { NextResponse } from "next/server";
import { z } from "zod";
import { serverDemoState } from "@/lib/server-demo";
import { requireAuth } from "@/lib/auth";

function magicBytesMatch(mimeType: string, dataUrl: string) {
  try {
    const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bytes = Buffer.from(encoded, "base64").subarray(0, 32);
    const ascii = bytes.toString("ascii");
    const hex = bytes.toString("hex");
    switch (mimeType.toLowerCase()) {
      case "image/png": return hex.startsWith("89504e470d0a1a0a");
      case "image/jpeg": return hex.startsWith("ffd8ff");
      case "image/webp": return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
      case "image/heic":
      case "image/heif": return ascii.slice(4, 8) === "ftyp" && /hei[cf]|mif1/.test(ascii.slice(8, 16));
      case "audio/webm": return hex.startsWith("1a45dfa3");
      case "audio/mpeg": return ascii.startsWith("ID3") || /^ff(f[0-9a-f]|e[0-9a-f])/.test(hex);
      case "audio/mp4":
      case "audio/x-m4a": return ascii.slice(4, 8) === "ftyp";
      case "audio/aac": return hex.startsWith("fff1") || hex.startsWith("fff9");
      case "audio/ogg": return ascii.startsWith("OggS");
      case "audio/wav":
      case "audio/x-wav": return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE";
      default: return false;
    }
  } catch {
    return false;
  }
}

const attachmentSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(["photo", "audio", "signature"]),
  name: z.string().min(1).max(180),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().nonnegative().max(5_000_000),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  dataUrl: z.string().max(1_100_000).optional(),
}).superRefine((attachment, context) => {
  const allowed = attachment.kind === "photo"
    ? new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])
    : attachment.kind === "signature"
      ? new Set(["image/png"])
      : new Set(["audio/webm", "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav", "audio/x-m4a"]);
  if (!allowed.has(attachment.mimeType.toLowerCase())) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["mimeType"], message: "Dateityp ist für diese Anlage nicht erlaubt" });
  }
  if (attachment.dataUrl && !attachment.dataUrl.startsWith(`data:${attachment.mimeType};base64,`)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dataUrl"], message: "Dateiinhalt passt nicht zum angegebenen MIME-Typ" });
  } else if (attachment.dataUrl && !magicBytesMatch(attachment.mimeType, attachment.dataUrl)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dataUrl"], message: "Dateisignatur ist ungültig" });
  }
});

const reportSchema = z.object({
  id: z.string().min(1).max(120),
  workOrderId: z.string().min(1).max(120),
  summary: z.string().trim().min(1).max(4_000),
  findings: z.array(z.string().trim().min(1).max(1_000)).max(30),
  followUp: z.string().trim().max(2_000).optional(),
  urgency: z.enum(["normal", "hoch", "sofort"]),
  confirmed: z.literal(true),
  createdAt: z.string().datetime().optional(),
  attachments: z.array(attachmentSchema).max(12).optional(),
});

/** Receives only a human-confirmed report. Drafts never reach the API. */
export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin", "driver"] });
  if (!auth.ok) return auth.response;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 15 * 1024 * 1024) return NextResponse.json({ error: "Bericht ist auf 15 MB begrenzt" }, { status: 413 });
    const parsed = reportSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Ungültiger oder nicht bestätigter Bericht", details: parsed.error.flatten() }, { status: 400 });
    const report = parsed.data;
    const workOrder = serverDemoState.workOrders.find((item) => item.id === report.workOrderId);
    if (!workOrder) return NextResponse.json({ error: "Arbeitsauftrag nicht gefunden" }, { status: 404 });
    if (auth.context.role === "driver") {
      const ownsOrder = serverDemoState.routes.some((route) => route.driverId === auth.context.driverId && !["draft", "cancelled"].includes(route.status) && route.stops.some((stop) => stop.workOrderId === workOrder.id));
      if (!ownsOrder) return NextResponse.json({ error: "Bericht darf nur für eigene Touren erstellt werden", code: "DRIVER_SCOPE" }, { status: 403 });
    }
    const existing = serverDemoState.reports.find((item) => item.id === report.id);
    if (existing) return NextResponse.json({ accepted: true, report: existing, replay: true });
    const persisted = { ...report, createdAt: report.createdAt ?? new Date().toISOString(), attachments: report.attachments?.map((attachment) => ({ ...attachment, createdAt: attachment.createdAt ?? new Date().toISOString() })) };
    serverDemoState.reports.unshift(persisted);
    if (workOrder.status !== "cancelled") workOrder.status = "completed";
    return NextResponse.json({ accepted: true, report: persisted }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bericht konnte nicht gespeichert werden" }, { status: 400 });
  }
}
