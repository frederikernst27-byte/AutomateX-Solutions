"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, ArrowUpRight, Building2, CalendarClock, Check, Filter, Loader2, Plus, Search, ShieldCheck, Upload, Wrench } from "lucide-react";
import Link from "next/link";
import { AdminContent, TopBar } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDemoStore } from "@/lib/demo-store";
import { addDays, currentBusinessDate, formatDate } from "@/lib/utils";
import type { Customer, WorkOrder } from "@/lib/types";

const SPECIALITIES = ["Heizung", "Klima", "Lüftung", "Sanitär", "Elektro", "Solar / PV", "Smart Home", "Wartung"];

export default function CustomersPage() {
  const { state, hydrate, notify } = useDemoStore();
  const [query, setQuery] = useState("");
  const [speciality, setSpeciality] = useState("Alle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");
  useEffect(() => { let active = true; void fetch("/api/customers", { credentials: "same-origin", cache: "no-store" }).then(async (response) => { if (!response.ok) return; const body = await response.json() as { customers?: Customer[] }; if (active && body.customers) hydrate({ customers: body.customers }); }).catch(() => undefined); return () => { active = false; }; }, []); // Load persistent customer records once.
  const today = currentBusinessDate();
  const activeCustomers = state.customers.filter((customer) => !customer.archivedAt);
  const archivedCustomers = state.customers.filter((customer) => customer.archivedAt);
  const shownCustomers = view === "active" ? activeCustomers : archivedCustomers;
  const specialities = ["Alle", ...Array.from(new Set(shownCustomers.map((customer) => customer.speciality)))];
  const filtered = useMemo(() => shownCustomers.filter((customer) => `${customer.name} ${customer.address} ${customer.asset}`.toLowerCase().includes(query.toLowerCase()) && (speciality === "Alle" || customer.speciality === speciality)), [shownCustomers, query, speciality]);
  const selected = state.customers.find((customer) => customer.id === selectedId);
  const dueSoon = activeCustomers.filter((customer) => customer.nextDue >= today && customer.nextDue <= addDays(today, 30)).length;

  async function createCustomer(input: { name: string; contact: string; address: string; speciality: string; asset: string; email: string; phone: string; nextDue: string }) {
    const response = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ ...input, site: "Hauptstandort", intervalMonths: 12, sla: "Standard" }) });
    const body = await response.json() as { customer?: Customer; error?: string };
    if (!response.ok || !body.customer) throw new Error(body.error || "Der Kunde konnte nicht gespeichert werden.");
    const customer = body.customer;
    hydrate({ customers: [customer, ...state.customers] });
    setCreating(false);
    notify("Kunde angelegt", `${customer.name} wurde gespeichert und verortet.`, "success");
  }

  async function setArchived(customer: Customer, archived: boolean) {
    try {
      const response = await fetch("/api/customers", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: customer.id, archived }) });
      const body = await response.json().catch(() => ({})) as { customer?: Customer; error?: string };
      if (!response.ok || !body.customer) throw new Error(body.error || "Der Archivstatus konnte nicht gespeichert werden.");
      hydrate({ customers: state.customers.map((item) => item.id === customer.id ? body.customer! : item) });
      setSelectedId(null);
      notify(archived ? "Kunde archiviert" : "Kunde wiederhergestellt", archived ? `${customer.name} ist nun im Archiv.` : `${customer.name} erscheint wieder im aktiven Bestand.`, "success");
    } catch (error) {
      notify("Archiv nicht geändert", error instanceof Error ? error.message : "Bitte erneut versuchen.", "warning");
    }
  }

  return <><TopBar eyebrow="Stammdaten" title="Kunden & Anlagen" description={`${activeCustomers.length} aktive Standorte · ${archivedCustomers.length} im Archiv.`} actions={<><Button variant="outline" asChild><Link href="/admin/import"><Upload className="h-4 w-4" />Importieren</Link></Button><Button variant="outline" onClick={() => setCreatingOrder(true)} disabled={activeCustomers.length === 0}><Plus className="h-4 w-4" />Auftrag anlegen</Button><Button onClick={() => setCreating(true)}><Building2 className="h-4 w-4" />Kunde anlegen</Button></>} /><AdminContent><div className="mb-5 grid gap-3 sm:grid-cols-3"><MiniStat label="Standorte aktiv" value={String(activeCustomers.length)} detail="Im Bestand" icon={Building2} /><MiniStat label="Fällig in 30 Tagen" value={String(dueSoon)} detail="Wartung planen" icon={CalendarClock} /><MiniStat label="Im Archiv" value={String(archivedCustomers.length)} detail="Ausgeblendet" icon={Archive} /></div><Card><CardContent className="p-0"><div className="flex flex-wrap items-center gap-3 border-b border-line p-4"><div className="flex rounded-xl border border-line bg-soft p-1 text-xs font-extrabold"><button onClick={() => setView("active")} className={`rounded-lg px-3 py-2 ${view === "active" ? "bg-white text-ink shadow-sm" : "text-muted"}`}>Aktiv ({activeCustomers.length})</button><button onClick={() => setView("archived")} className={`rounded-lg px-3 py-2 ${view === "archived" ? "bg-white text-ink shadow-sm" : "text-muted"}`}>Archiv ({archivedCustomers.length})</button></div><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kunde, Adresse oder Anlage suchen…" className="pl-9" /></div><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slate-400" /><select value={speciality} onChange={(event) => setSpeciality(event.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-brand-500">{specialities.map((item) => <option key={item}>{item}</option>)}</select></div><span className="text-xs font-bold text-muted">{filtered.length} Treffer</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-line bg-soft/60 text-[10px] font-black uppercase tracking-[.12em] text-muted"><th className="w-12 px-4 py-3" aria-label="Archiv" /><th className="px-5 py-3">Kunde / Standort</th><th className="px-4 py-3">Anlage</th><th className="px-4 py-3">Nächste Wartung</th><th className="px-4 py-3">Fachgebiet</th><th className="px-4 py-3">SLA</th></tr></thead><tbody>{filtered.map((customer) => <tr key={customer.id} onClick={() => setSelectedId(customer.id)} className="cursor-pointer border-b border-line/80 transition hover:bg-brand-50/40"><td className="px-4 py-4"><button type="button" onClick={(event) => { event.stopPropagation(); void setArchived(customer, view === "active"); }} title={view === "active" ? "Kunde archivieren" : "Kunde wiederherstellen"} className={`grid h-7 w-7 place-items-center rounded-lg border ${view === "active" ? "border-line text-slate-400 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700" : "border-brand-200 bg-brand-50 text-brand-700"}`}>{view === "active" ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}</button></td><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy text-[10px] font-black text-white">{customer.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div className="min-w-0"><p className="truncate text-sm font-extrabold">{customer.name}</p><p className="mt-0.5 truncate text-xs text-muted">{customer.address}</p></div></div></td><td className="px-4 py-4"><p className="text-xs font-bold">{customer.asset}</p><p className="mt-0.5 text-[11px] text-muted">{customer.site}</p></td><td className="px-4 py-4"><p className={`text-xs font-extrabold ${customer.nextDue < today ? "text-rose-600" : "text-ink"}`}>{formatDate(customer.nextDue, { day: "2-digit", month: "short", year: "numeric" })}</p><p className="mt-0.5 text-[11px] text-muted">{customer.nextDue < today ? "Überfällig" : `Intervall ${customer.intervalMonths} Monate`}</p></td><td className="px-4 py-4"><Badge variant="blue">{customer.speciality}</Badge></td><td className="px-4 py-4"><Badge variant={customer.sla === "Standard" ? "muted" : "warning"}>{customer.sla}</Badge></td></tr>)}</tbody></table></div>{filtered.length === 0 && <p className="p-10 text-center text-sm text-muted">{view === "active" ? "Keine aktiven Kunden gefunden." : "Das Archiv ist leer."}</p>}</CardContent></Card>{selected && <CustomerDrawer customer={selected} onClose={() => setSelectedId(null)} onSetArchived={setArchived} orders={state.workOrders.filter((order) => order.customerId === selected.id)} />}{creating && <CreateCustomerModal onClose={() => setCreating(false)} onCreate={createCustomer} />}{creatingOrder && <CreateWorkOrderModal customers={activeCustomers} onClose={() => setCreatingOrder(false)} />}</AdminContent></>;
}

function MiniStat({ icon: Icon, label, value, detail }: { icon: typeof Building2; label: string; value: string; detail: string }) { return <Card><CardContent className="p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-4 w-4" /></span><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-muted">{label}</p><p className="mt-0.5 text-xl font-black">{value}</p></div></div><p className="mt-3 text-[11px] font-bold text-brand-700">{detail}</p></CardContent></Card>; }

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="block"><span className="text-[11px] font-extrabold text-muted">{label}</span><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1" /></label>;
}

function CreateCustomerModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: { name: string; contact: string; address: string; speciality: string; asset: string; email: string; phone: string; nextDue: string }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [speciality, setSpeciality] = useState(SPECIALITIES[0]);
  const [asset, setAsset] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const valid = name.trim().length > 1 && address.trim().length > 3 && Boolean(nextDue);
  async function submit() { if (!valid || saving) return; setSaving(true); setError(undefined); try { await onCreate({ name, contact, address, speciality, asset, email, phone, nextDue }); } catch (caught) { setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen"); } finally { setSaving(false); } }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-4" onClick={onClose}><div onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-float"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.14em] text-brand-700">Stammdaten</p><h2 className="mt-1 text-xl font-extrabold tracking-tight">Neuen Kunden anlegen</h2></div><button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400">×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Firmen- / Kundenname *" value={name} onChange={setName} placeholder="z. B. Meyer Haustechnik GmbH" /></div><Field label="Ansprechpartner" value={contact} onChange={setContact} placeholder="Vor- und Nachname" /><Field label="Nächste Wartung *" value={nextDue} onChange={setNextDue} type="date" /><div className="sm:col-span-2"><Field label="Adresse *" value={address} onChange={setAddress} placeholder="Straße Nr., PLZ Ort" /></div><label className="block"><span className="text-[11px] font-extrabold text-muted">Fachgebiet</span><select value={speciality} onChange={(event) => setSpeciality(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-brand-500">{SPECIALITIES.map((item) => <option key={item}>{item}</option>)}</select></label><Field label="Anlage" value={asset} onChange={setAsset} placeholder="z. B. Wärmepumpe W-240" /><Field label="E-Mail" value={email} onChange={setEmail} placeholder="kontakt@…" type="email" /><Field label="Telefon" value={phone} onChange={setPhone} placeholder="+49 …" /></div><div className="mt-3 rounded-xl bg-soft p-3 text-[11px] leading-5 text-muted">Die Adresse wird serverseitig über OpenStreetMap geprüft. Bei einer unklaren Adresse wird nichts gespeichert.</div>{error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}<div className="mt-5 flex gap-2"><Button className="flex-1" onClick={submit} disabled={!valid || saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere…</> : <><Check className="h-4 w-4" />Kunde anlegen</>}</Button><Button variant="outline" onClick={onClose}>Abbrechen</Button></div></div></div>;
}

function CreateWorkOrderModal({ customers, onClose }: { customers: Customer[]; onClose: () => void }) {
  const { addWorkOrder, notify } = useDemoStore();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<WorkOrder["kind"]>("Wartung");
  const [durationMinutes, setDurationMinutes] = useState("90");
  const [priority, setPriority] = useState("2");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [timeFrom, setTimeFrom] = useState("08:00");
  const [timeTo, setTimeTo] = useState("16:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const resolvedTitle = title.trim() || `${kind} ${selectedCustomer?.asset || selectedCustomer?.name || ""}`.trim();

  async function submit() {
    if (!customerId || resolvedTitle.length < 2 || saving) return;
    setSaving(true); setError(undefined);
    try {
      const response = await fetch("/api/work-orders", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ customerId, title: resolvedTitle, kind, timeFrom, timeTo, deadlineDate, durationMinutes: Number(durationMinutes), priority: Number(priority), speciality: selectedCustomer?.speciality || "Wartung", notes: "Manuell angelegt." }) });
      const body = await response.json() as { workOrder?: WorkOrder; error?: string };
      if (!response.ok || !body.workOrder) throw new Error(body.error || "Auftrag konnte nicht gespeichert werden.");
      addWorkOrder(body.workOrder, false);
      notify("Auftrag gespeichert", `„${body.workOrder.title}“ ist jetzt planbar.`, "success");
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-4" onClick={onClose}><div onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-float"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.14em] text-brand-700">Planungsauftrag</p><h2 className="mt-1 text-xl font-extrabold tracking-tight">Auftrag anlegen</h2><p className="mt-1 text-sm text-muted">Wird sofort in der Planung verfügbar.</p></div><button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400">×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="text-[11px] font-extrabold text-muted">Kunde / Standort *</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-brand-500">{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.address}</option>)}</select></label><Field label="Titel (optional)" value={title} onChange={setTitle} placeholder={resolvedTitle || "z. B. Wartung Wärmepumpe"} /><label className="block"><span className="text-[11px] font-extrabold text-muted">Art *</span><select value={kind} onChange={(event) => setKind(event.target.value as WorkOrder["kind"])} className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-brand-500">{["Wartung", "Reparatur", "Notfall", "Inspektion"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="block"><span className="text-[11px] font-extrabold text-muted">Dauer *</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-brand-500"><option value="30">30 Minuten</option><option value="60">1 Stunde</option><option value="90">1,5 Stunden</option><option value="120">2 Stunden</option><option value="180">3 Stunden</option></select></label><label className="block"><span className="text-[11px] font-extrabold text-muted">Priorität *</span><select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-brand-500"><option value="1">Niedrig</option><option value="2">Normal</option><option value="3">Hoch</option><option value="4">Dringend</option></select></label><Field label="Planbar bis (optional)" value={deadlineDate} onChange={setDeadlineDate} type="date" /><div className="rounded-xl bg-soft px-3 py-2 text-[10px] font-bold leading-4 text-muted">Der Auftrag wird in der Optimierung bis zu diesem Datum priorisiert.</div><Field label="Frühestens" value={timeFrom} onChange={setTimeFrom} type="time" /><Field label="Spätestens" value={timeTo} onChange={setTimeTo} type="time" /></div>{error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}<div className="mt-5 flex gap-2"><Button className="flex-1" onClick={() => void submit()} disabled={!customerId || saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere…</> : <><Check className="h-4 w-4" />Auftrag speichern</>}</Button><Button variant="outline" onClick={onClose}>Abbrechen</Button></div></div></div>;
}

function CustomerDrawer({ customer, orders, onClose, onSetArchived }: { customer: Customer; orders: WorkOrder[]; onClose: () => void; onSetArchived: (customer: Customer, archived: boolean) => Promise<void> }) {
  const { addWorkOrder, updateCustomer, notify } = useDemoStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [address, setAddress] = useState(customer.address);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone);
  const [asset, setAsset] = useState(customer.asset);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function addAppointment() {
    try {
      const response = await fetch("/api/work-orders", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ customerId: customer.id, title: `Wartung ${customer.asset || customer.name}`, kind: "Wartung", timeFrom: "08:00", timeTo: "16:00", durationMinutes: customer.intervalMonths ? 90 : 60, priority: 3, speciality: customer.speciality, notes: "Im Kundenprofil angelegt." }) });
      const body = await response.json() as { workOrder?: WorkOrder; error?: string };
      if (!response.ok || !body.workOrder) throw new Error(body.error || "Auftrag konnte nicht angelegt werden.");
      // The order is already persisted by /api/work-orders. Only merge it
      // into the current browser snapshot; do not send it to the legacy
      // demo-state endpoint as well.
      addWorkOrder(body.workOrder, false);
      notify("Termin angelegt", `Ein echter Planungsauftrag für ${customer.name} wurde gespeichert.`, "success");
    } catch (error) { notify("Termin nicht angelegt", error instanceof Error ? error.message : "Bitte erneut versuchen.", "warning"); }
  }

  async function copyPortalLink() {
    const order = orders[0];
    const token = order?.portalToken ?? customer.portalSlug;
    const link = `${window.location.origin}/p/${token}`;
    try { await navigator.clipboard.writeText(link); } catch { /* clipboard may be blocked */ }
    setCopied(true);
    notify("Portal-Link kopiert", link, "info");
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function saveEdit() {
    if (saving) return;
    setSaving(true); setError(undefined);
    try {
      const response = await fetch("/api/customers", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: customer.id, name: name.trim(), email: email.trim(), phone: phone.trim(), asset: asset.trim(), address: address.trim() }) });
      const body = await response.json().catch(() => ({})) as { customer?: Customer; error?: string };
      if (!response.ok || !body.customer) throw new Error(body.error || "Der Kunde konnte nicht gespeichert werden.");
      // Server geocodes and persists; mirror the saved record into the local
      // snapshot so the drawer reflects the stored values immediately.
      updateCustomer(customer.id, body.customer);
      setEditing(false);
      notify("Kunde aktualisiert", `${body.customer.name} wurde gespeichert.`, "success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex justify-end bg-navy/30" onClick={onClose}><aside onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-[440px] overflow-y-auto bg-white p-6 shadow-float"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.14em] text-brand-700">Kundenprofil</p><h2 className="mt-2 text-xl font-extrabold tracking-tight">{customer.name}</h2><p className="mt-1 text-sm text-muted">{customer.address}</p></div><button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400">×</button></div>

    {editing ? <div className="mt-6 space-y-3"><Field label="Name" value={name} onChange={setName} /><Field label="Adresse" value={address} onChange={setAddress} /><Field label="Anlage" value={asset} onChange={setAsset} /><Field label="E-Mail" value={email} onChange={setEmail} type="email" /><Field label="Telefon" value={phone} onChange={setPhone} />{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}<div className="flex gap-2 pt-2"><Button className="flex-1" onClick={() => void saveEdit()} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere…</> : <><Check className="h-4 w-4" />Speichern</>}</Button><Button variant="outline" onClick={() => { setEditing(false); setError(undefined); }} disabled={saving}>Abbrechen</Button></div></div> : <>
    <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-soft p-3"><p className="text-[10px] font-black uppercase text-muted">Anlage</p><p className="mt-1 text-sm font-extrabold">{customer.asset}</p></div><div className="rounded-xl bg-soft p-3"><p className="text-[10px] font-black uppercase text-muted">SLA</p><p className="mt-1 text-sm font-extrabold">{customer.sla}</p></div></div>
    <div className="mt-6"><div className="flex items-center justify-between"><h3 className="text-sm font-extrabold">Terminhistorie</h3><button onClick={() => void addAppointment()} className="text-xs font-extrabold text-brand-700">+ Termin</button></div><div className="mt-3 space-y-2">{orders.length === 0 ? <p className="rounded-xl border border-dashed border-line p-3 text-[11px] text-muted">Noch keine Termine. Lege über „+ Termin“ einen echten Planungsauftrag an.</p> : orders.map((order) => <div key={order.id} className="rounded-xl border border-line p-3"><div className="flex items-center justify-between"><p className="text-xs font-extrabold">{order.title}</p><Badge variant={order.status === "completed" ? "default" : "warning"}>{order.status}</Badge></div><p className="mt-1 text-[11px] text-muted">{order.scheduledDate ?? "Noch offen"} · {order.timeFrom}–{order.timeTo}</p></div>)}</div></div>
    <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-3.5"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-700" /><p className="text-xs leading-5 text-brand-800">Kundenlink aktiv. Der Kunde kann Termin, ETA und Bericht über einen sicheren Link sehen.</p></div><button onClick={copyPortalLink} className="mt-3 flex items-center gap-1 text-xs font-extrabold text-brand-700">{copied ? <>Kopiert <Check className="h-3.5 w-3.5" /></> : <>Portal-Link kopieren <ArrowUpRight className="h-3.5 w-3.5" /></>}</button></div>
    <div className="mt-8 flex flex-wrap gap-2"><Button className="flex-1" onClick={() => setEditing(true)}>Bearbeiten</Button><Button variant="outline" onClick={() => void onSetArchived(customer, !customer.archivedAt)}>{customer.archivedAt ? <><ArchiveRestore className="h-4 w-4" />Wiederherstellen</> : <><Archive className="h-4 w-4" />Archivieren</>}</Button><Button variant="outline" onClick={onClose}>Schließen</Button></div></>}
  </aside></div>;
}
