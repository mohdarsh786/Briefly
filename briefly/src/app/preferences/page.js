import { auth0 } from "@/lib/auth0";
import PreferencesComponent from "./components/PreferencesComponent";

export default async function PreferencesPage() {
  const session = await auth0.getSession();

  if (!session?.user) {
    return <div>You must be logged in to view this page.</div>;
  }

  return (
    <div className="h-screen w-full rounded-md flex items-center justify-center bg-black/[0.96] antialiased bg-grid-white/[0.02] relative overflow-hidden">
      <PreferencesComponent user={session.user} />
    </div>
  );
}
