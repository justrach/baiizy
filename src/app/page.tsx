import Link from "next/link";

const intents = [
  "quiet cafe to work from",
  "late-night supper near me",
  "good date spot nearby",
  "cheap lunch around this office",
  "low-pressure friend hang nearby",
];

const productLoops = [
  {
    label: "Intent",
    title: "Start with what the person is trying to do",
    body: "A search like quiet cafe to work from carries social context. The app should preserve that context instead of flattening everything into nearby places.",
  },
  {
    label: "Place",
    title: "Rank for usefulness, not just distance",
    body: "The best place is the one that supports the plan: talkability, noise, price, seating, exit ease, and whether it can become a routine.",
  },
  {
    label: "People",
    title: "Make the next ask small",
    body: "The people layer should help someone invite one or two compatible people into a low-pressure table, not push everyone into another event feed.",
  },
  {
    label: "Repeat",
    title: "Turn one hang into a social loop",
    body: "A recurring lunch, walk, work sprint, or shelf browse is the durable product outcome. Discovery is only the start.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4efe3] text-[#172019]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(215,156,82,0.28),transparent_30%),radial-gradient(circle_at_82%_16%,rgba(31,107,93,0.18),transparent_28%)]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-[#172019]/10 bg-[#fffaf0]/80 px-4 py-3 shadow-[0_18px_70px_rgba(33,29,21,0.08)] backdrop-blur">
          <Link href="/" className="flex items-center gap-3" aria-label="Baiizy home">
            <span className="grid size-10 place-items-center rounded-full bg-[#172019] text-sm font-black text-[#fffaf0]">
              B
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.24em]">Baiizy</span>
              <span className="block text-xs font-bold text-[#667064]">places to people to repeat</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/users"
              className="rounded-full border border-[#172019]/10 bg-[#fffaf0] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#39443b] transition hover:border-[#1f6b5d] hover:text-[#1f6b5d]"
            >
              Login
            </Link>
            <Link
              href="/maps"
              className="rounded-full bg-[#172019] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#fffaf0] transition hover:bg-[#2c382f]"
            >
              Open maps lab
            </Link>
          </nav>
        </header>

        <section className="grid min-h-[calc(100vh-8rem)] items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-[#172019]/10 bg-[#fffaf0]/80 px-4 py-2 text-sm font-black text-[#4f5a51] shadow-sm">
              Intent-aware local discovery
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl font-serif text-6xl font-black leading-[0.9] tracking-[-0.08em] sm:text-7xl lg:text-8xl">
                Find places that make the next hang easier.
              </h1>
              <p className="max-w-2xl text-lg font-bold leading-8 text-[#4f5a51] sm:text-xl">
                Baiizy is a prototype for local discovery that optimizes for follow-through. It uses place intent to
                suggest where to meet, who to invite, and how to make the plan repeatable.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/maps"
                className="rounded-2xl bg-[#1f6b5d] px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-[#fffaf0] transition hover:bg-[#255f55]"
              >
                Test raw GrabMaps
              </Link>
              <Link
                href="/users"
                className="rounded-2xl bg-[#d79c52] px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-[#172019] transition hover:bg-[#e8b86e]"
              >
                Set preferences
              </Link>
              <a
                href="#concept"
                className="rounded-2xl border border-[#172019]/15 bg-[#fffaf0]/80 px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-[#172019] transition hover:border-[#172019]"
              >
                See concept
              </a>
            </div>
          </div>

          <aside className="rounded-[2.4rem] border border-[#172019]/10 bg-[#172019] p-4 text-[#fffaf0] shadow-[0_30px_100px_rgba(23,32,25,0.28)]">
            <div className="rounded-[1.8rem] border border-[#fffaf0]/10 bg-[#223229] p-5">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-[#d7c9a8]">Example flow</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">Sunday shelf browse</h2>
                </div>
                <span className="rounded-full bg-[#d79c52] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#172019]">
                  low pressure
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {[
                  ["User intent", "I want to meet people, but not at a loud event."],
                  ["Place", "A calm bookstore cafe with tables, browsing, and no pressure to perform."],
                  ["People", "Three nearby people open to parallel reading and short conversation."],
                  ["Ask", "Want to browse for 20 minutes and read for 40? No pressure to talk the whole time."],
                  ["Ritual", "Every other Sunday, one shared recommendation."],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl bg-[#fffaf0]/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7c9a8]">{label}</p>
                    <p className="mt-2 text-base font-black leading-7">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section id="concept" className="grid gap-4 pb-10 md:grid-cols-2 lg:grid-cols-4">
          {productLoops.map((item) => (
            <article
              key={item.label}
              className="rounded-[1.8rem] border border-[#172019]/10 bg-[#fffaf0]/82 p-5 shadow-[0_18px_70px_rgba(44,37,24,0.08)] backdrop-blur"
            >
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b6522b]">{item.label}</p>
              <h2 className="mt-5 text-2xl font-black leading-7 tracking-[-0.04em]">{item.title}</h2>
              <p className="mt-4 text-sm font-bold leading-6 text-[#536055]">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-[2.2rem] border border-[#172019]/10 bg-[#fffaf0]/82 p-5 shadow-[0_18px_70px_rgba(44,37,24,0.08)]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6d2f]">Intent examples</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {intents.map((intent) => (
              <Link
                key={intent}
                href={`/maps?q=${encodeURIComponent(intent)}`}
                className="rounded-full border border-[#172019]/10 bg-[#f4efe3] px-4 py-2 text-sm font-black text-[#39443b] transition hover:border-[#172019] hover:text-[#172019]"
              >
                {intent}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
