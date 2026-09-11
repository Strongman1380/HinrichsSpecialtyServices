import { CheckCircle2, Settings, ShieldCheck } from "lucide-react";

const environment = [
  ["VITE_FIREBASE_*", "Firebase web application configuration"],
  ["ANTHROPIC_API_KEY", "Chat assistant and administrator survey builder"],
  ["SENDGRID_API_KEY", "Invoice and campaign email delivery when enabled"],
  ["SENDGRID_FROM_EMAIL", "Verified email sender"],
  ["SENDGRID_FROM_NAME", "Name displayed on outgoing email"],
  ["ALLOWED_ORIGIN", "Comma-separated production and local origins"],
];

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <div className="mb-2 flex items-center gap-2 text-blue-600"><Settings size={20} /><span className="text-sm font-semibold">Platform settings</span></div>
        <h1 className="text-2xl font-bold text-slate-800">Configuration</h1>
        <p className="mt-1 text-slate-500">Operational settings are stored securely in Firebase and the deployment environment.</p>
      </header>

      <section className="card-dark rounded-xl p-6">
        <h2 className="mb-2 font-semibold text-slate-800">Manual payment policy</h2>
        <p className="text-sm leading-6 text-slate-500">Invoices use a manual payment workflow. Record payments in the Payments section after receiving Venmo, Cash App, Zelle, check, wire, cash, or another agreed method.</p>
        <div className="mt-4 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={20} className="shrink-0" />
          <p>Invoices show accepted methods but never publish private account handles or banking instructions. Confirm those details directly with each client.</p>
        </div>
      </section>

      <section className="card-dark rounded-xl p-6">
        <div className="mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-blue-600" /><h2 className="font-semibold text-slate-800">Required environment variables</h2></div>
        <div className="space-y-2">
          {environment.map(([key, description]) => (
            <div key={key} className="grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[180px_1fr]">
              <code className="text-xs font-bold text-blue-700">{key}</code>
              <span className="text-sm text-slate-500">{description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        Never paste secret keys, payment handles, account numbers, or passwords into Firestore records or client-visible fields.
      </section>
    </div>
  );
}
