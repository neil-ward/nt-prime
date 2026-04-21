import Link from "next/link";

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ id, eyebrow, title, children }: {
  id?: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-stone-200 py-12">
      <div className="grid md:grid-cols-[200px_1fr] gap-8">
        <div className="pt-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">{eyebrow}</p>
        </div>
        <div>
          <h2 className="text-xl font-serif text-stone-900 mb-4 leading-snug">{title}</h2>
          <div className="prose-custom">{children}</div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Callout stat
// ---------------------------------------------------------------------------

function Callout({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-stone-200 rounded-md px-5 py-4 bg-white">
      <p className="text-3xl font-serif text-stone-900 leading-none mb-1">{value}</p>
      <p className="text-[11px] text-stone-500 leading-snug">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dataset definition card
// ---------------------------------------------------------------------------

function DsCard({
  ds, label, count, color, muted, children,
}: {
  ds: string; label: string; count: number; color: string; muted: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-5" style={{ borderColor: color + "44", backgroundColor: muted }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: color }}>
          {ds}
        </span>
        <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
        <span className="text-[11px] text-stone-400 ml-auto">{count} records</span>
      </div>
      <div className="text-[12px] text-stone-600 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body text helpers
// ---------------------------------------------------------------------------

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-stone-600 leading-relaxed mb-3">{children}</p>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboutPage() {
  return (
    <main className="flex-1 bg-stone-50">
      <div className="max-w-4xl mx-auto px-6 lg:px-10 pb-24">

        {/* Hero */}
        <div className="pt-14 pb-10 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Methodology & Background
          </p>
          <h1 className="text-4xl font-serif text-stone-900 leading-tight mb-4 max-w-2xl">
            About This Research
          </h1>
          <p className="text-stone-500 text-base leading-relaxed max-w-2xl">
            NT Prime is an independent, data-driven analysis of New Testament ethical
            commands — what the text actually emphasizes, in what rhetorical form, by
            whose voice, and how that compares to what appears in SBC doctrinal
            literature.
          </p>
        </div>

        {/* Key numbers */}
        <div className="py-10 border-b border-stone-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Callout value="385" label="total NT command records across all three datasets" />
            <Callout value="311" label="unique commands after deduplicating Gospel parallels" />
            <Callout value="183" label="passages tagged as commonly cited in SBC literature" />
            <Callout value="100" label="Dataset D records on social codes and liturgy" />
          </div>
        </div>

        {/* Research question */}
        <Section eyebrow="Motivation" title="What prompted this project?">
          <P>
            Debates about NT ethics often rely on selective citation — certain passages are
            treated as definitional while others are minimized or ignored. This project
            began as an attempt to map the full shape of NT imperatives: not just which
            commands exist, but how many there are, who speaks them, where they concentrate,
            and how directly they are framed.
          </P>
          <P>
            One primary question framed this research: Is the theological emphasis by
            contemporary authors/pastors reflective of the emphasis we see in the Bible?
          </P>
        </Section>

        {/* Datasets */}
        <Section eyebrow="Classification" title="How were the three datasets defined?">
          <P>
            Records were classified into three mutually exclusive datasets based on the
            primary ethical register of the command. Classification was done manually,
            with each record reviewed against its literary context, speaker, and NT
            section.
          </P>
          <div className="grid gap-4 mt-5">
            <DsCard ds="A" label="Mercy, Justice & Generosity" count={136}
              color="#2a9d8f" muted="#d4f0ed">
              <p>
                Commands to show compassion, care for the poor, forgive debts, practice
                economic generosity, and pursue justice. Drawn primarily from the Sermon
                on the Mount, the prophetic ethics tradition in the Epistles, and
                Pauline social teaching (Romans 12–15, Galatians 5–6).
              </p>
              <p>
                Jesus speaks 63 % of Dataset A. The remainder comes largely from Paul,
                James, and John. Dataset A has the most Narrative Example records of
                any dataset — many of these commands are embedded in parables or
                story-shaped teaching rather than direct directives.
              </p>
            </DsCard>
            <DsCard ds="B" label="Core Doctrine & Belief" count={149}
              color="#457b9d" muted="#daeaf3">
              <p>
                Commands grounding the faith itself: repentance, belief, baptism,
                perseverance under trial, sound doctrine, and spiritual warfare.
                These form the backbone of evangelical catechesis and are heavily
                represented in confessional documents.
              </p>
              <p>
                Dataset B is the most evenly distributed across speakers and NT
                sections. It includes both the most urgent imperatives (crisis
                language around false teaching) and the most reflective (the
                wisdom tradition of Hebrews and the General Epistles).
              </p>
            </DsCard>
            <DsCard ds="D" label="Social Codes & Liturgy" count={100}
              color="#e76f51" muted="#fde8e2">
              <p>
                Commands governing community life: household relationships (the
                Pauline "household codes"), church order, worship practice,
                and moral purity. Includes directives on marriage, gender
                roles, congregational conduct, and liturgical propriety.
              </p>
              <p>
                Dataset D is distinctive in rhetorical register: 79 % of its records
                are classified as Explicit Command — the highest-certainty grammatical
                form. Paul speaks 52 % of Dataset D.
              </p>
            </DsCard>
          </div>
        </Section>

        {/* Command strength */}
        <Section eyebrow="Rhetorical classification" title="What does command strength mean?">
          <P>
            Each record is classified by the rhetorical form of the command — how
            directly and unambiguously the text issues the directive. Six groups
            are used, from most to least direct:
          </P>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {[
              { name: "Explicit Command", desc: "A first-person, unambiguous directive in imperative or equivalent form. No interpretive gap between text and instruction." },
              { name: "Direct Imperative", desc: "A grammatical imperative that functions as a clear command within its context, though sometimes mediated through quotation or narrative frame." },
              { name: "Implicit Command", desc: "The text strongly implies a commanded action without using imperative grammar — typically through conditional structures or rhetorical questions." },
              { name: "Implied Command", desc: "The commanded behavior is inferrable from the passage but requires a modest degree of interpretive work." },
              { name: "Warning", desc: "The command is framed negatively — as a prohibition or cautionary instruction. Includes eschatological warnings." },
              { name: "Narrative Example", desc: "A story or description that functions as a command by modeling behavior — parables, exemplary figures, or illustrative anecdotes." },
            ].map(({ name, desc }) => (
              <div key={name} className="bg-white rounded border border-stone-200 px-4 py-3">
                <p className="text-[12px] font-semibold text-stone-800 mb-1">{name}</p>
                <p className="text-[11px] text-stone-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Commonly cited */}
        <Section eyebrow="SBC citation overlay" title={'What does \u201ccommonly cited\u201d mean?'}>
          <P>
            183 of the 385 records are tagged as <em>commonly cited</em> — meaning they
            appear as supporting references in the Southern Baptist Convention's primary
            doctrinal documents, chiefly the Baptist Faith & Message (2000 edition) and
            related confessional texts.
          </P>
          <P>
            The tagging was done by cross-referencing the BF&M footnotes and inline
            citations against the command records. A passage is tagged if it is cited
            in that literature regardless of whether the citation engages with the
            passage's ethical content.
          </P>
          <P>
            In the visualization, the amber "Cited overlay" toggle shows what proportion
            of each ribbon cohort consists of commonly-cited passages, making it
            possible to see which voices and datasets the BF&M draws on most heavily.
          </P>
        </Section>

        {/* Primary records */}
        <Section eyebrow="Gospel parallels" title="How are parallel passages handled?">
          <P>
            Many NT commands appear in multiple Gospels. "Love your neighbor" is
            recorded in Matt 22:39, Mark 12:31, and Luke 10:27 — three records,
            one underlying command. The dataset includes all parallel records by
            default, as each Gospel's framing carries its own rhetorical and
            redactional significance.
          </P>
          <P>
            However, when counting unique commands, this inflation matters. The
            "Primary only" toggle on the Compare page deduplicates Gospel parallels
            by flagging one record per command group as primary — reducing the
            385-record dataset to 311 unique commands. The effect is largest in
            the Gospels and essentially zero outside them.
          </P>
        </Section>

        {/* Navigation */}
        <div className="pt-10 border-t border-stone-200 flex flex-wrap gap-3">
          <Link href="/compare"
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors">
            Compare datasets →
          </Link>
          <Link href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-stone-300 text-stone-600 text-sm font-medium hover:border-stone-400 hover:text-stone-900 transition-colors">
            Explore patterns
          </Link>
          <Link href="/browse"
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-stone-300 text-stone-600 text-sm font-medium hover:border-stone-400 hover:text-stone-900 transition-colors">
            Browse all passages
          </Link>
        </div>

      </div>
    </main>
  );
}
