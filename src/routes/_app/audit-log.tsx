import { createFileRoute } from "@tanstack/react-router";
import { useEnrollments, useTerminationLogs } from "@/lib/db";
import { terminationLabel } from "@/lib/academics";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { Empty, Loading, PageHeader, Panel, Table, Td, Th } from "@/components/app/ui-kit";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/audit-log")({
  head: () => pageHead("Audit Log", "History of student terminations and enrollment submissions."),
  component: AuditLogPage,
});

function AuditLogPage() {
  const { data: logs = [], isLoading } = useTerminationLogs();
  const { data: enrollments = [] } = useEnrollments();
  if (isLoading) return <Loading />;
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Terminations and enrollment submissions, newest first." />
      <Panel title={`Terminations (${logs.length})`} bodyClassName="p-0" className="mb-6">
        {logs.length === 0 ? <Empty title="No terminations recorded" /> : (
          <Table>
            <thead><tr><Th>Student</Th><Th>Reason</Th><Th>Termination date</Th><Th>Logged</Th></tr></thead>
            <tbody>{[...logs].reverse().map((l) => (
              <tr key={l.id}><Td className="font-medium">{l.anonymized ? "Anonymized" : l.student_name_at_termination}</Td><Td><Badge variant="muted">{terminationLabel(l.termination_reason)}</Badge></Td><Td>{fmtDate(l.termination_date)}</Td><Td className="text-muted-foreground">{fmtDateTime(l.logged_at)}</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Panel>
      <Panel title={`Enrollment submissions (${enrollments.length})`} bodyClassName="p-0">
        {enrollments.length === 0 ? <Empty title="No enrollments submitted" /> : (
          <Table>
            <thead><tr><Th>Student</Th><Th>LIN</Th><Th>Guardian</Th><Th>Phone</Th><Th>Status</Th><Th>Submitted</Th></tr></thead>
            <tbody>{[...enrollments].reverse().map((e) => (
              <tr key={e.id}><Td className="font-medium">{e.full_name}</Td><Td className="font-mono text-xs">{e.lin}</Td><Td>{e.guardian_name || "—"}</Td><Td>{e.guardian_phone || "—"}</Td><Td><Badge variant="info">{e.status}</Badge></Td><Td className="text-muted-foreground">{fmtDateTime(e.submitted_at)}</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
