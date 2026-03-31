import { ShieldCheck, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function PrivacyPolicy() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 animate-in fade-in duration-700">
      <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-8 transition-colors text-xs font-bold uppercase tracking-widest">
        <ArrowLeft className="w-4 h-4" />
        Back to App
      </Link>
      
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Privacy Policy</h1>
          <p className="text-white/40 font-medium mt-1">Last Updated: March 2026</p>
        </div>
      </div>

      <div className="prose prose-invert prose-p:text-white/60 prose-headings:text-white prose-headings:font-bold prose-a:text-[var(--color-accent-blue)] max-w-none space-y-8 glass-panel bg-black/40 backdrop-blur-2xl p-8 md:p-12 border border-white/10 rounded-3xl shadow-2xl relative">
        <div className="absolute inset-0 bg-black/60 -z-10 rounded-3xl pointer-events-none" />
        
        <section>
          <h2>1. Introduction</h2>
          <p>Welcome to Thinkly AI Workflow Copilot ("we", "our", "us"). We are committed to protecting your privacy and ensuring you have complete control over your automation integrations. This Privacy Policy details how we collect, use, and protect your data.</p>
        </section>

        <section className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20">
          <h2 className="text-blue-400 !mt-0">2. Google Workspace API Data Usage (Important)</h2>
          <p>Thinkly requests access to sensitive Google APIs (such as Gmail and Google Sheets) solely to execute automation workflows defined by the user.</p>
          <ul className="space-y-2 mt-4 text-white/70 list-disc pl-5">
            <li><strong>Limited Use Guarantee:</strong> Thinkly's use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</li>
            <li><strong>No AI Training:</strong> We explicitly DO NOT use any user data obtained via Google Workspace APIs (including emails, sheet data, or tokens) to develop, improve, or train generalized Artificial Intelligence (AI) and/or Machine Learning (ML) models.</li>
            <li><strong>Execution Only:</strong> Your Gmail and Google Sheets data is accessed in-memory purely to execute your requested step in a workflow, and is never persistently stored, scraped, or sold.</li>
          </ul>
        </section>

        <section>
          <h2>3. Data Collection and Security</h2>
          <p>We collect minimal information necessary to provide the Thinkly service:</p>
          <ul className="list-disc pl-5 text-white/60 space-y-2">
            <li><strong>Authentication Data:</strong> Your email address when logging in via Supabase.</li>
            <li><strong>OAuth Tokens:</strong> When you connect third-party integrations (like Google Workspace or OpenAI), we securely store the required access and refresh tokens.</li>
          </ul>
          <p className="mt-4 font-bold text-emerald-400">Security Encryption Protocol</p>
          <p>All third-party integration tokens are encrypted at rest in our database using industry-standard <strong>AES-256 encryption</strong>. The master decryption key is securely stored in our cloud environment and is never exposed to the client.</p>
        </section>

        <section>
          <h2>4. Data Retention and Deletion</h2>
          <p>You may revoke Thinkly's access to your Google Account at any time via your Google Account Security settings. If you delete a workflow or disconnect an integration within Thinkly, we immediately delete the corresponding encrypted tokens from our active database.</p>
        </section>

        <section>
          <h2>5. Contact Us</h2>
          <p>If you have any questions or concerns regarding this Privacy Policy or how your data is handled, please contact us at: <strong>letshashankknow@gmail.com</strong></p>
        </section>
      </div>
    </main>
  )
}
