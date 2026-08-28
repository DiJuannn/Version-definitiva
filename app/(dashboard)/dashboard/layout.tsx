export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b p-4 text-sm font-medium">
        Versión definitiva — Área privada
      </header>
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
