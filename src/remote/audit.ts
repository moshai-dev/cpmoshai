export interface AuditEvent {
  ip: string | null;
  status: number;
  keyId?: string;
  reason?: string;
  rpc?: string[];
}

export type Audit = (event: AuditEvent) => void;

export const stderrAudit: Audit = (event) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), ...event }));
};
