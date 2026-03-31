import { LayoutTemplate, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function TermsOfService() {
  return (
    <div className="w-full h-screen overflow-y-auto relative z-10 pt-4 pb-24">
      <main className="max-w-4xl mx-auto px-6 py-16 animate-in fade-in duration-700">
      <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-8 transition-colors text-xs font-bold uppercase tracking-widest">
        <ArrowLeft className="w-4 h-4" />
        Back to App
      </Link>
      
      <div className="flex flex-col mb-10">
        <h1 className="text-4xl font-black text-white tracking-tight">Terms of Service</h1>
        <p className="text-white/40 font-medium mt-1">Last Updated: March 2026</p>
      </div>

      <div className="prose prose-invert prose-p:text-white/60 prose-headings:text-white prose-headings:font-bold prose-a:text-[var(--color-accent-blue)] max-w-none space-y-8 glass-panel bg-black/40 backdrop-blur-2xl p-8 md:p-12 border border-white/10 rounded-3xl shadow-2xl relative">
        <div className="absolute inset-0 bg-black/60 -z-10 rounded-3xl pointer-events-none" />
        
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing and using Thinkly ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>Thinkly is an AI-powered workflow automation copilot that allows users to design, test, and execute automations integrating various third-party APIs (including OpenAI, Gmail, and Google Sheets). The Service acts primarily as an orchestrator for your data.</p>
        </section>

        <section>
          <h2>3. Acceptable Use Policy</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-5 text-white/60 space-y-2">
            <li>Generate or distribute unsolicited communications, spam, or malicious content (particularly via the Gmail integration).</li>
            <li>Intentionally create infinite execution loops that degrade server performance (DDoS).</li>
            <li>Violate any applicable local, state, national, or international law.</li>
            <li>Attempt to bypass or exploit the Service's security measures.</li>
          </ul>
        </section>

        <section>
          <h2>4. AI and Automation Liability</h2>
          <p>Due to the nature of Large Language Models (LLMs) and automated workflows, outputs and execution paths can occasionally be unpredictable. <strong>You are solely responsible for verifying the safety and accuracy of any automation workflow before enabling it.</strong> Thinkly is not liable for data loss, incorrect emails sent, or API quota exhaustion resulting from workflow execution.</p>
        </section>

        <section>
          <h2>5. Third-Party Services</h2>
          <p>The Service relies on third-party APIs (such as Google Workspace and OpenAI). Your use of these integrations is governed by their respective Terms of Service. Thinkly makes no guarantees regarding the uptime, availability, or continued functionality of these third-party platforms.</p>
        </section>

        <section>
          <h2>6. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Thinkly and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.</p>
        </section>

        <section>
          <h2>7. Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. We will notify users of significant changes through the application interface.</p>
        </section>
      </div>
      </main>
    </div>
  )
}
