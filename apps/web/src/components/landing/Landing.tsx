"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loginOrRegister } from "@/lib/wallet";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { Veiled } from "@/components/ui/Veiled";
import { useReveal } from "@/components/useReveal";
import { POOLS, addressUrl } from "@/lib/config";
import { LedgerWall } from "./LedgerWall";
import { ExplorerCard } from "./ExplorerCard";

const REPO = "https://github.com/Bob-Elly/Veil";

function useLaunch() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const launch = async () => {
    setErr(null);
    setBusy(true);
    try { await loginOrRegister(); } catch (e: any) { setErr(e?.message || "Passkey cancelled"); } finally { setBusy(false); }
  };
  return { busy, err, launch };
}

/** The "gloam": a soft light that follows the cursor and brightens on hover. */
function CursorHaze({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const haze = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = target.current, h = haze.current;
    if (!el || !h) return;
    let tx = 0.62, ty = 0.42, x = tx, y = ty, raf = 0, on = false;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; on = true;
    };
    const leave = () => { on = false; tx = 0.62; ty = 0.42; };
    const tick = () => {
      x += (tx - x) * 0.06; y += (ty - y) * 0.06;
      h.style.transform = `translate3d(${(x - 0.5) * 100}%, ${(y - 0.5) * 100}%, 0)`;
      h.style.opacity = on ? "1" : "0.55";
      raf = requestAnimationFrame(tick);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [target]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={haze}
        className="absolute left-0 top-0 h-full w-full transition-opacity duration-700"
        style={{
          background: "radial-gradient(30% 34% at 50% 50%, rgba(131,110,249,0.30), transparent 70%), radial-gradient(18% 20% at 54% 46%, rgba(232,196,138,0.14), transparent 70%)",
          filter: "blur(30px)",
        }}
      />
    </div>
  );
}

function Spotlight({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={`group relative overflow-hidden rounded-2xl border border-line bg-panel transition-colors duration-500 hover:border-line-strong ${className}`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(420px circle at var(--mx) var(--my), rgba(131,110,249,0.13), transparent 60%)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}

function LandingNav({ onLaunch, busy }: { onLaunch: () => void; busy: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 24);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "bg-background/70 backdrop-blur-xl border-b border-line" : "border-b border-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-9">
        <Link href="/" aria-label="Veil home"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-7 text-[14px] text-soft">
          <a href="#how" className="link-u hover:text-foreground transition-colors">How it works</a>
          <a href="#use" className="link-u hover:text-foreground transition-colors">Use cases</a>
          <a href="#dev" className="link-u hover:text-foreground transition-colors">Developers</a>
          <Link href="/transparency" className="link-u hover:text-foreground transition-colors">Transparency</Link>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex"><a href={REPO} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">GitHub</a></span>
          <button onClick={onLaunch} disabled={busy} className="btn btn-ink btn-sm">{busy ? "Waiting for passkey…" : "Launch app ↗"}</button>
        </div>
      </div>
    </header>
  );
}

const INTEGRATIONS = ["Monad", "Mera passkeys", "MetaMask Agent Wallet", "Chainlink CRE", "Envio HyperIndex", "Agora AUSD", "Aurora Intents", "Cleanverse", "x402", "ERC-8004"];

export function Landing() {
  const { busy, err, launch } = useLaunch();
  const hero = useRef<HTMLElement>(null);
  const [explorerView, setExplorerView] = useState(true);
  useReveal();

  return (
    <div className="relative bg-background text-foreground overflow-x-clip">
      <LandingNav onLaunch={launch} busy={busy} />

      {/* ───────────── HERO ───────────── */}
      <section ref={hero} className="relative min-h-[100svh] flex items-end overflow-hidden">
        <LedgerWall />
        <CursorHaze target={hero} />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_100%,#09090a_30%,transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-[1320px] px-5 sm:px-9 pb-14 sm:pb-20 pt-32 grid gap-12 lg:grid-cols-[1.35fr_1fr] items-end">
          <div>
            <div className="rise inline-flex items-center gap-2 rounded-md border border-line bg-black/40 px-2.5 py-1 text-[12px] text-soft backdrop-blur" style={{ ["--d" as any]: "0.05s" }}>
              <span className="h-1.5 w-1.5 rounded-[2px] bg-accent" style={{ animation: "veil-pulse 2.4s infinite" }} />
              Live on Monad testnet · Track 04
            </div>
            <h1 className="mt-6 text-[44px] leading-[0.98] sm:text-[68px] xl:text-[80px] font-light tracking-[-0.045em]">
              <span className="rise block" style={{ ["--d" as any]: "0.12s" }}>Pay anyone on Monad.</span>
              <span className="rise block text-mute" style={{ ["--d" as any]: "0.24s" }}>
                Nobody else sees <Veiled delay={1.2} className="text-foreground">how much</Veiled>.
              </span>
            </h1>
            <p className="rise mt-7 max-w-[540px] text-[17px] leading-relaxed text-soft" style={{ ["--d" as any]: "0.36s" }}>
              Payroll, creator payouts and agent spending in USDC and AUSD, with the amounts and the people kept off the public record.
              Sign in with a passkey. Proofs are made on your device.
            </p>
            <div className="rise mt-9 flex flex-wrap items-center gap-4" style={{ ["--d" as any]: "0.48s" }}>
              <button onClick={launch} disabled={busy} className="btn btn-ink btn-lg">{busy ? "Waiting for passkey…" : "Launch app ↗"}</button>
              <a href="#how" className="link-u text-[15px] text-soft hover:text-foreground transition-colors">How it stays private →</a>
            </div>
            {err && <p className="mt-4 text-sm text-danger">{err}</p>}
          </div>
          <div className="rise" style={{ ["--d" as any]: "0.6s" }}>
            <ExplorerCard explorer={explorerView} setExplorer={setExplorerView} />
          </div>
        </div>
      </section>

      {/* ───────────── MARQUEE ───────────── */}
      <section className="border-y border-line py-5 overflow-hidden" aria-label="Integrations">
        <div className="flex w-max gap-12 text-[13px] uppercase tracking-[0.18em] text-faint" style={{ animation: "veil-marquee 38s linear infinite" }}>
          {[...INTEGRATIONS, ...INTEGRATIONS].map((t, i) => (
            <span key={i} className="flex items-center gap-12 whitespace-nowrap">{t}<span className="inline-block h-2 w-4 rounded-[2px] bg-black ring-1 ring-white/10" /></span>
          ))}
        </div>
      </section>

      {/* ───────────── THESIS ───────────── */}
      <section className="mx-auto max-w-[1320px] px-5 sm:px-9 py-28 sm:py-40">
        <p className="reveal text-[12px] uppercase tracking-[0.2em] text-accent-hi">Our thesis</p>
        <p className="reveal mt-6 max-w-[1050px] text-[30px] sm:text-[48px] leading-[1.12] font-light tracking-[-0.03em] text-soft" style={{ ["--d" as any]: "0.1s" }}>
          On a public chain, every <Veiled delay={0.2} className="text-foreground">salary</Veiled> is a press release, every{" "}
          <Veiled delay={0.9} className="text-foreground">supplier</Veiled> is public, and every{" "}
          <Veiled delay={1.6} className="text-foreground">treasury move</Veiled> gets front-run.
          <span className="text-mute"> Veil keeps settlement public and the details private. </span>
          <span className="text-faint text-[0.6em] align-middle whitespace-nowrap">(hover the boxes)</span>
        </p>
      </section>

      {/* ───────────── HOW IT WORKS ───────────── */}
      <section id="how" className="mx-auto max-w-[1320px] px-5 sm:px-9 pb-28 sm:pb-36 scroll-mt-24">
        <div className="reveal flex flex-wrap items-end justify-between gap-6 mb-12">
          <h2 className="text-[34px] sm:text-[52px] font-light leading-none">How it works</h2>
          <p className="max-w-md text-soft">Three moves. The pool contract can verify every one of them without learning who or how much.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { n: "01", t: "Shield", d: "Move USDC or AUSD from your passkey wallet into the pool. You get a private note only your key can open.", art: <ArtShield /> },
            { n: "02", t: "Pay privately", d: "Your device builds a zero-knowledge proof (about 2s). A relayer submits it, so not even your gas wallet shows up.", art: <ArtProof /> },
            { n: "03", t: "Cash out or claim", d: "Withdraw to any address, or send someone a claim link. They don't need a Veil account to get paid.", art: <ArtClaim /> },
          ].map((s, i) => (
            <Spotlight key={s.n} className="reveal p-7 min-h-[360px]" >
              <div style={{ ["--d" as any]: `${i * 0.08}s` }}>
                <div className="flex items-center justify-between text-[12px] font-mono text-faint"><span>{s.n}</span><span>step</span></div>
                <div className="my-8 h-[120px] flex items-center justify-center">{s.art}</div>
                <h3 className="text-[24px] font-normal">{s.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-mute">{s.d}</p>
              </div>
            </Spotlight>
          ))}
        </div>
      </section>

      {/* ───────────── EXPLORER vs YOU ───────────── */}
      <section className="relative border-y border-line bg-panel/40">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-9 py-28 grid gap-12 lg:grid-cols-2 items-center">
          <div className="reveal">
            <p className="text-[12px] uppercase tracking-[0.2em] text-accent-hi">What leaves your device</p>
            <h2 className="mt-5 text-[34px] sm:text-[52px] font-light leading-[1.02]">The chain sees a valid proof.<br /><span className="text-mute">You see the receipt.</span></h2>
            <p className="mt-6 max-w-lg text-soft leading-relaxed">
              The explorer shows that <span className="font-mono text-[14px] text-foreground">transact()</span> ran and the pool still balances.
              Sender, recipient and amount are sealed in Poseidon commitments. Share a receipt when you choose to; anyone can check it at <Link href="/verify" className="link-u text-foreground">/verify</Link>.
            </p>
          </div>
          <div className="reveal grid sm:grid-cols-2 gap-4" style={{ ["--d" as any]: "0.12s" }}>
            <TxPanel title="MonadVision" sub="public" sealed />
            <TxPanel title="Your receipt" sub="private" />
          </div>
        </div>
      </section>

      {/* ───────────── USE CASES ───────────── */}
      <section id="use" className="mx-auto max-w-[1320px] px-5 sm:px-9 py-28 sm:py-36 scroll-mt-24">
        <div className="reveal mb-12">
          <p className="text-[12px] uppercase tracking-[0.2em] text-accent-hi">Use cases</p>
          <h2 className="mt-5 text-[34px] sm:text-[52px] font-light leading-none">Built for money that shouldn&apos;t be public.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <UseCase k="Payroll" t="Pay a team from a CSV" d="One run, one proof per row, resumable if your laptop dies. Contractors without Veil get claim links. In USDC or Agora AUSD."
            rows={[["Alice · design", "4,800"], ["Kris · eng", "6,250"], ["Romeo · ops", "3,600"]]} />
          <UseCase k="Creator streams" t="Pay KOLs for real reach" d="Founders fund a StreamVault. Chainlink CRE checks X impressions by consensus and pays each creator a private note, with an 80/20 holdback."
            rows={[["@cryptokid · 142k views", "2,130"], ["@monad_insider · 89k", "1,790"]]} />
          <UseCase k="Agent wallets" t="Let agents pay, inside limits" d="`mm veil` gives a MetaMask Agent Wallet a private balance. Per-payment and daily caps are checked before any proof is built. Pays x402 APIs privately."
            rows={[["research-agent → api.quote", "0.01"], ["research-agent → data feed", "0.25"]]} mono />
          <UseCase k="Receipts" t="Prove one payment, reveal nothing else" d="Every note has a receipt: amount, key and blinding that hash to an on-chain leaf. Give it to an accountant; your other payments stay sealed."
            rows={[["leaf #42 · Poseidon match", "verified"]]} />
        </div>
      </section>

      {/* ───────────── GUARANTEES ───────────── */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-9 py-28 grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <div className="reveal">
            <p className="text-[12px] uppercase tracking-[0.2em] text-accent-hi">Guardrails</p>
            <h2 className="mt-5 text-[34px] sm:text-[52px] font-light leading-[1.02]">Control lives in the contract,<br /><span className="text-mute">not with us.</span></h2>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {[
              ["No admin withdraw", "The pool owner can pause new deposits. It can never move or freeze your notes."],
              ["One passkey, many keys", "Face ID derives your funding wallet, spending key, audit key and agent keys. No seed phrase."],
              ["Proofs on your device", "Groth16 over BN254, verified on-chain. Your keys and amounts never leave the browser."],
              ["Roots never expire", "Every Merkle root stays valid, so a slow proof is never rejected for being stale."],
            ].map(([t, d], i) => (
              <li key={t} className="reveal border-t border-line pt-5" style={{ ["--d" as any]: `${i * 0.08}s` }}>
                <h3 className="text-[19px] font-normal tracking-[-0.02em]">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-mute">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────────── DEVELOPERS ───────────── */}
      <section id="dev" className="mx-auto max-w-[1320px] px-5 sm:px-9 py-28 scroll-mt-24 grid gap-12 lg:grid-cols-2 items-center">
        <div className="reveal">
          <p className="text-[12px] uppercase tracking-[0.2em] text-accent-hi">Developers</p>
          <h2 className="mt-5 text-[34px] sm:text-[52px] font-light leading-[1.02]">Private payments in a few lines.</h2>
          <p className="mt-6 max-w-lg text-soft leading-relaxed">
            <span className="font-mono text-[14px] text-foreground">@veil/sdk</span> syncs the pool, picks notes, proves and relays. The same client powers this app, the MetaMask plugin and the x402 merchant.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-[13px]">
            <a href={addressUrl(POOLS.USDC.address)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm font-mono">USDC pool {POOLS.USDC.address.slice(0, 6)}…{POOLS.USDC.address.slice(-4)} ↗</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Source on GitHub ↗</a>
          </div>
        </div>
        <CodeTabs />
      </section>

      {/* ───────────── CTA ───────────── */}
      <section className="relative overflow-hidden border-t border-line">
        <div aria-hidden className="absolute inset-0 opacity-80" style={{ background: "radial-gradient(40% 60% at 50% 110%, rgba(131,110,249,0.35), transparent 70%)" }} />
        <div className="relative mx-auto max-w-[1320px] px-5 sm:px-9 py-32 sm:py-44 text-center">
          <div className="reveal mx-auto mb-8 w-fit text-foreground"><LogoMark size={56} /></div>
          <h2 className="reveal text-[44px] sm:text-[88px] font-light leading-[0.98] tracking-[-0.045em]">Put a veil on it.</h2>
          <p className="reveal mt-6 text-soft text-[17px]">Free on testnet. Sign in with a passkey, no wallet extension needed.</p>
          <div className="reveal mt-10"><button onClick={launch} disabled={busy} className="btn btn-ink btn-lg">{busy ? "Waiting for passkey…" : "Launch app ↗"}</button></div>
        </div>
      </section>

      {/* ───────────── FOOTER ───────────── */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-9 py-14 grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr_1fr] text-[14px]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-mute">Private payments on Monad. Built for Monad Metropolis, Track 04: Trust, Identity &amp; AI Infra.</p>
          </div>
          <FooterCol title="Product" links={[["Vault", "/vault"], ["Payroll", "/payroll"], ["Campaigns", "/campaigns"], ["Verify a receipt", "/verify"]]} />
          <FooterCol title="Protocol" links={[["Transparency", "/transparency"], ["Pool contract", addressUrl(POOLS.USDC.address)], ["Source", REPO]]} />
          <FooterCol title="Docs" links={[["Privacy model", `${REPO}/blob/main/docs/PRIVACY-MODEL.md`], ["Threat model", `${REPO}/blob/main/docs/THREAT-MODEL.md`], ["Prior art", `${REPO}/blob/main/docs/PRIOR-ART.md`]]} />
        </div>
        <div className="mx-auto max-w-[1320px] px-5 sm:px-9 pb-10 text-[12px] text-faint flex flex-wrap justify-between gap-3">
          <span>Testnet software. Unaudited. Don&apos;t put real money in it.</span>
          <span>Proofs are generated on your device. Veil never holds your keys.</span>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-faint mb-4">{title}</p>
      <ul className="space-y-2.5">
        {links.map(([l, h]) => (
          <li key={l}>{h.startsWith("/") ? <Link href={h} className="link-u text-soft hover:text-foreground">{l}</Link> : <a href={h} target="_blank" rel="noreferrer" className="link-u text-soft hover:text-foreground">{l}</a>}</li>
        ))}
      </ul>
    </div>
  );
}

function UseCase({ k, t, d, rows, mono }: { k: string; t: string; d: string; rows: [string, string][]; mono?: boolean }) {
  return (
    <Spotlight className="reveal veil-hover p-7 sm:p-9">
      <div className="flex items-center justify-between">
        <span className="text-[12px] uppercase tracking-[0.18em] text-accent-hi">{k}</span>
        <span className="text-[11px] text-faint opacity-0 group-hover:opacity-100 transition-opacity duration-500">your view</span>
      </div>
      <h3 className="mt-5 text-[26px] sm:text-[30px] font-light leading-tight">{t}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-mute max-w-lg">{d.split("`").map((p, i) => i % 2 ? <span key={i} className="font-mono text-[13px] text-soft">{p}</span> : p)}</p>
      <div className="mt-7 divide-y divide-line rounded-xl border border-line bg-black/30">
        {rows.map(([a, b], i) => (
          <div key={a} className={`flex items-center justify-between px-4 py-3 text-[13px] ${mono ? "font-mono" : ""}`}>
            <Veiled mode="group" delay={i * 0.6}><span className="text-soft">{a}</span></Veiled>
            <Veiled mode="group" delay={i * 0.6 + 0.3}><span className="tnum text-foreground">{b}</span></Veiled>
          </div>
        ))}
      </div>
    </Spotlight>
  );
}

function TxPanel({ title, sub, sealed }: { title: string; sub: string; sealed?: boolean }) {
  const rows: [string, string][] = [["method", "transact()"], ["from", "0x7099…79C8 (relayer)"], ["to", "VeilPool"], ["sender", "Treasury · Acme"], ["recipient", "alice.veil"], ["amount", "4,800.00 USDC"]];
  return (
    <div className={`rounded-2xl border p-5 ${sealed ? "border-line bg-black/50" : "border-accent/40 bg-accent-soft"}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[14px]">{title}</span>
        <span className={`text-[11px] uppercase tracking-[0.14em] ${sealed ? "text-faint" : "text-accent-hi"}`}>{sub}</span>
      </div>
      <dl className="space-y-2.5 font-mono text-[12px]">
        {rows.map(([k, v], i) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-faint">{k}</dt>
            <dd className="text-right text-soft truncate">{sealed && i >= 3 ? <Veiled open={false} mode="group" delay={i * 0.4}><span>{v}</span></Veiled> : v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ArtShield() {
  return (
    <div className="relative h-24 w-44">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded-md border border-line-strong px-2.5 py-1.5 font-mono text-[11px] text-soft" style={{ animation: "art-slide 3.6s var(--ease) infinite" }}>10.00 USDC</div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 h-16 w-20 rounded-lg bg-black ring-1 ring-white/10 flex items-center justify-center">
        <div className="h-1 w-10 rounded-full bg-accent" style={{ animation: "veil-pulse 3.6s infinite" }} />
      </div>
      <style>{`@keyframes art-slide{0%,15%{transform:translate(0,-50%);opacity:1}55%{transform:translate(92px,-50%);opacity:0}56%,100%{transform:translate(0,-50%);opacity:0}70%,100%{opacity:1}}`}</style>
    </div>
  );
}

function ArtProof() {
  return (
    <div className="w-48 font-mono text-[11px] text-mute">
      <div className="flex justify-between mb-2"><span>groth16.prove</span><span className="text-accent-hi">on device</span></div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ animation: "art-bar 3.2s var(--ease) infinite" }} /></div>
      <div className="mt-3 grid grid-cols-6 gap-1">{Array.from({ length: 12 }).map((_, i) => <span key={i} className="h-2 rounded-[2px] bg-black ring-1 ring-white/10" style={{ animation: `veil-pulse 3.2s ${i * 0.12}s infinite` }} />)}</div>
      <style>{`@keyframes art-bar{0%{width:0}70%,100%{width:100%}}`}</style>
    </div>
  );
}

function ArtClaim() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-md border border-line-strong px-3 py-1.5 font-mono text-[11px] text-soft">veil.app/claim#<Veiled delay={0.4}><span>9f2c…e1</span></Veiled></div>
      <div className="h-6 w-px bg-gradient-to-b from-line-strong to-transparent" />
      <div className="rounded-md bg-accent-soft px-3 py-1.5 text-[11px] text-accent-hi">paid · 3.00 USDC</div>
    </div>
  );
}

function CodeTabs() {
  const [tab, setTab] = useState<"sdk" | "cli" | "x402">("sdk");
  const code = {
    sdk: `import { VeilPoolClient, formatAddress } from "@veil/sdk";

const pool = new VeilPoolClient(env, POOLS.USDC, keys);
await pool.sync();                       // trial-decrypt your notes

await pool.deposit(wallet, 10_000000n);  // shield 10 USDC
await pool.send("veil:0x2e62…", 4_000000n, prover);
await pool.withdraw("0xYourWallet", 1_000000n, prover);`,
    cli: `$ mm veil setup --chain-id 10143
$ mm veil guard set --per-payment 2 --daily 10 --expires 2026-12-31
$ mm veil pay --to veil:0x2e62… --amount 1 --chain-id 10143
  Generating zero-knowledge proof on this device…
  Private transfer sent: 0x9a1f…`,
    x402: `$ mm veil x402 fetch https://api.example/quote --max 0.05
  402: price 0.01. Checking guard policy...
  Generating zero-knowledge proof on this device…
  Retrying with PAYMENT-SIGNATURE...
  Received 200: {"quote":"Privacy is normal."}`,
  }[tab];
  return (
    <div className="reveal rounded-2xl border border-line bg-black/60 overflow-hidden" style={{ ["--d" as any]: "0.12s" }}>
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        {(["sdk", "cli", "x402"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-[12px] font-mono transition-colors ${tab === t ? "bg-surface text-foreground" : "text-mute hover:text-foreground"}`}>
            {t === "sdk" ? "@veil/sdk" : t === "cli" ? "mm veil" : "x402"}
          </button>
        ))}
        <span className="ml-auto flex gap-1.5 pr-1">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-surface-2" />)}</span>
      </div>
      <pre key={tab} className="rise p-5 sm:p-6 text-[12.5px] leading-[1.7] font-mono text-soft overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
}
