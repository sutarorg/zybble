/**
 * Editorial content for the Zybble blog.
 *
 * Articles are authored in structured blocks so they render with the design
 * system's prose styling without introducing an MDX pipeline. Every piece is
 * original, principle-based writing — no invented statistics or fake studies.
 */

export type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "download"; href: string; label: string; hint: string };

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date
  readingTime: string;
  category: string;
  cover: { src: string; alt: string };
  blocks: Block[];
}

export const posts: BlogPost[] = [
  {
    slug: "how-to-find-your-best-time-to-post-on-linkedin",
    title: "How to find your best time to post on LinkedIn",
    description:
      "Forget the generic 'post at 8 AM on Tuesday' advice. Here's how to find the publishing times that actually work for your audience — and measure them properly.",
    publishedAt: "2026-01-19",
    readingTime: "6 min read",
    category: "Analytics",
    cover: {
      src: "/blog/best-time-to-post.jpg",
      alt: "Abstract editorial illustration of a clock face and calendar grid in electric blue tones",
    },
    blocks: [
      {
        type: "paragraph",
        text: "Search for the best time to post on LinkedIn and you will find dozens of confident, contradictory answers. Tuesday at 8 AM. Wednesday at noon. Thursday, but only if Mercury is in retrograde. The problem is not the advice — it is the premise. There is no universal best time. There is only the time your audience is ready to read.",
      },
      {
        type: "heading",
        text: "Why generic advice fails",
      },
      {
        type: "paragraph",
        text: "Every audience has its own rhythm. A founder writing for European CFOs plays by a different clock than a consultant serving US hiring managers. Industry, seniority and geography shift when people scroll, and recycled averages flatten all of that into a number that fits no one in particular.",
      },
      {
        type: "heading",
        text: "A method that actually works",
      },
      {
        type: "paragraph",
        text: "The honest approach is unglamorous: pick a hypothesis, hold everything else steady, and measure. Consistency matters more than precision here, because you are looking for relative differences — which of your slots outperforms your own baseline — not an absolute truth.",
      },
      {
        type: "list",
        items: [
          "Choose two or three candidate slots based on when your buyers plausibly browse: commute hours, lunch, early evening.",
          "Post comparable content in each slot for at least two weeks. Do not compare a carousel on Monday with a text post on Friday; format confounds the test.",
          "Measure engagement rate, not raw impressions. Reach fluctuates; the rate tells you how the audience responded.",
          "Promote the winning slot to your default, then retest quarterly. Audiences drift.",
        ],
      },
      {
        type: "heading",
        text: "Let the tool remember, so you can think",
      },
      {
        type: "paragraph",
        text: "This is exactly the kind of analysis that should not live in a spreadsheet. On Zybble Pro, best-time insights are computed from your own publishing history: the workspace surfaces the windows where your posts have historically earned the strongest response, and suggests them directly in the scheduler. You stay the editor; the data does the remembering.",
      },
      {
        type: "quote",
        text: "The best time to post is the time your readers keep — discovered with your data, not borrowed from someone else's.",
      },
    ],
  },
  {
    slug: "linkedin-content-calendar-for-busy-founders",
    title: "A LinkedIn content calendar for founders who have no time",
    description:
      "A realistic weekly system for staying visible on LinkedIn when you also have a company to run: fewer ideas, batched writing, one calendar.",
    publishedAt: "2026-01-08",
    readingTime: "7 min read",
    category: "Scheduling",
    cover: {
      src: "/blog/content-calendar-founders.jpg",
      alt: "Minimal blue and white illustration of a content calendar with organised weekly slots",
    },
    blocks: [
      {
        type: "paragraph",
        text: "Most founders do not struggle with what to say. They struggle with the daily negotiation of when to say it. LinkedIn punishes exactly that: the algorithm and your audience reward a steady drumbeat, yet companies are not run on a steady drumbeat. The fix is not more discipline — it is moving the work to when you have the headspace for it.",
      },
      {
        type: "heading",
        text: "Batch the thinking, not just the writing",
      },
      {
        type: "paragraph",
        text: "Set aside one weekly block — forty-five minutes is enough — and treat it as an editorial meeting of one. In that block you do three things: collect raw material from the week, draft two or three posts, and place every draft on the calendar. Done well, LinkedIn then runs in the background until the next session.",
      },
      {
        type: "heading",
        text: "Three slots a week is a strategy",
      },
      {
        type: "paragraph",
        text: "You do not need to post daily. Three well-placed posts beat seven diluted ones. A pattern that works for many B2B founders:",
      },
      {
        type: "list",
        items: [
          "Early week — a lesson from the work: something you shipped, decided or got wrong.",
          "Mid week — a perspective: your take on where the industry is heading.",
          "Late week — something lighter: a story, a customer moment, a question for your network.",
        ],
      },
      {
        type: "paragraph",
        text: "Notice what this is not: a content treadmill. It is a rhythm your audience can learn to expect, and one you can sustain through a funding round, a launch or a frenzied hiring month — because the writing is batched and the publishing is scheduled.",
      },
      {
        type: "heading",
        text: "Keep the pipeline honest",
      },
      {
        type: "paragraph",
        text: "Two rules keep the system healthy. First, ideas expire: anything in your drafts older than a month either gets shipped this week or gets deleted. Second, the calendar is visible: if you can see Thursday is empty on Monday, you will fix it on Monday. A scheduling tool earns its place by making that glance effortless — which is precisely the glance Zybble's calendar is built around.",
      },
      {
        type: "quote",
        text: "Consistency is not a personality trait. It is a calendar with drafts already on it.",
      },
    ],
  },
  {
    slug: "linkedin-analytics-beyond-vanity-metrics",
    title: "LinkedIn analytics beyond vanity metrics",
    description:
      "Impressions feel good and mean little. Here are the numbers that actually predict whether your LinkedIn presence is working — and how to read them.",
    publishedAt: "2025-12-15",
    readingTime: "6 min read",
    category: "Analytics",
    cover: {
      src: "/blog/analytics-beyond-vanity.jpg",
      alt: "Editorial illustration of ascending bar charts and a rising line in Zybble blue",
    },
    blocks: [
      {
        type: "paragraph",
        text: "Impressions are the sugar of social analytics: instant, addictive and nutritionally empty. A post can reach tens of thousands of feeds and change nothing. If you are building a business on LinkedIn, the question analytics must answer is narrower and harder: is the right audience paying attention, and is that attention compounding?",
      },
      {
        type: "heading",
        text: "Engagement rate over reach",
      },
      {
        type: "paragraph",
        text: "Reactions, comments and reposts divided by impressions is the first honest number. It strips out the lottery of distribution and tells you how the people who saw the post responded. Track it per post, then look at the median across a month — single posts lie, medians do not.",
      },
      {
        type: "heading",
        text: "Comments are the closest thing to revenue",
      },
      {
        type: "paragraph",
        text: "For consultants and founders, the metric closest to pipeline is the quality of comment section you generate. Comments from people in your target market are leads wearing a disguise. Count them. Read them. Reply to every one — the reply doubles the comment count and often starts the real conversation in DMs.",
      },
      {
        type: "heading",
        text: "A simple weekly review",
      },
      {
        type: "list",
        items: [
          "Which post had the highest engagement rate — and what did it have in common with your other winners?",
          "Who commented: strangers, peers, or the people you actually sell to?",
          "Did follower growth accelerate after any specific topic or format?",
          "What one variable will you deliberately change next week?",
        ],
      },
      {
        type: "paragraph",
        text: "That last question is the point of analytics. If the review does not change what you do next, you are not measuring — you are spectating. Zybble's analytics view is designed around this loop: per-post performance, then the trend, then the decision.",
      },
      {
        type: "quote",
        text: "Reach is what the algorithm did. Engagement is what your audience did. Confuse the two and you will optimise for the wrong boss.",
      },
    ],
  },
  {
    slug: "why-consistency-beats-virality-on-linkedin",
    title: "Why consistency beats virality on LinkedIn",
    description:
      "One viral post fades in a week. A year of steady posting builds an audience that buys. The case for boring, scheduled, compounding visibility.",
    publishedAt: "2025-11-27",
    readingTime: "5 min read",
    category: "Strategy",
    cover: {
      src: "/blog/consistency-beats-virality.jpg",
      alt: "Abstract illustration of steady ascending steps in blue against a white background",
    },
    blocks: [
      {
        type: "paragraph",
        text: "Every LinkedIn creator remembers their first viral post. The notifications cascade, the follower count jumps — and two weeks later the graph is back to baseline, as if it never happened. Virality is a spike. Businesses are not built on spikes; they are built on lines that slope gently upward and refuse to come back down.",
      },
      {
        type: "heading",
        text: "What a year of steady posting actually buys",
      },
      {
        type: "paragraph",
        text: "Compounding on LinkedIn is subtle. It is the prospect who has seen your name forty times before the sales call. It is the hire who applied because they have read your thinking for six months. None of that appears in a dashboard screenshot, yet it is precisely what a consistent presence purchases over a viral hit — trust accumulated in small, regular deposits.",
      },
      {
        type: "heading",
        text: "The algorithm rewards rhythm too",
      },
      {
        type: "paragraph",
        text: "LinkedIn's distribution favours accounts that post reliably and earn engagement reliably, because predictable creators make the feed better. You need not take anyone's word for it: post sporadically for a month, then three times a week for two months, and compare your own analytics. The second period almost always carries the higher floor.",
      },
      {
        type: "heading",
        text: "Make consistency a system, not a resolution",
      },
      {
        type: "list",
        items: [
          "Decide your cadence once (two or three posts a week is plenty) and defend it like a meeting with your most important customer.",
          "Batch writing into one weekly block so a busy Tuesday cannot break the chain.",
          "Schedule posts in advance; willpower should never sit between your content and the publish button.",
          "Review monthly, not daily. Daily graphs invite panic; monthly trends invite strategy.",
        ],
      },
      {
        type: "quote",
        text: "Virality is weather. Consistency is climate. You harvest from the climate.",
      },
      {
        type: "paragraph",
        text: "This philosophy is built into Zybble itself: the calendar makes the rhythm visible, the queue makes it durable, and the analytics show the slow upward line that actually matters. Boring, scheduled and compounding beats brilliant and occasional — every time.",
      },
    ],
  },
  {
    slug: "does-scheduling-linkedin-posts-kill-your-reach",
    title:
      "Does Scheduling LinkedIn Posts Kill Your Reach? The Algorithm Myth Nobody Wants to Talk About",
    description:
      "The claim that scheduling tools suppress your LinkedIn reach refuses to die. Here is where the myth comes from, what actually drives distribution, and the one way scheduling genuinely can hurt you.",
    publishedAt: "2026-10-27",
    readingTime: "5 min read",
    category: "Strategy",
    cover: {
      src: "/blog/scheduling-kill-reach.jpg",
      alt: "Abstract illustration of unbroken concentric signal rings radiating through a grid in Zybble blue",
    },
    blocks: [
      {
        type: "paragraph",
        text: "Somewhere on LinkedIn right now, someone is explaining with total confidence that scheduling tools suppress your reach. The post will do well, because the claim is tidy, it flatters the person making it — I post live, therefore I am authentic — and it hands everyone who misses a publishing slot a ready-made excuse. It is also, on the evidence available, wrong. But myths this durable usually protect something true, and this one is no exception. So let us separate the two.",
      },
      {
        type: "heading",
        text: "Where the myth comes from",
      },
      {
        type: "paragraph",
        text: "Three mechanisms keep the story alive. The first is a straightforward confusion between correlation and cause. People who schedule tend to schedule a lot: agency-managed profiles, content calendars, founders batch-writing a month at a time. Those same accounts also tend to publish safer, more corporate copy, because writing in batches encourages caution. When a post underperforms, the scheduler is standing right there holding the bag. The tool did nothing. The copy did.",
      },
      {
        type: "paragraph",
        text: "The second is survivorship. Every post you have ever seen do well was published at some specific moment by some specific mechanism, but nobody attributes success to the clock. Failure gets an explanation; success gets a shrug. So the scheduling penalty is confirmed dozens of times a day by people looking for a cause, and never once tested against a control.",
      },
      {
        type: "paragraph",
        text: "The third is the grain of truth, and it is the interesting one. Scheduling really can hurt you — just not for the reason anyone says. More on that in a moment.",
      },
      {
        type: "heading",
        text: "What actually determines how far a post travels",
      },
      {
        type: "paragraph",
        text: "LinkedIn does not publish its ranking system, and anyone who tells you the exact weights is guessing. What you can observe, repeatedly, from your own analytics is narrower and more useful: a post is shown to a small initial slice of your audience; how that slice responds decides whether the next slice is larger or smaller; and posts that hold attention without earning complaints travel furthest. Everything beyond that is commentary.",
      },
      {
        type: "list",
        items: [
          "Whether your first readers stopped. Dwell time is the closest thing to a public signal of quality, and it is entirely a function of the writing.",
          "Whether the post earned conversation rather than passing agreement. Comments that continue a thought travel further than a hundred reactions.",
          "Whether the topic is one your network reliably cares about. Relevance is audience-specific, which is why borrowed best-practice lists keep disappointing you.",
          "Whether the format suits the idea. A dense argument works as text; a process works as a carousel; a question works as a poll. Mismatched format reads as noise.",
          "Whether you published when your audience was actually around to form that first impression.",
        ],
      },
      {
        type: "paragraph",
        text: "Notice what is absent from that list: the mechanism by which the post reached the platform. A scheduled post and a manually published post arrive as the same object. There is no field on a post recording how it was sent, and no coherent business reason for a platform to penalise the behaviour of its most reliable publishers — the people whose consistency makes the feed worth opening in the first place.",
      },
      {
        type: "heading",
        text: "The one way scheduling genuinely can hurt you",
      },
      {
        type: "paragraph",
        text: "Here is the real failure mode, and it has nothing to do with algorithms. Scheduling lets you be absent at the moment your post goes live, and the first hour is when the audience signal is formed. If you queue something for three in the morning and are asleep when the first comments arrive, you are not being penalised — you are simply not there for the part that decides the outcome. Do that consistently and your results will sag for entirely human reasons.",
      },
      {
        type: "paragraph",
        text: "There is a second, quieter version of the same problem. Set-and-forget scheduling removes the feedback loop. When publishing becomes effortless and invisible, nobody reviews what worked, and a calendar quietly fills with content that stopped resonating six months ago. The tool did not suppress your post. It suppressed your attention.",
      },
      {
        type: "heading",
        text: "How to schedule without losing the thread",
      },
      {
        type: "list",
        items: [
          "Schedule to your own measured peak, not a borrowed one. Run the experiment in our post on finding your best time to post, then let the scheduler hold that slot.",
          "Protect the first hour. If you cannot be present, do not publish. Shift the slot to a time you are genuinely at your desk rather than shipping into a vacuum.",
          "Write for a person, not a slot. Batch-writing is fine; batch-thinking is not. If a drafted post would not survive being read aloud, it will not survive the feed.",
          "Keep one manual post a week. Not as a sacrifice to the algorithm, but to stay honest about how your writing actually lands.",
          "Review monthly. Look for the posts that earned conversation and ask what they had in common. Retire the formats that consistently do not.",
        ],
      },
      {
        type: "quote",
        text: "Scheduling does not cost you reach. Absence does — and absence is a choice you keep making after you hit schedule.",
      },
      {
        type: "paragraph",
        text: "This is why the calendar matters more than the queue. In Zybble, scheduling is designed to make your publishing rhythm visible rather than invisible: you see the week laid out, you can move a post when a better slot appears, and on Pro the best-time insights are computed from your own history rather than someone else's averages. The point of a scheduler is not to let you stop thinking about your audience. It is to free up the thinking that actually needs you.",
      },
    ],
  },
  {
    slug: "best-linkedin-scheduler-for-agencies-2026",
    title:
      "Best LinkedIn Scheduler for Agencies in 2026: 9 Tools Compared on Pricing, Automation & Features",
    description:
      "Nine schedulers that can publish to LinkedIn, and the evaluation criteria that actually predict whether one survives contact with a client roster. Plus how to read a pricing page before you commit.",
    publishedAt: "2026-10-20",
    readingTime: "6 min read",
    category: "Tools",
    cover: {
      src: "/blog/best-scheduler-agencies.jpg",
      alt: "Minimal illustration of nine abstract tool cards in a three by three grid, one highlighted in electric blue",
    },
    blocks: [
      {
        type: "paragraph",
        text: "Agency buying decisions for social tooling fail in a predictable way. Someone compares feature checklists, picks the tool with the most ticks, and four months later the team is exporting CSVs again. The checklist is not the problem. The problem is that most of it measures things that stop mattering the moment you have eleven clients, three time zones and an approval chain. What follows is a shortlist of nine tools that can schedule to LinkedIn, the criteria that actually separate them for agency use, and how to read a pricing page without being surprised by the invoice.",
      },
      {
        type: "heading",
        text: "A note on pricing, before anything else",
      },
      {
        type: "paragraph",
        text: "I am not going to print a price table. Vendor pricing in this category moves several times a year, and per-seat minimums and client-account allowances are exactly the details that shift. A wrong number is worse than no number, because you might make a decision on it. Instead, the section below tells you which pricing model to look for and which line items to check before you sign. Confirm the current figures with each vendor — it takes five minutes and it is your money.",
      },
      {
        type: "heading",
        text: "The shortlist: nine tools that schedule to LinkedIn",
      },
      {
        type: "paragraph",
        text: "These are established tools in the category, grouped by what each is principally built for. This is orientation, not a ranking: the right answer depends entirely on your client mix. Check current capabilities and pricing with each vendor before you buy.",
      },
      {
        type: "list",
        items: [
          "Buffer — the long-standing generalist. Simple queue-based scheduling across the major networks, popular with small teams and solo operators.",
          "Hootsuite — one of the oldest multi-network platforms, with broad listening features and account structures aimed at larger organisations.",
          "Sprout Social — reporting and analytics depth built for bigger marketing teams, and generally priced for them.",
          "Agorapulse — publishing alongside a social inbox for engagement management, often shortlisted by agencies handling community response.",
          "SocialPilot — multi-client scheduling with an explicit agency posture and pricing built around connected accounts.",
          "Later — visual-first planning with deep Instagram support, including LinkedIn in its broader plan set.",
          "Metricool — publishing plus reporting, with a notable free tier for lighter use.",
          "Planable — built around content review and approval workflows, which is the agency pain point most tools treat as an afterthought.",
          "Zybble — LinkedIn only, and deliberately so: multi-account publishing, approvals and analytics tuned to how LinkedIn distribution actually behaves.",
        ],
      },
      {
        type: "heading",
        text: "The nine criteria that actually matter",
      },
      {
        type: "heading",
        text: "1. Client account isolation",
      },
      {
        type: "paragraph",
        text: "Not can you connect two accounts — anyone can. The question is what the tool does with them afterwards. A shared queue where any draft can drift onto any profile is a misposting waiting to happen. You want the account to be a property of the draft, chosen at creation, visible on every card, and hard to change by accident.",
      },
      {
        type: "heading",
        text: "2. Approval states, not just drafts",
      },
      {
        type: "paragraph",
        text: "The moment a second person touches a client account, you need a state between draft and published. If that state lives in Slack, it will eventually be skipped. Look for a real approval step with a named reviewer, and check who can bypass it.",
      },
      {
        type: "heading",
        text: "3. Seat versus account pricing",
      },
      {
        type: "paragraph",
        text: "These two models diverge sharply and the cheaper one at three clients is frequently the more expensive one at fifteen. Per-seat suits agencies with a stable team and a growing roster. Per-account suits agencies whose headcount grows alongside the roster. Work out which curve you are actually on.",
      },
      {
        type: "heading",
        text: "4. Who owns the connection",
      },
      {
        type: "paragraph",
        text: "When an account manager leaves, what happens to the profiles they connected? Reconnecting should be an admin action you can perform yourself, at six in the evening, without a support ticket. Ask whether you can see who connected each account and when the authorisation was last refreshed.",
      },
      {
        type: "heading",
        text: "5. Analytics a client can read",
      },
      {
        type: "paragraph",
        text: "You are not buying charts for yourself; you are buying a report you can forward without rewriting it. Check that analytics can be scoped to a single account, exported in a presentable form, and produced without an afternoon of manual assembly.",
      },
      {
        type: "heading",
        text: "6. Multi-account without multi-login",
      },
      {
        type: "paragraph",
        text: "Switching between accounts should be a context switch inside one workspace, not a logout. If your team keeps a spreadsheet of which browser profile holds which client, the tool is not doing this job.",
      },
      {
        type: "heading",
        text: "7. Failure visibility",
      },
      {
        type: "paragraph",
        text: "When a post fails on one of nine client accounts, does anyone hear about it? Silence is the default in a surprising number of schedulers. You want an explicit failed state, a reason, and the post preserved as a retryable draft — not a slot that quietly emptied itself.",
      },
      {
        type: "heading",
        text: "8. Time zone and scheduling semantics",
      },
      {
        type: "paragraph",
        text: "Per-account time zones matter more than they sound. A scheduler that sends everything on one global clock means either a client in another country gets posted at the wrong hour, or someone maintains a conversion table by hand.",
      },
      {
        type: "heading",
        text: "9. The exit",
      },
      {
        type: "paragraph",
        text: "Before you buy, find out how you would leave. Can you export the full post history and analytics for a client you are handing back in-house? Tools that make leaving hard are pricing in a lock-in you have not agreed to yet.",
      },
      {
        type: "heading",
        text: "How to read a pricing page like an agency owner",
      },
      {
        type: "list",
        items: [
          "Find the unit. Per seat, per social account, per workspace, or per scheduled post? These behave completely differently at eleven clients.",
          "Check the minimum seat count. Several enterprise-leaning tools start at a floor a five-person agency will never use.",
          "Look for what is metered, not what is unlimited. Unlimited scheduling alongside a cap on connected accounts is a cap on accounts.",
          "Ask what happens when a client leaves. Can you disconnect, reclaim the seat and keep the history, without a support ticket?",
          "Check whether analytics history is a paid tier. Seven days of history means every quarterly report needs archiving by hand.",
          "Confirm the billing entity. If the client pays the invoice directly, pass-through is far simpler with per-account billing than per-seat.",
        ],
      },
      {
        type: "quote",
        text: "Buy the tool that survives your worst week, not the one that demos best on your best day.",
      },
      {
        type: "heading",
        text: "How to trial a scheduler properly",
      },
      {
        type: "list",
        items: [
          "Run one real client for two weeks. Not a demo account, not your own profile — a client with a real approval chain.",
          "Include the person who will use it daily, not only the person who chose it. Adoption is a feature.",
          "Deliberately cause a failure: revoke a connection mid-queue, or schedule a post with a broken image. See whether the tool tells you before your client does.",
          "Produce one report in the tool's own format and send it to yourself. If you would be embarrassed to forward it, that is your answer.",
        ],
      },
      {
        type: "paragraph",
        text: "If your client work is predominantly LinkedIn rather than spread across six networks, the calculation changes. A generalist tool will schedule to LinkedIn competently while optimising for Instagram carousels and TikTok clips you will never publish. Zybble is the opposite bet: one network, done properly, with multi-account publishing from a single workspace and per-account analytics built around the questions LinkedIn clients actually ask. Start on the free plan, run the trial above on your hardest account, and upgrade only when the constraints you have hit are constraints we remove.",
      },
    ],
  },
  {
    slug: "linkedin-scheduler-for-multiple-accounts",
    title:
      "LinkedIn Scheduler for Multiple Accounts: 7 Features to Check Before You Waste Money on the Wrong Tool",
    description:
      "Managing several LinkedIn profiles turns scheduling from a convenience into infrastructure. Seven capabilities that separate a usable multi-account scheduler from an expensive mistake.",
    publishedAt: "2026-10-13",
    readingTime: "4 min read",
    category: "Tools",
    cover: {
      src: "/blog/multiple-accounts-scheduler.jpg",
      alt: "Minimal illustration of four profile shapes connected to a single central hub node in Zybble blue",
    },
    blocks: [
      {
        type: "paragraph",
        text: "Single-account scheduling is a convenience. Multi-account scheduling is infrastructure, and infrastructure fails differently — quietly, and usually in front of a client. Nearly every tool in this category advertises multi-account support, because connecting a second profile is the easy part. The hard part is everything that happens afterwards. Here are the seven things to check, roughly in the order they tend to bite.",
      },
      {
        type: "heading",
        text: "1. Real separation between accounts",
      },
      {
        type: "paragraph",
        text: "Check what happens when you switch accounts. A shared queue where any draft can land on any profile is a misposting waiting to happen. You want the account to be a property of the draft, chosen at creation, shown on every card in the calendar, and impossible to change by accident. If the account is only visible after you open the draft, it is not visible enough.",
      },
      {
        type: "heading",
        text: "2. Per-account scheduling windows",
      },
      {
        type: "paragraph",
        text: "Your founder profile and your company page do not share an audience rhythm. Neither does a client whose buyers are in Singapore. A tool with only global time slots forces you to choose between the wrong time for one account and manual work for the other — and manual work is the thing you bought the tool to avoid.",
      },
      {
        type: "heading",
        text: "3. Connections that survive staff changes",
      },
      {
        type: "paragraph",
        text: "Whoever connects a LinkedIn account eventually leaves. The question is whether disconnecting and reconnecting is an admin action you can take yourself at six in the evening, or a support ticket that takes four days. Related, and easier to forget: can you see which accounts are connected, by whom, and when the authorisation was last refreshed — before it expires in the middle of a queue?",
      },
      {
        type: "heading",
        text: "4. Failure visibility",
      },
      {
        type: "paragraph",
        text: "When a post fails on one of four accounts, does the tool tell you? In a surprising number of schedulers, the answer is no: the slot empties, the calendar looks clean, and you find out from a client asking why nothing went out on Tuesday. Insist on an explicit failed state, a reason you can act on, and the post preserved as a draft you can retry.",
      },
      {
        type: "heading",
        text: "5. Analytics that can be scoped",
      },
      {
        type: "paragraph",
        text: "Combined analytics across all your accounts is easy to build and close to useless. It tells you the aggregate while hiding the fact that one account is carrying it. You need per-account views and, if you report to anyone else, per-account export — otherwise every report becomes a manual subtraction.",
      },
      {
        type: "heading",
        text: "6. Permissions that match how you actually work",
      },
      {
        type: "paragraph",
        text: "Not everyone should be able to publish. Look for a real distinction between people who can draft, people who can approve and people who can connect or disconnect accounts. Then check whether the approval step is a state in the tool or a Slack message somebody has to remember. Only one of those survives a holiday.",
      },
      {
        type: "heading",
        text: "7. Honest limits at the account count you will actually have",
      },
      {
        type: "paragraph",
        text: "Count the accounts you expect in twelve months, not the ones you have today, and price the tool at that number. This is where per-account and per-seat models diverge hard, and the cheaper option at three accounts is often the more expensive one at ten. Also check what happens at the ceiling: does the tool refuse the eleventh account, or silently start charging you more?",
      },
      {
        type: "heading",
        text: "A ten-minute test before you buy anything",
      },
      {
        type: "list",
        items: [
          "Connect two accounts and schedule one post to each in the same minute. Verify both land on the correct profile.",
          "Revoke one connection and queue a post to it. Confirm you get a clear error rather than silence.",
          "Have a colleague draft on your account without publish rights, then approve it yourself.",
          "Export analytics for a single account and check the numbers are genuinely scoped to it.",
          "Look at the invoice at double your current account count. That is the number you will be paying next year.",
        ],
      },
      {
        type: "quote",
        text: "Multi-account is not a feature you switch on. It is a set of failure modes you have already decided how to handle.",
      },
      {
        type: "paragraph",
        text: "Zybble was built around precisely this problem: Pro supports up to five LinkedIn accounts in one workspace, every post is assigned to a specific account when you write it, and analytics can be read per account rather than only in aggregate. The free plan covers a single account and ten scheduled posts a month — enough to run every one of the tests above, on your real account, before you spend anything.",
      },
    ],
  },
  {
    slug: "linkedin-free-scheduler-vs-paid-tools",
    title:
      "LinkedIn's Free Scheduler vs Paid Tools: 7 Limitations That Could Be Holding Back Your Growth",
    description:
      "LinkedIn's built-in scheduler is genuinely useful — until it isn't. Seven limitations that appear the moment you get serious, and how to tell when you have outgrown the free option.",
    publishedAt: "2026-10-06",
    readingTime: "4 min read",
    category: "Tools",
    cover: {
      src: "/blog/free-vs-paid-scheduler.jpg",
      alt: "Minimal illustration of a small three-drawer box beside a taller multi-compartment cabinet in Zybble blue",
    },
    blocks: [
      {
        type: "paragraph",
        text: "LinkedIn lets you schedule a post natively, for free, straight from the composer. For a while that is genuinely all you need. And then one day it isn't. The awkward part is that the ceiling arrives without any notification at all: no error message, no upgrade prompt, just a slow accumulation of workarounds you have stopped noticing. Here are the seven limits that tend to appear first, so you can recognise them before they start costing you.",
      },
      {
        type: "paragraph",
        text: "One caveat before the list: native features vary by account type, region and rollout, so treat this as a map of the common shape of these limitations rather than a spec sheet. If something here no longer applies to your account, good — that is one problem you do not have.",
      },
      {
        type: "heading",
        text: "1. It is one post, one account, one tab at a time",
      },
      {
        type: "paragraph",
        text: "The native scheduler lives inside a single profile's composer. If you also run a company page, a founder brand and a client account, you are switching contexts, re-reading tone guidelines and re-checking formatting every single time. The cost is not really the minutes; it is the switching, which is what makes consistent publishing feel heavier than it is.",
      },
      {
        type: "heading",
        text: "2. No first comment",
      },
      {
        type: "paragraph",
        text: "Putting a link, a source or an afterthought in the first comment is ordinary practice on LinkedIn. The native scheduler publishes the post and stops. That leaves you either online at publish time or rewriting your post to avoid needing the comment — a content decision made for you by a tooling gap.",
      },
      {
        type: "heading",
        text: "3. Analytics stop at the surface",
      },
      {
        type: "paragraph",
        text: "You can see how an individual post performed. Turning thirty posts into a pattern — which formats earn conversation, which themes fall flat, which slot beats your own baseline — is manual work, and manual work is work that quietly stops happening. Most people who believe they know what their audience wants are remembering their three best posts.",
      },
      {
        type: "heading",
        text: "4. You cannot queue a body of work",
      },
      {
        type: "paragraph",
        text: "A scheduler that holds one post at a time pushes you back into daily decisions. The alternative is batching: a single weekly writing block and a queue that spans it, so the month survives your busiest Tuesday. That is the difference between a publishing habit and a publishing streak.",
      },
      {
        type: "heading",
        text: "5. No state between draft and published",
      },
      {
        type: "paragraph",
        text: "The moment a second person touches the account — a virtual assistant, a junior marketer, an agency — you need an approval step. Without one, approvals happen in a chat thread and someone eventually posts the wrong draft. This is the limitation that surprises people most, because it only appears once you start delegating, which is exactly when you are too busy to fix it.",
      },
      {
        type: "heading",
        text: "6. Nothing remembers what worked",
      },
      {
        type: "paragraph",
        text: "There is no memory of your own history: no record of which slot, format or theme has historically earned the strongest response from your audience. So every post begins from zero intuition, and the lesson you learned in March has to be relearned in September from scratch.",
      },
      {
        type: "heading",
        text: "7. Your calendar lives in your head",
      },
      {
        type: "paragraph",
        text: "The native scheduler shows you the next post. It does not show you the month, the balance of formats, or the gap where a customer story ought to be. Publishing without a visible calendar is how accounts end up posting four times in one week and then disappearing for a fortnight.",
      },
      {
        type: "heading",
        text: "When the free scheduler is still the right answer",
      },
      {
        type: "list",
        items: [
          "You publish once or twice a week, from a single personal profile.",
          "You are still finding your voice and benefit from writing close to publish time.",
          "Nobody else touches the account, so you need no approvals or permissions.",
          "You are not yet making decisions from analytics — in which case deeper reporting would be unused capability you would be paying for.",
        ],
      },
      {
        type: "quote",
        text: "The free scheduler is not a trap. It is a tool with a ceiling, and the only real mistake is not noticing when you hit it.",
      },
      {
        type: "paragraph",
        text: "If three or more of those seven limits describe your current week, the constraint has moved from your ideas to your tooling. That is the point at which Zybble is built to help: a calendar you can see, a queue that holds a month of work, multi-account publishing from one workspace, and — on Pro — analytics that turn your own history into a recommendation rather than a chart you have to interpret yourself. Keep the native scheduler for the posts you want to write live. Move the systematic work somewhere you can see it.",
      },
    ],
  },
  {
    slug: "schedule-linkedin-post-with-first-comment",
    title:
      "How to Schedule LinkedIn Posts With a First Comment Without Being Online 24/7",
    description:
      "The first comment is where links, sources and follow-ups belong. Here is how to keep using it when your posts publish themselves — including the honest limits of scheduling tools.",
    publishedAt: "2026-09-29",
    readingTime: "4 min read",
    category: "How-to",
    cover: {
      src: "/blog/schedule-first-comment.jpg",
      alt: "Minimal illustration of a post card joined by a smaller offset comment card with a clock badge in Zybble blue",
    },
    blocks: [
      {
        type: "paragraph",
        text: "There is a particular kind of LinkedIn guilt reserved for people who schedule their posts. The post goes live at eight in the morning, and the first comment — the one carrying the link, the source, the afterthought — does not, because you were in a meeting. So you either put the link in the body where it sits awkwardly, or you lurk near your phone like someone waiting for a text. Neither is a system. Let us build one.",
      },
      {
        type: "heading",
        text: "Why the first comment earns its keep",
      },
      {
        type: "paragraph",
        text: "Putting a link in the first comment rather than the post body is convention, not physics. The practical reasons are mundane and real: it keeps the post body visually clean, it lets you add context later without editing published text, and it separates the argument from the evidence so readers who want the source can go and get it. What it does not do is unlock a hidden distribution bonus. If anyone tells you the comment itself is ranked differently, ask to see the measurement.",
      },
      {
        type: "paragraph",
        text: "That distinction matters, because it changes the problem. You do not need millisecond-precise comment automation. You need a dependable way to be present, or a way to make presence unnecessary.",
      },
      {
        type: "heading",
        text: "Option one: schedule the post, write the comment by hand",
      },
      {
        type: "paragraph",
        text: "Schedule the post for a time when you will actually be at your desk — that is the whole trick — and keep the first comment as a snippet you can reach in one gesture: a pinned note, a text expander, a line in the calendar event itself. When the post goes live, paste. It takes under a minute, and it is the most reliable option available because it does not depend on any vendor's roadmap.",
      },
      {
        type: "heading",
        text: "Option two: restructure the post so it does not need one",
      },
      {
        type: "paragraph",
        text: "Often the comment exists purely to hold a link. Ask whether the link needs to be there at publish time. If your post makes a claim you can support in the body — we ran this across four client accounts — you may not need the citation up front; you can add it in a reply when someone asks, which is a better conversation anyway. If the link genuinely is the point of the post, put it in the body and trade a little polish for not depending on your own future self.",
      },
      {
        type: "heading",
        text: "Option three: use a tool that schedules both",
      },
      {
        type: "paragraph",
        text: "Some schedulers can queue a first comment alongside the post. If that is the single most important feature in your workflow, it is a legitimate reason to choose a tool — but test it properly before you pay. Does the comment publish immediately or after a delay? Does it survive an edit to the parent post? Does it work for company pages as well as personal profiles? Ask these during the trial, not after the invoice.",
      },
      {
        type: "heading",
        text: "Where Zybble fits, honestly",
      },
      {
        type: "paragraph",
        text: "Zybble schedules the post and keeps your publishing rhythm visible in a calendar. It does not currently automate a first comment, and I would rather tell you that plainly than let you discover it at eight in the morning. What it does do is make option one painless: because your queue is visible a week ahead, you can see which days carry a post that needs a comment, and you can move any of them into a slot where you will be present. The scheduler takes the memory work. You keep the thirty seconds that actually need a human.",
      },
      {
        type: "heading",
        text: "A routine that holds",
      },
      {
        type: "list",
        items: [
          "Decide at write time whether the post needs a first comment, and note it in the draft title so it is visible in the queue.",
          "Schedule comment-bearing posts only into windows when you are reliably at your desk.",
          "Keep the comment text alongside the draft, not in a separate tab you will close.",
          "Set a reminder for two minutes after publish — two, not zero, so the post is live and indexed first.",
          "If you miss the window, do not delete the post. Add the comment late. It still works as a comment.",
        ],
      },
      {
        type: "quote",
        text: "The goal is not to remove yourself from the conversation. It is to stop the tool from being the reason you are absent from it.",
      },
      {
        type: "paragraph",
        text: "None of this is glamorous, and that is rather the point. A publishing system you can maintain on a bad week beats a sophisticated one you abandon by the second Thursday. Pick the option that survives your calendar, not the one that sounds most automated.",
      },
    ],
  },
  {
    slug: "free-linkedin-content-calendar-template",
    title:
      "Free LinkedIn Content Calendar Template: Plan 30 Days of Posts Without Posting Every Day",
    description:
      "A 30-day planning sheet you can fill in one sitting, plus the weekly rhythm that makes a month of content realistic when you have a company to run.",
    publishedAt: "2026-09-15",
    readingTime: "4 min read",
    category: "Resources",
    cover: {
      src: "/blog/content-calendar-template.jpg",
      alt: "Minimal illustration of a printable calendar sheet with six filled day cells in Zybble blue",
    },
    blocks: [
      {
        type: "paragraph",
        text: "Most content calendars fail because they are designed for a version of you that writes daily and never has a bad week. This one is designed for the other version: the one running a company, who can give LinkedIn one focused hour and would like thirty days of publishing to come out of it.",
      },
      {
        type: "heading",
        text: "What the template is",
      },
      {
        type: "paragraph",
        text: "A single sheet: thirty rows, one per publishing slot, with columns for date, theme, format, the hook in one sentence, the account it goes to, and status. No formulas to maintain and no tab you have to learn. Duplicate it each month, fill the hook column first, and worry about the body later.",
      },
      {
        type: "download",
        href: "/downloads/linkedin-content-calendar-template.csv",
        label: "Download the 30-day content calendar template",
        hint: "CSV — opens in Google Sheets, Excel or Numbers. No signup, no email required.",
      },
      {
        type: "heading",
        text: "Why one hour of planning beats thirty of improvising",
      },
      {
        type: "paragraph",
        text: "The cost of a content calendar is not the planning; it is the deciding. Every morning you sit down without one, you spend willpower on what should I post before you spend any on the post itself. Move that decision into a single block and the rest of the month becomes transcription — which is the only kind of content work that reliably survives a busy week.",
      },
      {
        type: "heading",
        text: "The four themes that hold a month together",
      },
      {
        type: "paragraph",
        text: "Thirty posts sounds like thirty ideas, until you notice that most durable LinkedIn accounts rotate through a small number of themes. Pick four and you have a structure. Pick four and you also give yourself permission to repeat yourself, which is how an audience actually learns what you think.",
      },
      {
        type: "list",
        items: [
          "Proof — something you did, measured, delivered or fixed. Specific beats impressive every single time.",
          "Process — how you approach a problem your buyers also have. This is where trust comes from.",
          "Position — a belief you hold that your industry mostly does not. This is where differentiation comes from.",
          "People — the team, the client, the lesson someone taught you. This is where warmth comes from.",
        ],
      },
      {
        type: "heading",
        text: "A realistic cadence",
      },
      {
        type: "paragraph",
        text: "Three posts a week is plenty, and it is where I would start. Frequent enough for the platform to learn your rhythm, rare enough that each post carries a real idea. Three a week is roughly twelve or thirteen a month — which means the thirty-row sheet is not thirty posts. It is a month of slots with room to move things when a week goes sideways. That slack is the point, not a compromise.",
      },
      {
        type: "list",
        items: [
          "One proof post, early in the week, when professional attention is highest.",
          "One process post, mid-week, for the people actively working through the problem.",
          "One position post, later in the week, when readers have the bandwidth for an argument.",
        ],
      },
      {
        type: "heading",
        text: "How to fill it in one sitting",
      },
      {
        type: "list",
        items: [
          "Block forty-five minutes and set a timer. The constraint is what makes it work.",
          "Fill the theme column first. Alternate proof, process, position and people down the month before writing a single line.",
          "Write only the hook for each row — one sentence, the first thing a reader would see. If you cannot write the hook, the idea is not ready: leave the row blank and move on.",
          "Mark the two rows you will expand today. Two is achievable. Ten is a resolution.",
          "Schedule what is finished and leave the rest as drafts in the queue. A calendar with visible gaps beats a plan you quietly abandoned.",
        ],
      },
      {
        type: "quote",
        text: "You do not need thirty ideas. You need four themes and one protected hour.",
      },
      {
        type: "heading",
        text: "Keep it where you will actually look at it",
      },
      {
        type: "paragraph",
        text: "The best template is the one already open when you need it, which is why a calendar inside your scheduler beats a spreadsheet you have to remember to open. In Zybble the same thirty days live in the calendar you already publish from: open a scheduled post and shift it to another day when a week goes wrong, keep finished work in the queue, and see the month laid out rather than reconstructed from memory. The spreadsheet is for thinking. The calendar is for shipping.",
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug);
}
