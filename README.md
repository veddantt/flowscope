🚀 FlowScope — See How Systems Actually Work

Most developers design distributed systems. Very few can actually see them in motion.

FlowScope changes that by providing a high-fidelity, real-time simulation of distributed systems — visualizing latency, failures, and recovery mechanisms as they happen.

🌐 **Live Experience**
👉 [flowscope-path.vercel.app](https://flowscope-path.vercel.app/)

---

## ⚡ The Problem
Modern systems are distributed, asynchronous, and failure-prone. Yet, we still rely on static diagrams and logs to reason about them. None of these tools show the dynamic complexity of a system under stress in real time.

## 💡 The Idea
What if you could watch a request travel through your system? From the moment it hits the edge, through the gateway, auth, and service layers, into the queue, and finally the database — including every delay, retry, and failure along the path.

## 🎬 What FlowScope Does
FlowScope simulates a real-world architecture:
`Edge → Gateway → Auth → Router → Cache → Service → Queue → Database`

### ✨ Key Capabilities
- 🧭 **Trace Every Request:** Follow requests as they move across services in real time.
- ⏱ **Understand Latency:** See exactly where time is spent — and why p95 latency spikes.
- 🔁 **Observe Failures & Retries:** Watch cascading failures and recovery mechanisms unfold visually.
- 🎮 **Interactive Simulation:** Switch scenarios (Product Launch, DB Degradation) and watch the system adapt.
- 🧠 **AI-Powered Analysis:** Real-time narrative breakdown of system health and bottlenecks.

## 🏗 Architecture & Tech Stack
FlowScope is built with a high-performance reactive engine to ensure smooth 60fps animations even under high request load.

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Core:** React 19 (RC) + TypeScript
- **State:** [Zustand](https://github.com/pmndrs/zustand) (minimal, powerful state management)
- **Animation:** [Framer Motion](https://www.framer.com/motion/) (fluid system animations)
- **Styling:** Tailwind CSS + Glassmorphism
- **Deployment:** Vercel

## 🚀 Getting Started

1. **Clone the repo:**
   ```bash
   git clone https://github.com/veddantt/flowscope.git
   cd flowscope
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## 🎯 Design Philosophy
FlowScope is built on one core belief: **If you can see a system, you can understand it.** It's designed to be a "mental model engine" for backend engineers and architects.

---

👤 **Author: Vedant Patel**
GitHub: [@veddantt](https://github.com/veddantt)
