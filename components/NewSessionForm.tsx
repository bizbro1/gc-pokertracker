"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createSession } from "@/lib/actions";
import { formatCash, formatChips, formatNumber } from "@/lib/format";
import { Button, Card, CardHeader, Input, Label, Textarea } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Dealing you in\u2026" : "Open the Table"}
    </Button>
  );
}

export function NewSessionForm() {
  const [currency, setCurrency] = useState("NOK");
  const [cashRate, setCashRate] = useState(1000);
  const [chipRate, setChipRate] = useState(20000);
  const [buyIn, setBuyIn] = useState(1000);

  const ratio = cashRate > 0 ? chipRate / cashRate : 0;
  const buyInChips = Math.round(buyIn * ratio);

  return (
    <form action={createSession} className="space-y-6">
      <Card>
        <CardHeader title="The Table" subtitle="Name and house notes" />
        <div className="space-y-4 px-5 py-5">
          <div>
            <Label htmlFor="name">Session name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Friday Night — The Back Room"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="notes">Session notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="House rules, food orders, debts of honour…"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="The Stakes" subtitle="Chip rate, buy-in and blinds" />
        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="currency_code">Currency</Label>
              <Input
                id="currency_code"
                name="currency_code"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>
            <div>
              <Label htmlFor="cash_per_rate">Cash</Label>
              <Input
                id="cash_per_rate"
                name="cash_per_rate"
                type="number"
                min={1}
                value={cashRate}
                onChange={(e) => setCashRate(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="chips_per_rate">= Chips</Label>
              <Input
                id="chips_per_rate"
                name="chips_per_rate"
                type="number"
                min={1}
                value={chipRate}
                onChange={(e) => setChipRate(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="rounded-md felt-panel border border-felt-edge/60 px-4 py-3 text-center">
            <p className="text-sm text-cream tabular-nums">
              {formatCash(cashRate || 0, currency || "NOK")} ={" "}
              <span className="text-brass-bright font-medium">
                {formatChips(chipRate || 0)} chips
              </span>
            </p>
            <p className="mt-1 text-[11px] text-cream-dim tabular-nums">
              1 {currency || "NOK"} &asymp; {formatNumber(ratio, ratio % 1 ? 2 : 0)} chips
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="default_buy_in_cash">Default buy-in</Label>
              <Input
                id="default_buy_in_cash"
                name="default_buy_in_cash"
                type="number"
                min={1}
                value={buyIn}
                onChange={(e) => setBuyIn(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="small_blind">Small blind</Label>
              <Input id="small_blind" name="small_blind" type="number" min={0} defaultValue={100} />
            </div>
            <div>
              <Label htmlFor="big_blind">Big blind</Label>
              <Input id="big_blind" name="big_blind" type="number" min={0} defaultValue={200} />
            </div>
          </div>

          <p className="text-[11px] text-cream-dim tabular-nums">
            New players receive{" "}
            <span className="text-brass">{formatChips(buyInChips)} chips</span> for{" "}
            {formatCash(buyIn || 0, currency || "NOK")}. Blinds are in chips.
          </p>
        </div>
      </Card>

      <SubmitButton />
    </form>
  );
}
