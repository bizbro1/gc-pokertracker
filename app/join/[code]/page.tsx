import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionByJoinCode, getPlayerIdByKey, isHost } from "@/lib/queries";
import { hostCookieName, playerCookieName } from "@/lib/cookie-names";
import { formatCash, formatChips } from "@/lib/format";
import { Card, StatusBadge } from "@/components/ui";
import { JoinForm } from "@/components/JoinForm";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getSessionByJoinCode(code);
  if (!session) notFound();

  const jar = await cookies();
  if (await isHost(session.id, jar.get(hostCookieName(session.id))?.value)) {
    redirect(`/session/${session.id}`);
  }
  const playerId = await getPlayerIdByKey(jar.get(playerCookieName(session.id))?.value);
  if (playerId) redirect(`/session/${session.id}/me`);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cream-dim">
          You are invited
        </p>
        <h1 className="mt-3 font-display text-4xl brass-text">{session.name}</h1>
        <div className="mt-3 flex justify-center">
          <StatusBadge status={session.status} />
        </div>
        <p className="mt-3 text-xs text-cream-dim tabular-nums">
          Blinds {formatChips(session.small_blind)}/{formatChips(session.big_blind)}
          {" · "}
          buy-in {formatCash(session.default_buy_in_cash, session.currency_code)}
        </p>
      </div>

      <Card className="mt-8 px-5 py-6">
        {session.status === "ended" ? (
          <p className="text-center text-sm text-cream-dim">
            This session has ended. The chairs are stacked.
          </p>
        ) : (
          <JoinForm joinCode={session.join_code} />
        )}
      </Card>

      <p className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-cream-faint">
        Gentleman&apos;s Club &mdash; members only
      </p>
    </main>
  );
}
