import { Zap, ArrowRight } from "lucide-react"

const TEMPLATES = [
  {
    title: "Outbound Lead Generation",
    description: "Extract leads from Apollo, qualify via criteria, and push to HubSpot & Instantly.",
    prompt: "I want to export leads from Apollo.io matching my ICP, enrich them to find if they use Next.js, and then push qualified ones to HubSpot and set up an email sequence in Instantly.ai."
  },
  {
    title: "Customer Onboarding Sync",
    description: "When a new Stripe customer is created, provision a workspace and send a generic welcome email.",
    prompt: "When a new customer subscribes on Stripe, automatically create a new project in Linear, invite them via email, and send a welcome message in our internal Slack channel."
  },
  {
    title: "Social Media Cross-Posting",
    description: "Publish blog posts automatically to Twitter, LinkedIn, and Facebook with AI tailored captions.",
    prompt: "Every time a new Ghost blog post is published, read the content, generate a Twitter thread, a LinkedIn professional post, and a Facebook summary, and schedule them via Buffer."
  },
  {
    title: "Support Ticket Triage",
    description: "Categorize incoming Zendesk tickets instantly using AI and assign to the right team.",
    prompt: "Read incoming Zendesk tickets, categorize them into 'Bug', 'Billing', or 'Feature Request' using AI, and assign them to the respective team channels in Slack with priority scores."
  }
]

export function AITemplatesView({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">AI Templates</h2>
        <p className="text-white/60 font-medium">Click a pre-built automation blueprint to instantly load it into your builder.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATES.map((tmpl, i) => (
          <div 
            key={i} 
            onClick={() => onSelect(tmpl.prompt)}
            className="glass-panel p-6 bg-gradient-to-br from-black/40 to-black/60 hover:from-[var(--color-accent-purple)]/10 hover:to-[var(--color-accent-blue)]/10 backdrop-blur-xl border border-white/5 hover:border-[var(--color-accent-purple)]/30 shadow-lg cursor-pointer transition-all duration-300 group flex flex-col"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-[var(--color-accent-purple)]/20 text-[var(--color-accent-purple)] shadow-sm">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="text-white font-bold text-lg">{tmpl.title}</h4>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-6 flex-1">{tmpl.description}</p>
            <div className="flex justify-end mt-auto">
              <span className="flex items-center text-sm font-medium text-[var(--color-accent-blue)] group-hover:translate-x-1 transition-transform">
                Use Template <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
