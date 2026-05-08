import { NextResponse } from "next/server";
import { assertAddress, preparePaymentRequest, type LokaTokenSymbol } from "@bamzzstudio/loka-sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = (await request.json()) as {
      merchant?: string;
      customer?: string;
      amount?: string;
      tokenSymbol?: LokaTokenSymbol;
      note?: string;
      country?: string;
      dueLabel?: string;
    };
    const merchant = body.merchant ? assertAddress(body.merchant, "merchant") : undefined;
    const result = preparePaymentRequest(
      {
        merchant,
        customer: body.customer,
        amount: body.amount ?? "1",
        tokenSymbol: body.tokenSymbol ?? "USDm",
        note: body.note ?? "Local payment",
        country: body.country,
        dueLabel: body.dueLabel,
      },
      { baseUrl: url.origin },
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare payment request";

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
