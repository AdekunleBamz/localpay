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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { celo, celoSepolia } from "viem/chains";
import {
  LOKA_CHAIN,
  LOKA_PAY_LEDGER_ABI,
  LOKA_STABLECOINS,
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

type StableTokenSymbol = Exclude<LokaTokenSymbol, "CELO">;
type WalletMode = "unknown" | "browser" | "minipay";
type StableBalance = {
  symbol: StableTokenSymbol;
  balance: bigint;
  display: string;
  canPay: boolean;
};

const configuredChainId = Number(process.env.NEXT_PUBLIC_CELO_CHAIN_ID ?? "42220");
const selectedChain = configuredChainId === LOKA_CHAIN.sepolia.id ? celoSepolia : celo;
const chainMeta = configuredChainId === LOKA_CHAIN.sepolia.id ? LOKA_CHAIN.sepolia : LOKA_CHAIN.mainnet;
const ledgerContract = process.env.NEXT_PUBLIC_LOKA_LEDGER_ADDRESS || "";
const stableToken = process.env.NEXT_PUBLIC_LOKA_STABLE_TOKEN || LOKA_DEFAULT_PAYMENT_TOKEN.address;
const stableSymbol = process.env.NEXT_PUBLIC_LOKA_STABLE_SYMBOL || LOKA_DEFAULT_PAYMENT_TOKEN.symbol;
const stableDecimals = Number(process.env.NEXT_PUBLIC_LOKA_STABLE_DECIMALS || LOKA_DEFAULT_PAYMENT_TOKEN.decimals);
const STABLE_TOKEN_SYMBOLS = ["USDm", "USDC", "USDT"] as const satisfies readonly StableTokenSymbol[];
const STABLE_TOKENS: Record<StableTokenSymbol, { symbol: StableTokenSymbol; address: Address; decimals: number }> = {
  USDm: {
    symbol: "USDm",
    address: stableToken as Address,
    decimals: stableDecimals,
  },
  USDC: LOKA_STABLECOINS.USDC,
  USDT: LOKA_STABLECOINS.USDT,
};

const EXAMPLES = [
  { label: "Food stall", note: "Jollof bowl and drink", amount: "2.40", customer: "Walk-in buyer" },
  { label: "Delivery", note: "Same-day market delivery", amount: "4.75", customer: "Ada" },
  { label: "Repair", note: "Phone screen deposit", amount: "12.00", customer: "Kofi" },
];

export default function Home() {
  const [account, setAccount] = useState<Address | null>(null);
  const [walletMode, setWalletMode] = useState<WalletMode>("unknown");
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
  const [isCheckingBalances, setIsCheckingBalances] = useState(false);
  const [stableBalances, setStableBalances] = useState<StableBalance[]>([]);
  const autoConnectStartedRef = useRef(false);

  const shortAccount = useMemo(() => {
    if (!account) return "Not connected";
    return `${account.slice(0, 6)}...${account.slice(-4)}`;
  }, [account]);

  const contractReady = ledgerContract.length > 0;
  const explorerTx = txHash ? `${chainMeta.explorerUrl}/tx/${txHash}` : "";
  const effectiveMerchant = draft?.merchant ?? (merchant ? assertMaybeAddress(merchant) : undefined);
  const isMiniPaySession = walletMode === "minipay";
  const walletSignal = isMiniPaySession ? "MiniPay" : account ? "Web wallet" : "Connect";
  const railsSignal = isMiniPaySession ? "Stable auto-select" : "Stables + CELO";
  const tokenOptions = isMiniPaySession ? STABLE_TOKEN_SYMBOLS : [...STABLE_TOKEN_SYMBOLS, "CELO" as const];

  const refreshStableBalances = useCallback(
    async (owner: Address, announce: boolean) => {
      setIsCheckingBalances(true);

      try {
        const publicClient = createPublicClient({
          chain: selectedChain,
          transport: http(chainMeta.rpcUrl),
        });
        const balances = await Promise.all(
          STABLE_TOKEN_SYMBOLS.map(async (symbol) => {
            const token = STABLE_TOKENS[symbol];
            const required = requiredAmountForToken(amount, token.decimals);
            const balance = await publicClient.readContract({
              address: token.address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [owner],
            });

            return {
              symbol,
              balance,
              display: formatTokenBalance(balance, token.decimals),
              canPay: required ? balance >= required : balance > BigInt(0),
            } satisfies StableBalance;
          }),
        );

        setStableBalances(balances);

        const selected = chooseStableTokenForAmount(balances, tokenSymbol, amount);
        if (selected && selected !== tokenSymbol) {
          setTokenSymbol(selected);
          setDraft(null);
          setStatus(`${selected} selected`);
        } else if (announce) {
          setStatus("MiniPay connected");
        }
      } catch {
        setStableBalances([]);
        if (announce) setStatus("MiniPay connected");
      } finally {
        setIsCheckingBalances(false);
      }
    },
    [amount, tokenSymbol],
  );

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    function detectWalletProvider() {
      const provider = getOptionalProvider();

      if (!provider) {
        if (attempts < 12) {
          attempts += 1;
          timer = window.setTimeout(detectWalletProvider, 150);
        }
        return;
      }

      const detectedProvider = provider;
      const miniPayDetected = isMiniPay(provider);

      queueMicrotask(() => {
        if (!cancelled) {
          setWalletMode(miniPayDetected ? "minipay" : "browser");
        }
      });

      if (!miniPayDetected || autoConnectStartedRef.current) return;

      autoConnectStartedRef.current = true;

      async function autoConnectMiniPay() {
        setError("");
        setStatus("Connecting MiniPay");

        try {
          const accounts = (await detectedProvider.request({ method: "eth_requestAccounts" })) as Address[];
          const connected = assertAddress(accounts[0], "wallet");

          if (cancelled) return;

          setWalletMode("minipay");
          setAccount(connected);
          setMerchant((current) => current || connected);
          await refreshStableBalances(connected, true);
        } catch (connectError) {
          if (cancelled) return;

          setError(readError(connectError, "MiniPay connection failed"));
          setStatus("Open MiniPay wallet");
        }
      }

      void autoConnectMiniPay();
    }

    detectWalletProvider();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [refreshStableBalances]);

  useEffect(() => {
    if (!account || walletMode !== "minipay") return;

    const timer = window.setTimeout(() => {
      void refreshStableBalances(account, false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [account, amount, refreshStableBalances, walletMode]);

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
      if (isSupportedTokenSymbol(urlToken)) setTokenSymbol(urlToken);
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
        dark: "#10231d",
        light: "#ffffff",
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
      const miniPaySession = isMiniPay(provider);
      setWalletMode(miniPaySession ? "minipay" : "browser");
      setAccount(connected);
      setMerchant((current) => current || connected);
      if (miniPaySession) {
        await refreshStableBalances(connected, true);
      } else {
        setStatus("Wallet connected");
      }
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
      const miniPaySession = isMiniPay(provider);
      setWalletMode(miniPaySession ? "minipay" : "browser");
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

      if (miniPaySession && draft.tokenSymbol === "CELO") {
        throw new Error("MiniPay checkout uses USDm, USDC, or USDT. Select a stablecoin and prepare again.");
      }

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
        const paymentToken = stableTokenForSymbol(draft.tokenSymbol);
        const tokenAddress = paymentToken.address;
        const amountUnits = parseUnits(draft.amount, paymentToken.decimals);

        setStatus(`Approve ${paymentToken.symbol}`);
        const approveHash = await approveLokaTokenPayment({
          walletClient,
          tokenAddress,
          spenderAddress: contractAddress,
          amount: amountUnits,
        });

        setStatus("Waiting for approval");
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        setStatus(`Confirm ${paymentToken.symbol} payment`);
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
    <main className="min-h-screen overflow-x-hidden bg-[#eef3f0] px-3 py-3 text-[#10231d] sm:px-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-7xl grid-rows-[auto_1fr] gap-3">
        <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-[#cfdbd4] bg-white px-3 py-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/loka-logo.svg" alt="Loka" width={44} height={44} priority className="shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black sm:text-2xl">Loka</h1>
              <p className="truncate text-xs font-bold uppercase text-[#607168]">Merchant till for Celo stable payments</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <StatusPill icon={<Radio size={14} />} label={status} />
            <StatusPill icon={<MapPin size={14} />} label={chainMeta.name} />
            <button
              type="button"
              onClick={connectWallet}
              className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-md bg-[#10231d] px-3 text-sm font-black text-white shadow-sm transition hover:bg-[#1a3a31]"
              title={shortAccount}
            >
              <Wallet size={17} />
              <span className="min-w-0 truncate">{shortAccount}</span>
            </button>
          </div>
        </header>

        <section className="grid min-w-0 gap-3 lg:grid-cols-[17rem_minmax(0,1fr)_23rem]">
          <aside className="order-2 min-w-0 rounded-lg bg-[#10231d] p-3 text-white shadow-sm lg:order-1">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <p className="text-xs font-black uppercase text-white/45">Till status</p>
                <p className="mt-1 text-lg font-black">{walletSignal}</p>
              </div>
              <BadgeCheck className={contractReady ? "text-[#2bd37f]" : "text-[#f4b740]"} size={24} />
            </div>

            <div className="mt-3 grid gap-2">
              <SideMetric icon={<ShieldCheck size={16} />} label="Ledger" value={contractReady ? "Ready" : "Set env"} />
              <SideMetric icon={<Banknote size={16} />} label="Rails" value={railsSignal} />
              <SideMetric icon={<Clipboard size={16} />} label="Mode" value={isMiniPaySession ? "Auto stable" : "Manual"} />
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase text-white/45">Stable balances</p>
              <div className="grid gap-2">
                {isMiniPaySession && account ? (
                  isCheckingBalances ? (
                    <BalanceLine label="Wallet" value="Checking" active />
                  ) : stableBalances.length > 0 ? (
                    stableBalances.map((item) => (
                      <BalanceLine key={item.symbol} label={item.symbol} value={item.display} active={item.symbol === tokenSymbol} />
                    ))
                  ) : (
                    <BalanceLine label="Wallet" value="No stables" />
                  )
                ) : (
                  <BalanceLine label="MiniPay" value="Connect" />
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase text-white/45">Quick tickets</p>
              <div className="grid gap-2">
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
                    className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-left text-xs font-bold leading-5 text-white/70 transition hover:border-[#2bd37f]/70 hover:bg-white/[0.1] hover:text-white"
                  >
                    <span className="block text-sm font-black text-white">{example.label}</span>
                    {example.amount} {tokenLabelForSymbol(tokenSymbol)} - {example.note}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="order-1 min-w-0 rounded-lg border border-[#cfdbd4] bg-white shadow-sm lg:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce5df] px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase text-[#607168]">Request builder</p>
                <h2 className="mt-1 text-2xl font-black">New payment</h2>
              </div>
              <StatusPill icon={<BadgeCheck size={14} />} label={contractReady ? "Ledger set" : "Deploy pending"} />
            </div>

            <div className="p-4">
              {error ? (
                <p className="mb-4 max-w-full overflow-hidden break-words rounded-md border border-[#d94a38]/25 bg-[#fff0ea] px-3 py-2 text-sm font-bold text-[#9d2d20] [overflow-wrap:anywhere]">
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
                <Field label="Payment rail">
                  <select
                    value={tokenSymbol}
                    onChange={(event) => {
                      setTokenSymbol(event.target.value as LokaTokenSymbol);
                      setDraft(null);
                    }}
                    className="input"
                  >
                    {tokenOptions.map((symbol) => (
                      <option key={symbol} value={symbol}>
                        {tokenLabelForSymbol(symbol)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Market">
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

              {isMiniPaySession && account ? (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-[#607168]">
                  {isCheckingBalances ? (
                    <span className="rounded-md border border-[#dce5df] bg-[#f8fbf8] px-2 py-1">Checking balances</span>
                  ) : stableBalances.length > 0 ? (
                    stableBalances.map((item) => (
                      <span
                        key={item.symbol}
                        className={`rounded-md border px-2 py-1 ${
                          item.symbol === tokenSymbol
                            ? "border-[#2bd37f]/40 bg-[#e9fff2] text-[#12643d]"
                            : "border-[#dce5df] bg-[#f8fbf8]"
                        }`}
                      >
                        {item.symbol}: {item.display}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-md border border-[#dce5df] bg-[#f8fbf8] px-2 py-1">No stable balance found</span>
                  )}
                </div>
              ) : null}

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

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.2fr]">
                <button
                  type="button"
                  onClick={() => void prepareInvoice()}
                  disabled={isPreparing || amount.trim().length === 0 || note.trim().length === 0}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#c9d7d0] bg-[#f8fbf8] px-4 text-sm font-black text-[#10231d] transition hover:border-[#2b7bd3] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isPreparing ? <LoaderCircle className="animate-spin" size={18} /> : <ReceiptText size={18} />}
                  Prepare request
                </button>
                <button
                  type="button"
                  onClick={() => void payInvoice()}
                  disabled={isPaying || isPreparing || !draft}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#2bd37f] px-4 text-sm font-black text-[#082118] shadow-sm transition hover:bg-[#24be71] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isPaying ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
                  Collect payment
                </button>
              </div>
            </div>
          </section>

          <aside className="order-3 min-w-0 rounded-lg border border-[#cfdbd4] bg-white shadow-sm">
            <div className="border-b border-[#dce5df] px-4 py-3">
              <p className="text-xs font-black uppercase text-[#607168]">Checkout packet</p>
              <h2 className="mt-1 truncate text-xl font-black">{draft?.title ?? "No request prepared"}</h2>
            </div>

            <div className="p-4">
              <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-md border border-[#dce5df] bg-white p-5">
                {qrDataUrl ? (
                  <Image src={qrDataUrl} alt="Payment QR" width={360} height={360} unoptimized className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center text-[#10231d]">
                    <QrCode className="text-[#2b7bd3]" size={58} />
                    <p className="max-w-xs text-sm font-black leading-6 text-[#607168]">Prepare a request to generate a checkout QR.</p>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <DataRow label="Merchant" value={effectiveMerchant ? `${effectiveMerchant.slice(0, 8)}...${effectiveMerchant.slice(-6)}` : "Waiting"} />
                <DataRow label="Amount" value={draft ? `${draft.amount} ${tokenLabelForSymbol(draft.tokenSymbol)}` : "Waiting"} />
                <DataRow label="Invoice" value={draft ? `${draft.invoiceId.slice(0, 10)}...${draft.invoiceId.slice(-8)}` : "Waiting"} />
                <DataRow label="Link" value={draft ? "Copy checkout" : "Waiting"} action={draft ? copyPaymentLink : undefined} />
                <DataRow label="Receipt" value={txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : "No transaction"} href={explorerTx} />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 rounded-md border border-[#dce5df] bg-[#fbfdfa] p-3">
      <span className="mb-2 block text-xs font-black uppercase text-[#607168]">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-[#cfdcd5] bg-[#f8fbf8] px-3 text-xs font-black text-[#52645b]">
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
    <div className="grid min-h-11 grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 border-b border-[#dce5df] py-2 last:border-b-0">
      <span className="text-xs font-black uppercase text-[#607168]">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center justify-end gap-2 truncate text-right font-bold text-[#2b7bd3]"
        >
          <span className="truncate">{value}</span>
          <ExternalLink size={14} />
        </a>
      ) : action ? (
        <button
          type="button"
          onClick={action}
          className="inline-flex min-w-0 items-center justify-end gap-2 truncate text-right font-bold text-[#2b7bd3]"
        >
          <span className="truncate">{value}</span>
          <Copy size={14} />
        </button>
      ) : (
        <span className="min-w-0 truncate text-right font-bold text-[#10231d]">{value}</span>
      )}
    </div>
  );
}

function SideMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2">
      <div className="text-[#2bd37f]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-white/45">{label}</p>
        <p className="truncate text-sm font-black text-white">{value}</p>
      </div>
    </div>
  );
}

function BalanceLine({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  return (
    <div
      className={`flex min-h-10 items-center justify-between gap-3 rounded-md border px-3 text-sm font-black ${
        active ? "border-[#2bd37f]/70 bg-[#2bd37f]/15 text-white" : "border-white/10 bg-white/[0.05] text-white/72"
      }`}
    >
      <span>{label}</span>
      <span className={active ? "text-[#8ff3b9]" : "text-white/50"}>{value}</span>
    </div>
  );
}

function getProvider(): EthereumProvider {
  const provider = getOptionalProvider();

  if (!provider) {
    throw new Error("Open Loka in MiniPay or a Celo-compatible wallet browser");
  }

  return provider;
}

function getOptionalProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;

  return (window as typeof window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

function isMiniPay(provider: EthereumProvider): boolean {
  return Boolean(provider.isMiniPay || /MiniPay/i.test(window.navigator.userAgent));
}

function isSupportedTokenSymbol(value: string | null): value is LokaTokenSymbol {
  return value === "CELO" || value === "USDm" || value === "USDC" || value === "USDT";
}

function isStableTokenSymbol(value: LokaTokenSymbol): value is StableTokenSymbol {
  return value !== "CELO";
}

function stableTokenForSymbol(symbol: StableTokenSymbol) {
  return STABLE_TOKENS[symbol];
}

function tokenLabelForSymbol(symbol: LokaTokenSymbol) {
  if (symbol === "CELO") return "CELO";
  if (symbol === "USDm") return stableSymbol;

  return symbol;
}

function requiredAmountForToken(rawAmount: string, decimals: number) {
  try {
    return parseUnits(rawAmount, decimals);
  } catch {
    return null;
  }
}

function formatTokenBalance(balance: bigint, decimals: number) {
  const [whole, fraction = ""] = formatUnits(balance, decimals).split(".");
  const trimmed = fraction.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function chooseStableTokenForAmount(
  balances: StableBalance[],
  currentToken: LokaTokenSymbol,
  rawAmount: string,
): StableTokenSymbol | null {
  const currentBalance = isStableTokenSymbol(currentToken)
    ? balances.find((item) => item.symbol === currentToken)
    : undefined;

  if (currentBalance?.canPay) {
    return currentBalance.symbol;
  }

  const canPay = STABLE_TOKEN_SYMBOLS.map((symbol) => balances.find((item) => item.symbol === symbol)).find(
    (item): item is StableBalance => Boolean(item?.canPay),
  );

  if (canPay) {
    return canPay.symbol;
  }

  const amountLooksValid = requiredAmountForToken(rawAmount, 18) !== null;
  const hasBalance = STABLE_TOKEN_SYMBOLS.map((symbol) => balances.find((item) => item.symbol === symbol)).find(
    (item): item is StableBalance => Boolean(item && item.balance > BigInt(0)),
  );

  if (!amountLooksValid && hasBalance) {
    return hasBalance.symbol;
  }

  return null;
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
