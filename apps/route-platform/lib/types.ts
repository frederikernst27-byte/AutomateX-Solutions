export type Role = "admin" | "driver" | "customer";

export type WorkOrderStatus =
  | "backlog"
  | "offered"
  | "confirmed"
  | "planned"
  | "en_route"
  | "on_site"
  | "completed"
  | "cancelled"
  | "needs_followup";

export type RouteStatus = "draft" | "published" | "started" | "completed" | "cancelled";

export type DriverEventType = "route_started" | "arrived" | "completed" | "problem" | "skipped" | "location";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Driver {
  id: string;
  name: string;
  initials: string;
  color: string;
  email: string;
  phone: string;
  skills: string[];
  active: boolean;
  depot: string;
  location: Coordinates;
  shiftStart: string;
  shiftEnd: string;
  maxStops: number;
  maxTravelMinutes: number;
  daysOff: string[];
  status: "available" | "on_route" | "off";
  lastSeen: string;
  /** Test drivers can be planned like regular drivers but have no login. */
  isTest?: boolean;
  testBatchId?: string;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  site: string;
  address: string;
  location: Coordinates;
  asset: string;
  speciality: string;
  intervalMonths: number;
  lastService: string;
  nextDue: string;
  sla: "Standard" | "SLA 24h" | "SLA 48h";
  portalSlug: string;
  notes?: string;
  /** Archivierte Kunden erscheinen nicht mehr im aktiven Kundenbestand. */
  archivedAt?: string;
  /** Records created by the admin test scenario can be removed safely as a batch. */
  testBatchId?: string;
}

export interface WorkOrder {
  id: string;
  customerId: string;
  title: string;
  kind: "Wartung" | "Reparatur" | "Notfall" | "Inspektion";
  status: WorkOrderStatus;
  scheduledDate?: string;
  /** Spätester zulässiger Planungstag; unabhängig vom Tages-Zeitfenster. */
  deadlineDate?: string;
  timeFrom: string;
  timeTo: string;
  durationMinutes: number;
  priority: 1 | 2 | 3 | 4;
  speciality: string;
  locked: boolean;
  assignedDriverId?: string;
  notes: string;
  portalToken: string;
  /** Server-side portal lifecycle metadata. Raw tokens are only retained for
   * the local demo seed; production adapters store a hash instead. */
  portalTokenExpiresAt?: string;
  portalTokenRevokedAt?: string;
  createdAt: string;
  /** Records created by the admin test scenario can be removed safely as a batch. */
  testBatchId?: string;
}

export interface RouteStop {
  workOrderId: string;
  order: number;
  eta: string;
  distanceFromPreviousKm: number;
  driveMinutesFromPrevious: number;
  explanation: string;
}

export interface Route {
  id: string;
  date: string;
  driverId: string;
  status: RouteStatus;
  stops: RouteStop[];
  distanceKm: number;
  travelMinutes: number;
  serviceMinutes: number;
  startedAt?: string;
  currentStopId?: string;
  lastLocation?: Coordinates;
}

export interface PlanningConstraints {
  from: string;
  to: string;
  /** Explicit day-level staffing chosen by the dispatcher. An omitted date
   * falls back to the selected drivers for backwards-compatible plan runs. */
  driverAvailability: Record<string, string[]>;
  driverIds: string[];
  defaultMaxStops: number;
  defaultMaxTravelMinutes: number;
  defaultMaxRouteMinutes: number;
  objectiveWeights: {
    due: number;
    priority: number;
    distance: number;
    balance: number;
  };
  hardRules: {
    specialities: boolean;
    confirmedWindows: boolean;
    maxStops: boolean;
    maxTravel: boolean;
  };
}

/** Organisation-wide defaults used for every new planning run.  They are
 * intentionally separate from a run's constraints so an admin can adjust
 * defaults without rewriting an already reviewed plan. */
export interface PlanningSettings {
  defaultMaxStops: number;
  defaultMaxTravelMinutes: number;
  defaultMaxRouteMinutes: number;
  autoConfirm: boolean;
  gpsEnabled: boolean;
  locationRetentionDays: number;
}

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorRole: Role | "system";
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

export interface PlanningResult {
  runId: string;
  mode: "vroom" | "manual" | "google" | "fallback" | "ai";
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  constraints: PlanningConstraints;
  routes: Route[];
  unassigned: Array<{ workOrderId: string; reason: string }>;
  summary: { assigned: number; unassigned: number; distanceKm: number; travelMinutes: number };
  /** Optimistic locking revision of a persisted planning draft. */
  revision?: number;
}

export interface ServiceReport {
  id: string;
  workOrderId: string;
  summary: string;
  findings: string[];
  followUp?: string;
  urgency: "normal" | "hoch" | "sofort";
  confirmed: boolean;
  createdAt: string;
  /** Metadata and bounded previews captured by the driver before upload. */
  attachments?: ServiceAttachment[];
}

export type ServiceAttachmentKind = "photo" | "audio" | "signature";

export interface ServiceAttachment {
  id: string;
  kind: ServiceAttachmentKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  /** Optional data URL used only for small offline previews. */
  dataUrl?: string;
}

export interface DemoState {
  drivers: Driver[];
  customers: Customer[];
  workOrders: WorkOrder[];
  routes: Route[];
  reports: ServiceReport[];
  planningRuns: PlanningResult[];
  inbox: InboxItem[];
  notifications: NotificationItem[];
  settings: PlanningSettings;
  lastUpdated: string;
}

export interface InboxItem {
  id: string;
  sender: string;
  subject: string;
  excerpt: string;
  intent: "confirm" | "cancel" | "reschedule" | "unknown";
  confidence: number;
  workOrderId?: string;
  receivedAt: string;
  actionStatus: "pending" | "applied" | "ignored";
  providerMessageId?: string;
  aiReason?: string;
}

export interface NotificationItem {
  id: string;
  type: "success" | "warning" | "info";
  title: string;
  message: string;
  createdAt: string;
}

export interface PlanCommand {
  maxStops?: number;
  maxTravelMinutes?: number;
  from?: string;
  to?: string;
  durationDays?: number;
  driverIds?: string[];
  raw: string;
  confidence: number;
}
