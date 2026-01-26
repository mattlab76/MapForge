import { Sidebar } from "@/components/Sidebar";
import { SYSTEMS } from "@/lib/interfaces/registry";
import { SystemHeader } from "@/components/SystemHeader";

export default function SystemLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { system: string };
}) {
  const system = SYSTEMS.find((s) => s.id === params.system);
  const title = system?.title ?? params.system;

  return (
    <div className="container">
      <SystemHeader systemTitle={title} />
      <div className="row" style={{ alignItems: "stretch", marginTop: 12 }}>
        <Sidebar />
        <div className="main">{children}</div>
      </div>
    </div>
  );
}
