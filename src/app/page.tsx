"use client";

import Image from "next/image";
import QRCode from "qrcode";
import {
  BadgeCheck,
  Banknote,
  Clipboard,
  Copy,
  ExternalLink,
  LoaderCircle,
  MapPin,
  QrCode,
  Radio,
  ReceiptText,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { celo, celoSepolia } from "viem/chains";
import {
  LOKA_CHAIN,
  LOKA_PAY_LEDGER_ABI,
  approveLokaTokenPayment,
  assertAddress,
  payLokaNative,
  payLokaToken,
  preparePaymentRequest,
  type LokaInvoiceDraft,
  type LokaTokenSymbol,
} from "@bamzzstudio/loka-sdk";
import { LOKA_DEFAULT_PAYMENT_TOKEN } from "@/lib/celo";

type AgentDraftPayload = Omit<LokaInvoiceDraft, "amountUnits"> & {
  amountUnits: string;
};

type AgentResponse =
  | {
      ok: true;
      agent: ReturnType<typeof preparePaymentRequest>["agent"];
      draft: AgentDraftPayload;
    }
  | {
      ok: false;
      error: string;
    };

type EthereumProvider = {
  isMiniPay?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const configuredChainId = Number(process.env.NEXT_PUBLIC_CELO_CHAIN_ID ?? "42220");
const selectedChain = configuredChainId === LOKA_CHAIN.sepolia.id ? celoSepolia : celo;
const chainMeta = configuredChainId === LOKA_CHAIN.sepolia.id ? LOKA_CHAIN.sepolia : LOKA_CHAIN.mainnet;
const ledgerContract = process.env.NEXT_PUBLIC_LOKA_LEDGER_ADDRESS || "";
const stableToken = process.env.NEXT_PUBLIC_LOKA_STABLE_TOKEN || LOKA_DEFAULT_PAYMENT_TOKEN.address;
const stableSymbol = process.env.NEXT_PUBLIC_LOKA_STABLE_SYMBOL || LOKA_DEFAULT_PAYMENT_TOKEN.symbol;
const stableDecimals = Number(process.env.NEXT_PUBLIC_LOKA_STABLE_DECIMALS || LOKA_DEFAULT_PAYMENT_TOKEN.decimals);

const EXAMPLES = [
  { label: "Food stall", note: "Jollof bowl and drink", amount: "2.40", customer: "Walk-in buyer" },
  { label: "Delivery", note: "Same-day market delivery", amount: "4.75", customer: "Ada" },
  { label: "Repair", note: "Phone screen deposit", amount: "12.00", customer: "Kofi" },
];

export default function Home() {
  const [account, setAccount] = useState<Address | null>(null);
  const [merchant, setMerchant] = useState("");
  const [customer, setCustomer] = useState("Walk-in buyer");
  const [amount, setAmount] = useState("2.40");
  const [tokenSymbol, setTokenSymbol] = useState<LokaTokenSymbol>("USDm");
  const [note, setNote] = useState("Jollof bowl and drink");
  const [country, setCountry] = useState("Local market");
  const [dueLabel, setDueLabel] = useState("Due now");
  const [draft, setDraft] = useState<LokaInvoiceDraft | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const shortAccount = useMemo(() => {
    if (!account) return "Not connected";
    return `${account.slice(0, 6)}...${account.slice(-4)}`;
  }, [account]);

  const contractReady = ledgerContract.length > 0;
  const explorerTx = txHash ? `${chainMeta.explorerUrl}/tx/${txHash}` : "";
  const effectiveMerchant = draft?.merchant ?? (merchant ? assertMaybeAddress(merchant) : undefined);

  useEffect(() => {
    const url = new URL(window.location.href);
    const urlAmount = url.searchParams.get("amount");
    const urlToken = url.searchParams.get("token") as LokaTokenSymbol | null;
    const urlNote = url.searchParams.get("note");
    const urlCustomer = url.searchParams.get("customer");
    const urlCountry = url.searchParams.get("country");
    const urlDue = url.searchParams.get("due");
    const urlMerchant = url.searchParams.get("merchant");

    if (!urlAmount && !urlNote && !urlMerchant) return;

    queueMicrotask(() => {
      if (urlAmount) setAmount(urlAmount);
      if (urlToken === "USDm" || urlToken === "CELO") setTokenSymbol(urlToken);
      if (urlNote) setNote(urlNote);
      if (urlCustomer) setCustomer(urlCustomer);
      if (urlCountry) setCountry(urlCountry);
      if (urlDue) setDueLabel(urlDue);
      if (urlMerchant) setMerchant(urlMerchant);
    });
  }, []);

  useEffect(() => {
    if (!draft) {
      queueMicrotask(() => setQrDataUrl(""));
      return;
    }

    QRCode.toDataURL(draft.paymentUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      color: {
        dark: "#17201b",
        light: "#f8f1dd",
      },
      width: 360,
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [draft]);

  async function connectWallet() {
    setError("");
    setStatus("Opening wallet");

    try {
      const provider = getProvider();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];

      await ensureCeloNetwork(provider);
      const connected = assertAddress(accounts[0], "wallet");
      setAccount(connected);
      setMerchant((current) => current || connected);
      setStatus(isMiniPay(provider) ? "MiniPay connected" : "Wallet connected");
    } catch (connectError) {
      setError(readError(connectError, "Wallet connection failed"));
      setStatus("Ready");
    }
  }

  async function prepareInvoice() {
    setError("");
    setIsPreparing(true);
    setStatus("Agent preparing request");

    try {
      const response = await fetch("/api/agent/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: merchant || account,
          customer,
          amount,
          tokenSymbol,
          note,
          country,
          dueLabel,
        }),
      });
      const payload = (await response.json()) as AgentResponse;

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setDraft({
        ...payload.draft,
        amountUnits: BigInt(payload.draft.amountUnits),
      });
      setStatus("Request ready");
    } catch (prepareError) {
      setError(readError(prepareError, "Invoice agent failed"));
      setStatus("Ready");
    } finally {
      setIsPreparing(false);
    }
  }

  async function payInvoice() {
    setError("");
    setTxHash(null);

    try {
      if (!draft) {
        throw new Error("Prepare a payment request first.");
      }

      if (!ledgerContract) {
        throw new Error("Add NEXT_PUBLIC_LOKA_LEDGER_ADDRESS after deploying the ledger contract.");
      }

      if (!draft.merchant) {
        throw new Error("Merchant wallet is missing from this request.");
      }

      const provider = getProvider();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];

      await ensureCeloNetwork(provider);
      const connectedAccount = assertAddress(accounts[0], "wallet");
      setAccount(connectedAccount);
      setIsPaying(true);

      const walletClient = createWalletClient({
        chain: selectedChain,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: selectedChain,
        transport: http(chainMeta.rpcUrl),
      });
      const contractAddress = assertAddress(ledgerContract, "Loka ledger");
      let hash: Hex;

      if (draft.tokenSymbol === "CELO") {
        setStatus("Confirm CELO payment");
        const estimatedGas = await publicClient.estimateContractGas({
          account: connectedAccount,
          address: contractAddress,
          abi: LOKA_PAY_LEDGER_ABI,
          functionName: "payNative",
          args: [draft.invoiceId, draft.merchant, draft.memoHash],
          value: draft.amountUnits,
        });

        hash = await payLokaNative({
          walletClient,
          contractAddress,
          invoiceId: draft.invoiceId,
          merchant: draft.merchant,
          amount: draft.amountUnits,
          memoHash: draft.memoHash,
        });
        setStatus(`Sent with ${estimatedGas.toString()} gas estimate`);
      } else {
        const tokenAddress = assertAddress(stableToken, "stable token");
        const amountUnits = parseUnits(draft.amount, stableDecimals);

        setStatus(`Approve ${stableSymbol}`);
        const approveHash = await approveLokaTokenPayment({
          walletClient,
          tokenAddress,
          spenderAddress: contractAddress,
          amount: amountUnits,
        });

        setStatus("Waiting for approval");
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        setStatus(`Confirm ${stableSymbol} payment`);
        hash = await payLokaToken({
          walletClient,
          contractAddress,
          invoiceId: draft.invoiceId,
          merchant: draft.merchant,
          tokenAddress,
          amount: amountUnits,
          memoHash: draft.memoHash,
        });
      }

      setTxHash(hash);
      setStatus("Waiting for Celo confirmation");
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Payment recorded");
    } catch (payError) {
      setError(readError(payError, "Payment failed"));
      setStatus(draft ? "Request ready" : "Ready");
    } finally {
      setIsPaying(false);
    }
  }

  async function copyPaymentLink() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft.paymentUrl);
    setStatus("Payment link copied");
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f3e8] px-4 py-4 text-[#17201b] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex items-center justify-between gap-3 border-b border-[#17201b]/10 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/loka-logo.svg" alt="Loka" width={54} height={54} priority />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black sm:text-3xl">Loka</h1>
              <p className="truncate text-sm font-semibold text-[#17201b]/60">Merchant payments on Celo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={connectWallet}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#17201b]/15 bg-[#17201b] text-white shadow-sm transition hover:bg-black"
            aria-label="Connect wallet"
            title={shortAccount}
          >
            <Wallet size={20} />
          </button>
        </header>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
          <div className="min-w-0 rounded-lg border border-[#17201b]/10 bg-[#fffaf0] p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusPill icon={<Radio size={14} />} label={status} />
              <StatusPill icon={<MapPin size={14} />} label={chainMeta.name} />
              <StatusPill icon={<BadgeCheck size={14} />} label={contractReady ? "Ledger set" : "Deploy pending"} />
            </div>

            {error ? (
              <p className="mb-4 max-w-full overflow-hidden break-words rounded-lg border border-[#d94a38]/25 bg-[#fff0ea] px-3 py-2 text-sm font-bold text-[#9d2d20] [overflow-wrap:anywhere]">
                {error}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Merchant wallet">
                <input
                  value={merchant}
                  onChange={(event) => {
                    setMerchant(event.target.value);
                    setDraft(null);
                  }}
                  placeholder="Connect wallet or paste address"
                  className="input"
                />
              </Field>
              <Field label="Customer">
                <input
                  value={customer}
                  onChange={(event) => {
                    setCustomer(event.target.value);
                    setDraft(null);
                  }}
                  className="input"
                />
              </Field>
              <Field label="Amount">
                <input
                  value={amount}
                  inputMode="decimal"
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setDraft(null);
                  }}
                  className="input"
                />
              </Field>
              <Field label="Token">
                <select
                  value={tokenSymbol}
                  onChange={(event) => {
                    setTokenSymbol(event.target.value as LokaTokenSymbol);
                    setDraft(null);
                  }}
                  className="input"
                >
                  <option value="USDm">{stableSymbol}</option>
                  <option value="CELO">CELO</option>
                </select>
              </Field>
              <Field label="Country or market">
                <input
                  value={country}
                  onChange={(event) => {
                    setCountry(event.target.value);
                    setDraft(null);
                  }}
                  className="input"
                />
              </Field>
              <Field label="Due">
                <input
                  value={dueLabel}
                  onChange={(event) => {
                    setDueLabel(event.target.value);
                    setDraft(null);
                  }}
                  className="input"
                />
              </Field>
            </div>

            <Field label="Memo">
              <textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setDraft(null);
                }}
                className="input min-h-24 resize-none leading-6"
                maxLength={180}
              />
            </Field>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => {
                    setNote(example.note);
                    setAmount(example.amount);
                    setCustomer(example.customer);
                    setDraft(null);
                    setStatus("Ready");
                  }}
                  className="min-h-16 rounded-lg border border-[#17201b]/10 bg-white px-3 py-2 text-left text-xs font-bold leading-5 text-[#17201b]/70 transition hover:border-[#2bd37f] hover:text-[#17201b]"
                >
                  <span className="block text-[#17201b]">{example.label}</span>
                  {example.note}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void prepareInvoice()}
                disabled={isPreparing || amount.trim().length === 0 || note.trim().length === 0}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#17201b]/15 bg-white px-4 text-sm font-black transition hover:border-[#f4b740] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isPreparing ? <LoaderCircle className="animate-spin" size={18} /> : <ReceiptText size={18} />}
                Prepare
              </button>
              <button
                type="button"
                onClick={() => void payInvoice()}
                disabled={isPaying || isPreparing || !draft}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#17201b] px-4 text-sm font-black text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isPaying ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
                Pay
              </button>
            </div>
          </div>

          <aside className="min-w-0 rounded-lg border border-[#17201b]/10 bg-[#17201b] p-4 text-white shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-white/50">Checkout</p>
                <h2 className="truncate text-xl font-black">{draft?.title ?? "No request prepared"}</h2>
              </div>
              <QrCode className="shrink-0 text-[#f4b740]" size={28} />
            </div>

            <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-lg border border-white/10 bg-[#f8f1dd] p-5">
              {qrDataUrl ? (
                <Image src={qrDataUrl} alt="Payment QR" width={360} height={360} unoptimized className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center text-[#17201b]">
                  <Image src="/loka-logo.svg" alt="" width={128} height={128} />
                  <p className="max-w-xs text-lg font-black leading-7">Prepared requests appear here.</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-2 text-sm">
              <DataRow label="Merchant" value={effectiveMerchant ? `${effectiveMerchant.slice(0, 8)}...${effectiveMerchant.slice(-6)}` : "Waiting"} />
              <DataRow
                label="Amount"
                value={draft ? `${draft.amount} ${draft.tokenSymbol === "USDm" ? stableSymbol : draft.tokenSymbol}` : "Waiting"}
              />
              <DataRow label="Invoice" value={draft ? `${draft.invoiceId.slice(0, 10)}...${draft.invoiceId.slice(-8)}` : "Waiting"} />
              <DataRow
                label="Link"
                value={draft ? "Copy checkout" : "Waiting"}
                action={draft ? copyPaymentLink : undefined}
              />
              <DataRow
                label="Receipt"
                value={txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : "No transaction yet"}
                href={explorerTx}
              />
            </div>
          </aside>
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          <Signal icon={<ShieldCheck size={18} />} label="Agent" value="Invoice checks" />
          <Signal icon={<Wallet size={18} />} label="Wallet" value="MiniPay ready" />
          <Signal icon={<Banknote size={18} />} label="Rails" value={`${stableSymbol} + CELO`} />
          <Signal icon={<Clipboard size={18} />} label="Receipts" value="Onchain ledger" />
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="mb-2 block text-xs font-black uppercase text-[#17201b]/55">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-[#17201b]/10 bg-white px-3 text-xs font-black text-[#17201b]/70">
      {icon}
      {label}
    </span>
  );
}

function DataRow({
  label,
  value,
  href,
  action,
}: {
  label: string;
  value: string;
  href?: string;
  action?: () => void;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3">
      <span className="shrink-0 text-xs font-black uppercase text-white/50">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-2 truncate text-right font-bold text-[#f4b740]"
        >
          <span className="truncate">{value}</span>
          <ExternalLink size={14} />
        </a>
      ) : action ? (
        <button
          type="button"
          onClick={action}
          className="inline-flex min-w-0 items-center gap-2 truncate text-right font-bold text-[#f4b740]"
        >
          <span className="truncate">{value}</span>
          <Copy size={14} />
        </button>
      ) : (
        <span className="min-w-0 truncate text-right font-bold text-white/80">{value}</span>
      )}
    </div>
  );
}

function Signal({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#17201b]/10 bg-white/60 px-4 py-3">
      <div className="flex items-center gap-2 text-[#17201b]/45">
        {icon}
        <p className="text-xs font-black uppercase">{label}</p>
      </div>
      <p className="mt-1 truncate text-lg font-black">{value}</p>
    </div>
  );
}

function getProvider(): EthereumProvider {
  const provider = (window as typeof window & { ethereum?: EthereumProvider }).ethereum;

  if (!provider) {
    throw new Error("Open Loka in MiniPay or a Celo-compatible wallet browser");
  }

  return provider;
}

function isMiniPay(provider: EthereumProvider): boolean {
  return Boolean(provider.isMiniPay || /MiniPay/i.test(window.navigator.userAgent));
}

async function ensureCeloNetwork(provider: EthereumProvider) {
  if (isMiniPay(provider)) {
    return;
  }

  const chainId = `0x${configuredChainId.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (switchError) {
    const maybeError = switchError as { code?: number };

    if (maybeError.code !== 4902) {
      throw switchError;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: chainMeta.name,
          nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
          rpcUrls: [chainMeta.rpcUrl],
          blockExplorerUrls: [chainMeta.explorerUrl],
        },
      ],
    });
  }
}

function assertMaybeAddress(value: string): Address | undefined {
  try {
    return assertAddress(value, "merchant");
  } catch {
    return undefined;
  }
}

function readError(error: unknown, fallback: string) {
  let message = fallback;

  if (error instanceof Error && error.message) {
    message = error.message;
  } else if (typeof error === "object" && error && "message" in error) {
    message = String((error as { message?: unknown }).message) || fallback;
  }

  const compact = message.replace(/\s+/g, " ").trim();
  const lower = compact.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
    return "Wallet request was rejected.";
  }

  if (lower.includes("insufficient funds") || lower.includes("not enough gas") || lower.includes("gas balance")) {
    return "Connected wallet does not have enough balance for payment and gas.";
  }

  if (lower.includes("wallet_switchethereumchain")) {
    return "This wallet cannot switch networks automatically. Open the app on Celo and try again.";
  }

  return compact.length > 260 ? `${compact.slice(0, 260)}...` : compact;
}
