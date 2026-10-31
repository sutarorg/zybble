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
  | { type: "quote"; text: string };

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
      src: "/blog/best-time-to-post.png",
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
      src: "/blog/content-calendar-founders.png",
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
      src: "/blog/analytics-beyond-vanity.png",
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
      src: "/blog/consistency-beats-virality.png",
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
];

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug);
}
