export type BlogSection = {
  heading: string;
  paragraphs: string[];
  tips?: string[];
};

export type BlogResource = {
  label: string;
  url: string;
};

export type BlogPost = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  heroGradient: string;
  readTime: string;
  publishDate: string;
  sections: BlogSection[];
  keyTakeaways: string[];
  resources?: BlogResource[];
  tags: string[];
  relatedSlugs?: string[];
  authorId?: string | null;
};

export const SEED_BLOG_POSTS: BlogPost[] = [
  {
    slug: "protect-your-vision-daily-habits",
    title: "Protect Your Vision: Daily Habits That Support Healthy Eyes",
    description:
      "Discover simple, science-backed routines that reduce digital eye strain and keep your vision sharp from morning to night.",
    heroGradient: "from-sky-500 via-blue-500 to-indigo-500",
    readTime: "6 min read",
    publishDate: "2025-02-01",
    sections: [
      {
        heading: "Start Your Day with Eye-Friendly Rituals",
        paragraphs: [
          "Before screens take over your morning, hydrate and nourish your eyes. A glass of water replenishes tears that evaporated overnight, while a breakfast rich in vitamins A, C, and E provides antioxidants that protect the retina.",
          "When you check your phone, lower the brightness or enable night mode. Sudden bursts of blue light can make eyes feel dry before the day truly begins."
        ],
        tips: [
          "Add leafy greens, eggs, or citrus fruits to your breakfast for a vision-supporting boost.",
          "Apply a warm compress for 60 seconds to loosen oil glands and prevent dry eyes."
        ]
      },
      {
        heading: "Build Micro-Breaks into Screen Time",
        paragraphs: [
          "Most of us blink 60% less when staring at screens, which destabilizes the tear film. Use the 20-20-20 rule as your anchor: every 20 minutes, look 20 feet away for at least 20 seconds.",
          "Pair the habit with posture cues. Align your screen slightly below eye level and keep the top third of the monitor in your natural line of sight to reduce neck and eye strain simultaneously."
        ],
        tips: [
          "Set calendar nudges or use productivity apps that dim the display when it’s time to look away.",
          "Adjust ambient lighting so your screen isn’t the brightest object in the room."
        ]
      },
      {
        heading: "Wind Down with Recovery Techniques",
        paragraphs: [
          "Just like muscles, your eyes need a cool-down. Gentle palming—cupping your hands over closed eyes without pressure—encourages relaxation and blocks blue light.",
          "Finish with five minutes of distance gazing. Focusing on objects across the room relaxes the ciliary muscles responsible for near work, leaving your eyes refreshed for tomorrow."
        ],
        tips: [
          "Dim your screens or enable bedtime modes at least an hour before sleep to preserve melatonin production.",
          "If you wear contacts, give your corneas a break overnight and stick to your replacement schedule."
        ]
      }
    ],
    keyTakeaways: [
      "Hydration, nutrition, and blue-light awareness set the tone for comfortable eyes all day.",
      "Micro-breaks plus posture support keep digital strain at bay during long work sessions.",
      "Evenings are the perfect time to reset with recovery techniques that prepare your eyes for quality sleep."
    ],
    resources: [
      { label: "American Academy of Ophthalmology: Digital Eye Strain", url: "https://www.aao.org/eye-health/tips-prevention/computer-usage" },
      { label: "National Eye Institute: Healthy Vision Tips", url: "https://www.nei.nih.gov/learn-about-eye-health/healthy-vision" }
    ],
    tags: ["daily-habits", "digital-health", "self-care"],
    relatedSlugs: ["nutrition-for-clear-vision", "how-to-talk-to-your-eye-doctor"]
  },
  {
    slug: "nutrition-for-clear-vision",
    title: "Nutrition for Clear Vision: Foods That Fuel Eye Health",
    description:
      "Fuel your eyes with nutrient-dense meals featuring carotenoids, omega-3s, and hydration strategies that protect sight long term.",
    heroGradient: "from-emerald-500 via-teal-500 to-cyan-500",
    readTime: "7 min read",
    publishDate: "2025-01-01",
    sections: [
      {
        heading: "Why Your Retina Loves Colorful Produce",
        paragraphs: [
          "Lutein and zeaxanthin act like internal sunglasses for the macula. These carotenoids filter high-energy light and neutralize oxidative stress, two of the biggest threats to central vision.",
          "Aim for a rainbow on your plate. Dark leafy greens, orange peppers, and corn are tasty sources that pair well with healthy fats for better absorption."
        ],
        tips: [
          "Blend spinach, mango, and Greek yogurt for a quick breakfast smoothie rich in carotenoids and protein.",
          "Roast rainbow carrots with olive oil to unlock fat-soluble nutrients."
        ]
      },
      {
        heading: "Omega-3s Support Tear Quality",
        paragraphs: [
          "Dry eye often stems from poor oil layer quality in tears. Omega-3 fatty acids replenish that layer, helping tears stay on the eye longer.",
          "Fatty fish like salmon or plant-based sources like flaxseed and chia can deliver the daily dose."
        ],
        tips: [
          "Swap one meat-based meal each week for grilled salmon or sardines.",
          "Add ground flaxseed to oatmeal for a plant-powered boost."
        ]
      },
      {
        heading: "Hydration Habits that Protect Vision",
        paragraphs: [
          "Every tear you produce relies on water. Mild dehydration leads to burning, blurry vision, and difficulty wearing contacts.",
          "Keep a refillable bottle nearby and set mini goals—like finishing a glass before each meal—to stay consistent."
        ],
        tips: [
          "Infuse water with citrus or cucumber to make sipping more inviting.",
          "Limit dehydrating beverages like energy drinks, especially during focused work sessions."
        ]
      }
    ],
    keyTakeaways: [
      "Carotenoids from leafy greens and brightly colored produce defend against macular damage.",
      "Omega-3 fatty acids keep the tear film stable and comfortable.",
      "Hydration is an underrated way to maintain clear, comfortable vision."
    ],
    resources: [
      { label: "Harvard School of Public Health: Fats and Cholesterol", url: "https://www.hsph.harvard.edu/nutritionsource/what-should-you-eat/fats-and-cholesterol/" },
      { label: "National Eye Institute: Nutrition", url: "https://www.nei.nih.gov/learn-about-eye-health/healthy-vision/nutrition" }
    ],
    tags: ["nutrition", "eye-health", "wellness"],
    relatedSlugs: ["protect-your-vision-daily-habits"]
  },
  {
    slug: "how-to-talk-to-your-eye-doctor",
    title: "How to Talk to Your Eye Doctor: Questions That Lead to Better Care",
    description:
      "Walk into your next eye exam prepared. These conversation starters ensure you understand changes in your vision and leave with a tailored action plan.",
    heroGradient: "from-fuchsia-500 via-purple-500 to-blue-500",
    readTime: "5 min read",
    publishDate: "2024-12-01",
    sections: [
      {
        heading: "Share a Complete Vision Story",
        paragraphs: [
          "Start with specifics: when did symptoms begin, how often do they appear, and what makes them better or worse? The clearer your story, the faster your doctor can pinpoint root causes.",
          "Bring a log of screen time, medications, and supplements. Many prescriptions—from antihistamines to acne medications—can subtly impact tear production and focusing ability."
        ],
        tips: [
          "Keep a simple note on your phone documenting flare-ups or visual changes.",
          "List current eyewear prescriptions so adjustments can be tracked accurately."
        ]
      },
      {
        heading: "Ask About Preventive Screenings",
        paragraphs: [
          "If you have risk factors for glaucoma, macular degeneration, or diabetes, ask which tests are appropriate and how often they should be scheduled.",
          "Understanding baseline images from retinal photos or OCT scans makes it easier to spot changes later."
        ],
        tips: [
          "Request digital copies of any imaging so you can compare year over year.",
          "Clarify insurance coverage or out-of-pocket costs ahead of time to avoid surprises."
        ]
      },
      {
        heading: "Clarify Your Next Steps",
        paragraphs: [
          "Before leaving, summarize what you heard: new prescriptions, follow-up appointments, lifestyle tweaks, and warning signs that warrant a call.",
          "Schedule the next visit while you’re still at the front desk—many eye conditions benefit from consistent monitoring."
        ],
        tips: [
          "Set reminders in your calendar for follow-up visits or contact lens refills.",
          "If you were given new drops or medications, ask for written instructions and possible side effects."
        ]
      }
    ],
    keyTakeaways: [
      "Detailed symptom tracking accelerates accurate diagnoses.",
      "Preventive screenings protect long-term vision, especially for high-risk individuals.",
      "Clear action steps and scheduled follow-ups keep your care plan on track."
    ],
    resources: [
      { label: "American Optometric Association: Comprehensive Eye Exam", url: "https://www.aoa.org/healthy-eyes/caring-for-your-eyes/eye-exam" },
      { label: "Centers for Disease Control and Prevention: Eye Care", url: "https://www.cdc.gov/visionhealth/resources/features/keep-eye-on-vision-health.html" }
    ],
    tags: ["doctor-visits", "communication", "care-planning"],
    relatedSlugs: ["protect-your-vision-daily-habits"]
  }
];
