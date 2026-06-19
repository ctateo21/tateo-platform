import { Helmet } from "react-helmet";
import { Link } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, GraduationCap } from "lucide-react";
import { EDUCATION_TOPICS } from "@/data/education-content";

const PAGE_URL = "https://havofl.com/education";
const OG_IMAGE = "https://havofl.com/havo-og-v1.png";
const PAGE_TITLE =
  "Havo Education | Real Estate, Mortgage & Insurance Questions Answered";
const PAGE_DESCRIPTION =
  "Answers to common questions about buying a home, selling a home, mortgages, refinancing, cash purchases, homeowners insurance, flood zones, and closing costs.";

// Build a single FAQPage structured-data object from every topic's Q&A so
// search/answer engines can parse the whole page. Includes both the visible
// direct-answer block and the FAQ items. Answers are plain text (no Markdown),
// matching the visible content.
function buildFaqJsonLd() {
  const mainEntity = EDUCATION_TOPICS.flatMap((topic) => [
    {
      "@type": "Question",
      name: topic.directAnswer.question,
      acceptedAnswer: { "@type": "Answer", text: topic.directAnswer.answer },
    },
    ...topic.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  ]);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

export default function Education() {
  const faqJsonLd = buildFaqJsonLd();

  if (import.meta.env.DEV) {
    console.log("[education-page] faq items parsed", faqJsonLd.mainEntity.length);
  }

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <div className="bg-white">
        <div className="container mx-auto px-4 py-10 md:py-16 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-2 text-primary font-semibold text-sm uppercase tracking-wide mb-3">
            <GraduationCap className="h-5 w-5" />
            Education
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-[#0F1B3D] tracking-tight">
            Education
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Clear answers for buying, selling, financing, and insuring a home.
          </p>
          <p className="mt-4 text-gray-600 leading-relaxed">
            Straight answers to the questions Florida buyers, sellers, and
            homeowners ask most — about insurance, mortgages, flood zones,
            closing costs, and property taxes. Each topic gives you the direct
            answer first, then the detail behind it.
          </p>

          {/* Table of contents */}
          <nav
            aria-label="Topics"
            className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Topics on this page
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {EDUCATION_TOPICS.map((topic) => (
                <li key={topic.id}>
                  <a
                    href={`#${topic.id}`}
                    className="flex items-start gap-2 text-[#0F1B3D] hover:text-primary font-medium"
                  >
                    <ArrowRight className="h-4 w-4 mt-1 shrink-0 text-primary" />
                    {topic.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Topics */}
          {EDUCATION_TOPICS.map((topic) => (
            <section
              key={topic.id}
              id={topic.id}
              className="mt-14 scroll-mt-24 border-t border-gray-100 pt-10"
            >
              <h2 className="text-2xl md:text-3xl font-display font-bold text-[#0F1B3D] tracking-tight">
                {topic.title}
              </h2>

              {/* Direct answer block — placed first for AI/answer engines */}
              <div className="mt-5 rounded-xl border-l-4 border-primary bg-primary/5 p-5">
                <h3 className="font-semibold text-[#0F1B3D]">
                  {topic.directAnswer.question}
                </h3>
                <p className="mt-2 text-gray-700 leading-relaxed">
                  {topic.directAnswer.answer}
                </p>
              </div>

              {/* Body content (Markdown with tables). Tables are wrapped in a
                  horizontal-scroll container so wide tables never cause page
                  overflow on small screens. */}
              <div className="prose prose-slate max-w-none mt-6 prose-headings:font-display prose-headings:text-[#0F1B3D] prose-h4:text-lg prose-h4:font-semibold prose-a:text-primary prose-table:text-sm prose-th:bg-gray-50">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto">
                        <table {...props} />
                      </div>
                    ),
                  }}
                >
                  {topic.body}
                </ReactMarkdown>
              </div>

              {/* FAQ — visible Q&A, fully in the DOM (no accordion) */}
              <div className="mt-8">
                <h3 className="text-xl font-bold text-[#0F1B3D] mb-4">
                  Frequently asked questions
                </h3>
                <div className="space-y-5">
                  {topic.faqs.map((faq) => (
                    <div key={faq.question}>
                      <h4 className="font-semibold text-[#0F1B3D]">
                        {faq.question}
                      </h4>
                      <p className="mt-1 text-gray-700 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA back into the tool */}
              <div className="mt-8 rounded-xl bg-[#0F1B3D] p-6 text-white">
                <p className="font-semibold text-lg">{topic.cta.heading}</p>
                <p className="mt-1 text-white/80">{topic.cta.text}</p>
                <Link
                  href={topic.cta.href}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary/90"
                >
                  {topic.cta.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
