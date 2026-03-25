# Thinkly - The AI Workflow Copilot
### Assignment Submission | Software Engineering Role | Thinkly Labs

[![Vercel Deployment](https://img.shields.io/badge/Vercel-View_Live_Demo-white?logo=vercel&logoColor=black&style=for-the-badge)](https://thinkly-ai.vercel.app)
[![GitHub Repo](https://img.shields.io/badge/GitHub-View_Source-181717?logo=github&style=for-the-badge)](https://github.com/Shashank519915/Thinkly)

*P.S.: I used my Gemini API key and for google(Gmail + Sheet) integration for automation, I used my gmail OAuth 2.0 Playground y29 accesstoken, as this app is currently not verified on OAuth, hence i would have to add every email in test email. So, the flow is for integrations of goole products, put the latest y29 accesstoken, as it also gets expired every 1 hour so you have to refresh it.*

*P.S.: This does not affect Google login on main page for current user, as that is powered by Supabase's Google OAuth Sign-in Provider. That segment works seamlessly, saving user data.*

---

## The Assignment Evolution: From Chatbot to Copilot
The core assignment was to build a purpose-built chatbot. However, a modern chatbot should be more than a conversation wrapper—it should be an **Actionable Agent**. 

I evolved the prompt into **Thinkly**, an AI Workflow Copilot. Instead of just answering questions, Thinkly:
1.  **Translates** conversational intent into structured logic.
2.  **Architects** a full Directed Acyclic Graph (DAG) of multi-step automation.
3.  **Refines** the workflow interactively through a dedicated **System Design Chatbot**.

---

## The Intelligence Stack
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-8E75C2?style=for-the-badge&logo=google-gemini&logoColor=white)](https://deepmind.google/technologies/gemini/)

---

---

## Phase 1: Research & Problem Identification
My goal was to find a problem that "clicked." I didn't settle on the first idea.

- **Iteration Loop**: I used ChatGPT to brainstorm 5 different personas (e.g., a "Stoic Philosophy Bot," a "Medical Billing Assistant," a "Sales Lead Guru", a Cinematography Expert). 
- **The "Finalist"**: I chose **Sales Lead Management** because it perfectly bridges the gap between unstructured data (unorganized emails) and structured business value (Google Sheets / CRM).
- **Thinkly Labs Alignment**: I researched Thinkly Labs' own product focus. By building a tool that "blueprints" systems, I am demonstrating a direct understanding of agentic orchestration—the core of Thinkly Labs' DNA.

---

## Phase 2: Design Philosophy - "Liquid Glass" UI
"Frontend Thinking" isn't just about colors; it's about **reducing the user's cognitive load** during complex AI interactions.

### The Liquid Glass System
Built with React, GSAP, and Framer Motion, this design language focuses on **"Active Feedback"**:
- **Non-Static Surfaces**: Using blurred overlays and dynamic gradients inspired by modern macOS design.
- **Micro-Animations**: Every node generation in the graph is accompanied by "Trace Animations," visually confirming that the AI is linking data correctly.
- **Empty State UX**: Instead of "No workflows found," I designed an onboarding-focused empty state that guides the user to their first generation, complete with "Magic Suggestion" tiles.

![Dashboard Overview - Liquid Glass Interaction](https://github.com/user-attachments/assets/bb2d533d-76c4-472c-b89a-871618318327)
![Current Workflow View](https://github.com/user-attachments/assets/da1bc144-12ae-412d-bee9-4265458868c8)
![Current Workflow View 2](https://github.com/user-attachments/assets/d8808c5c-9379-4fd6-a954-de876ff064ce)
![Current Workflow View 3](https://github.com/user-attachments/assets/644b2829-ea9c-4deb-a068-24144c435e5a)
![Integrations Hub View](https://github.com/user-attachments/assets/61f1fb65-9fe0-4240-80ed-bbf3076915b4)
![Automations Hub View](https://github.com/user-attachments/assets/3fd954c0-2d2a-4d67-9861-d0ae78203d9c)

---

## Phase 3: Engineering Depth & AI Hardening

### 1. The "Chatbot" Requirement: Meet the Refinement Agent
While Thinkly generates full workflows, the **Chat Interface** remains a core pillar of the experience—fulfilling the original assignment's chatbot requirement in a highly specialized way.

**The Refinement Chatbot** is a purpose-built assistant for **Workflow Engineering**:
- **Context-Aware Modification**: After the initial generation, you can chat with the workflow. Ask: *"Can you add a Slack notification if the lead score is > 80?"* or *"Change the Gmail trigger to look for 'Urgent' in the subject line."*
- **Delta Patching**: The bot doesn't just rewrite everything; it intelligently patches the existing node tree, maintaining state while evolving the logic.
- **Conversational Reasoning**: If a requested change is unfeasible (e.g., a tool that isn't connected), the bot will explain why and suggest an alternative architectural approach.

![Refinement Chat - Interactive System Modification](https://github.com/user-attachments/assets/0a875a6e-bd39-46e5-ab9e-e1f57c35e51c)
![Refinement Chat - Interactive System Modification](https://github.com/user-attachments/assets/546e6604-5a57-4c78-8d3b-5f6a7f2f0517)

### 2. Robust AI Extraction (Response Hardening)
LLMs occasionally hallucinate syntax. In `lib/ai/responseParser.ts`, I built a **Syntax Sanitizer Pipeline**:
- **Markdown Stripping**: Automatically removes markdown code fences (` ```json `) to prevent `JSON.parse` failures.
- **Concatenation Fixing**: I detected a common Gemini hallucination where it uses Javascript-style `+` concatenation inside JSON strings. My parser automatically merges these into single valid JSON strings before execution.

### 3. "Smart Injector" Technology
To make the AI feel "intelligent," the system must compensate for human error. 
- **The Problem**: A user might prompt "Summary this email" but forget to link the actual email data variable.
- **The Logic**: I built a detector that checks if the AI prompt is "data-starved." If it is, the system **automatically injects** the appropriate Gmail/Context payload into the prompt, ensuring the AI always has the context it needs to succeed.

### 4. Human-In-The-Loop (HITL)
True automation isn't 100% autonomous—it requires trust. Every Thinkly blueprint is designed with **Human Review nodes**. 
- **Example**: In a lead-qualifying workflow, the AI summarizes the lead but **pauses** the execution for a manual "Approval" before sending a high-stakes response.

![Graph Architecture](https://github.com/user-attachments/assets/994f6517-adb2-480f-9c9d-7627daa251b9)

---

## Architectural Roadmap: Towards Scale

### Current Implementation: Context-Aware Polling
To manage API costs and prevent background "rate-limit runaway," Thinkly currently uses **Tab-Visibility Polling**. Triggers are active only when the user is viewing the dashboard.

### Future Scale: The Worker-Bot Model
For a true production environment, I propose a transition to a **Headless Worker Architecture**:
- **Queue Layer (BullMQ + Redis)**: Triggers (Webhooks, Cron) are pushed to a Redis-backed queue.
- **Execution Workers**: Standalone Node.js workers consume the queue and execute the `runner.ts` logic 24/7.
- **Socket.io Streaming**: Live execution logs would be streamed back to the UI in real-time, regardless of the user's tab state.

---

## How I Built This (AI Pair Programming)
I utilized **Antigravity** and **Google Stitch** as my high-speed engineering partners.

- **Prompting Mastery (Role-Based & Negative Steering)**:
  - **In-App Logic**: I architected the `promptBuilder.ts` to enforce a "Senior Workflow Architect" persona on Gemini, using **Negative Prompting** to strictly forbid generic, non-agentic patterns (e.g., "NEVER use polling—always use event-driven triggers"). Well defined response format expectaions were provided in prompts like required response should be in a very specific strict JSON format.
  - **Development Strategy**: When directing **Antigravity**, I didn't just ask for features; I provided **Rich Architectural Context** and used **Role Explanation** to ensure the code followed production-grade principles. By using specific exclusion rules, I steered the AI away from "lazy" solutions and towards the sophisticated JSON-patching and vault-encryption models we adopted.
- **Manual Refinement & Edge-Case Hardening**:
  - While AI generated initial structures, I conducted **Rigorous Manual Testing** on the local dev server. This phase was essential for identifying and fixing subtle edge cases that static AI analysis often misses—such as the specialized regex for handling Gemini's JSON hallucinations and refining the OAuth token refresh lifecycle.
  - Majority of code was personally reviewed and refactored to maintain absolute architectural purity and system reliability.

---

## 🏁 Submission Final Links
- **Vercel Deployment**: [Thinkly](https://thinkly-ai.vercel.app)
- **Walkthrough Video**: [Loom Recording](https://drive.google.com/drive/folders/1TDzBg3lWG9mWAA5wW4-c_KHYFu3dj7U_?usp=sharing)
- **Contact**: [letshashankknow@gmail.com](mailto:letshashankknow@gmail.com)

*Thinkly - Built with precision, engineered for action.*
