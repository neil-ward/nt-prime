import Link from "next/link";
import VersionPicker from "@/components/VersionPicker";

const DATASETS = [
  {
    key: "A",
    label: "Mercy, Justice & Generosity",
    count: 136,
    color: "var(--color-ds-a)",
    muted: "var(--color-ds-a-muted)",
    description:
      "Commands to show compassion, care for the poor, forgive debts, and pursue justice. Drawn primarily from the Sermon on the Mount, the prophetic ethics tradition, and Pauline social teaching.",
  },
  {
    key: "B",
    label: "Core Doctrine & Belief",
    count: 149,
    color: "var(--color-ds-b)",
    muted: "var(--color-ds-b-muted)",
    description:
      "Commands grounding the faith: repentance, belief, baptism, perseverance, sound doctrine, and spiritual warfare. These form the backbone of evangelical catechesis and confessional documents.",
  },
  {
    key: "D",
    label: "Social Codes & Liturgy",
    count: 100,
    color: "var(--color-ds-d)",
    muted: "var(--color-ds-d-muted)",
    description:
      "Commands governing community life — household relationships, church order, worship practices, and moral purity. Includes the Pauline household codes, liturgical directives, and congregational ethics.",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col">

      {/* Hero */}
      <section className="flex-1 flex flex-col justify-center px-6 lg:px-20 py-20 max-w-5xl mx-auto w-full">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-4">
          Research Project
        </p>
        <h1 className="text-4xl sm:text-5xl font-serif text-stone-900 leading-tight mb-6 max-w-3xl">
          What does the New Testament actually emphasize?
        </h1>
        <p className="text-stone-500 text-base leading-relaxed max-w-2xl mb-10">
          385 NT commands, classified across three research datasets, scored for
          rhetorical strength, and cross-referenced against the passages most
          cited in SBC doctrinal literature. An independent, data-driven look at
          the shape of NT ethics.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            Compare datasets
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded border border-stone-300 text-stone-600 text-sm font-medium hover:border-stone-400 hover:text-stone-900 transition-colors"
          >
            Explore patterns
          </Link>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded border border-stone-300 text-stone-600 text-sm font-medium hover:border-stone-400 hover:text-stone-900 transition-colors"
          >
            Browse all passages
          </Link>
        </div>
      </section>

      {/* Version selector */}
      <section className="border-t border-stone-200 px-6 lg:px-20 py-10 max-w-5xl mx-auto w-full">
        <div className="flex items-baseline gap-4 mb-5 flex-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Your Bible Translation
          </p>
          <p className="text-[11px] text-stone-500">
            Select the translation used for verse text and deep links
          </p>
        </div>
        <VersionPicker />
      </section>

      {/* Dataset cards */}
      <section className="border-t border-stone-200 px-6 lg:px-20 py-14 max-w-5xl mx-auto w-full">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-8">
          Three datasets
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {DATASETS.map((ds) => (
            <div
              key={ds.key}
              className="rounded-md p-5 border"
              style={{ backgroundColor: ds.muted, borderColor: ds.color + "44" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded text-white"
                  style={{ backgroundColor: ds.color }}
                >
                  {ds.key}
                </span>
                <span className="text-[11px] font-medium text-stone-500">
                  {ds.count} commands
                </span>
              </div>
              <h3
                className="text-sm font-serif font-semibold mb-2"
                style={{ color: ds.color }}
              >
                {ds.label}
              </h3>
              <p className="text-[12px] text-stone-600 leading-relaxed">
                {ds.description}
              </p>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
