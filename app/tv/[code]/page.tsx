import { notFound } from "next/navigation";
import { getSessionBundle, getSessionByJoinCode } from "@/lib/queries";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { TvDisplay } from "@/components/tv/TvDisplay";

export const dynamic = "force-dynamic";

/**
 * Standalone big-screen view, addressed by join code so it's easy to type
 * on a TV browser: /tv/ABC123. Read-only — the host keeps running the table
 * from their own device.
 */
export default async function TvPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getSessionByJoinCode(code);
  if (!session) notFound();
  const bundle = await getSessionBundle(session.id);
  if (!bundle) notFound();

  return (
    <>
      <RealtimeRefresher sessionId={session.id} />
      <TvDisplay
        session={bundle.session}
        players={bundle.players}
        txs={bundle.txs}
        avatars={bundle.avatars}
      />
    </>
  );
}
