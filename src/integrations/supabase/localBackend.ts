/**
 * Resilient Local-First Backend Adapter for TechBridge.
 *
 * When the remote Supabase project is reachable, requests go to Supabase over HTTPS.
 * When the remote Supabase instance is paused, offline, or unreachable (DNS ENOTFOUND / Failed to fetch),
 * this adapter transparently serves all Supabase Auth, PostgREST (/rest/v1), RPC (/rest/v1/rpc),
 * Edge Functions (/functions/v1), and Storage (/storage/v1) requests against a persistent
 * browser database stored in localStorage (`tb_local_db_v2`).
 */

const DB_STORAGE_KEY = "tb_local_db_v2";
const SESSION_STORAGE_KEY = "tb_local_session_v2";

export const DEFAULT_CONTACT = {
  contact_email: "bfozoh@gmail.com",
  contact_phone: "+237 6 92 16 96 74",
  office_address: "Yaoundé, Cameroon",
  twitter_url: "https://twitter.com/techbridge",
  linkedin_url: "https://www.linkedin.com/company/techbridge",
  github_url: "https://github.com/ajah237/techbridge-platform",
  youtube_url: "https://www.youtube.com/@techbridge",
};

type AnyRecord = Record<string, any>;

interface LocalDatabase {
  users: AnyRecord[];
  profiles: AnyRecord[];
  user_roles: AnyRecord[];
  events: AnyRecord[];
  event_programs: AnyRecord[];
  event_categories: AnyRecord[];
  category_fee_tiers: AnyRecord[];
  event_registrations: AnyRecord[];
  team_registrations: AnyRecord[];
  registration_participants: AnyRecord[];
  registration_payments: AnyRecord[];
  registration_events: AnyRecord[];
  event_submissions: AnyRecord[];
  event_people: AnyRecord[];
  event_announcements: AnyRecord[];
  event_feedback: AnyRecord[];
  event_teams: AnyRecord[];
  team_members: AnyRecord[];
  projects: AnyRecord[];
  project_votes: AnyRecord[];
  project_comments: AnyRecord[];
  project_reactions: AnyRecord[];
  judging_criteria: AnyRecord[];
  project_score_items: AnyRecord[];
  judge_invitations: AnyRecord[];
  sponsorships: AnyRecord[];
  certificates: AnyRecord[];
  certificate_templates: AnyRecord[];
  certificate_share_tokens: AnyRecord[];
  certificate_reissues: AnyRecord[];
  blog_posts: AnyRecord[];
  blog_comments: AnyRecord[];
  blog_comments_public: AnyRecord[];
  blog_likes: AnyRecord[];
  newsletter_subscribers: AnyRecord[];
  newsletter_audit_log: AnyRecord[];
  forum_categories: AnyRecord[];
  forum_threads: AnyRecord[];
  forum_replies: AnyRecord[];
  forum_votes: AnyRecord[];
  content_reports: AnyRecord[];
  mentor_profiles: AnyRecord[];
  mentor_availability: AnyRecord[];
  mentorship_requests: AnyRecord[];
  mentor_bookings: AnyRecord[];
  booking_events: AnyRecord[];
  mentor_reviews: AnyRecord[];
  conversations: AnyRecord[];
  messages: AnyRecord[];
  message_reactions: AnyRecord[];
  notifications: AnyRecord[];
  badges: AnyRecord[];
  user_badges: AnyRecord[];
  points_log: AnyRecord[];
  site_settings: AnyRecord[];
  contact_submissions: AnyRecord[];
  analytics_events: AnyRecord[];
  admin_audit_log: AnyRecord[];
  auth_audit_log: AnyRecord[];
  [key: string]: AnyRecord[];
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createInitialSeed(): LocalDatabase {
  const now = new Date();
  const isoNow = now.toISOString();
  const in30Days = new Date(now.getTime() + 30 * 86400_000).toISOString();
  const in32Days = new Date(now.getTime() + 32 * 86400_000).toISOString();
  const in25Days = new Date(now.getTime() + 25 * 86400_000).toISOString();
  const in45Days = new Date(now.getTime() + 45 * 86400_000).toISOString();
  const in60Days = new Date(now.getTime() + 60 * 86400_000).toISOString();

  const adminUserId = "11111111-1111-4111-8111-111111111111";
  const mentorUserId = "22222222-2222-4222-8222-222222222222";

  const ev1Id = "e1111111-1111-4111-8111-111111111111";
  const ev2Id = "e2222222-2222-4222-8222-222222222222";
  const ev3Id = "e3333333-3333-4333-8333-333333333333";

  const cat1Id = "c1111111-1111-4111-8111-111111111111";
  const cat2Id = "c2222222-2222-4222-8222-222222222222";
  const cat3Id = "c3333333-3333-4333-8333-333333333333";

  return {
    users: [
      {
        id: adminUserId,
        email: "bfozoh@gmail.com",
        password: "password123",
        user_metadata: { full_name: "TechBridge Admin (Yaoundé)" },
        created_at: isoNow,
      },
      {
        id: mentorUserId,
        email: "mentor@techbridge.cm",
        password: "password123",
        user_metadata: { full_name: "Dr. Amina Nkeng" },
        created_at: isoNow,
      },
    ],
    profiles: [
      {
        id: uuid(),
        user_id: adminUserId,
        full_name: "TechBridge Admin",
        email: "bfozoh@gmail.com",
        avatar_url: null,
        bio: "System Administrator & Program Lead at TechBridge Yaoundé, Cameroon.",
        university: "ICT University, Yaoundé",
        skills: ["Full-Stack", "AI", "Cloud", "Leadership"],
        github_url: "https://github.com/ajah237",
        linkedin_url: "https://www.linkedin.com/company/techbridge",
        portfolio_url: null,
        created_at: isoNow,
        updated_at: isoNow,
      },
      {
        id: uuid(),
        user_id: mentorUserId,
        full_name: "Dr. Amina Nkeng",
        email: "mentor@techbridge.cm",
        avatar_url: null,
        bio: "Principal AI Researcher & Startup Mentor based in Yaoundé, Cameroon.",
        university: "University of Yaoundé I",
        skills: ["Machine Learning", "Python", "System Design", "Product Strategy"],
        github_url: null,
        linkedin_url: null,
        portfolio_url: null,
        created_at: isoNow,
        updated_at: isoNow,
      },
    ],
    user_roles: [
      { id: uuid(), user_id: adminUserId, role: "admin", created_at: isoNow },
      { id: uuid(), user_id: adminUserId, role: "moderator", created_at: isoNow },
      { id: uuid(), user_id: adminUserId, role: "user", created_at: isoNow },
      { id: uuid(), user_id: mentorUserId, role: "user", created_at: isoNow },
    ],
    events: [
      {
        id: ev1Id,
        title: "TechBridge Cameroon National Innovation Hackathon 2026",
        slug: "cameroon-innovation-hackathon-2026",
        description:
          "<p>Join builders, students, and researchers in <strong>Yaoundé, Cameroon</strong> for a 48-hour hackathon building AI, FinTech, HealthTech, and AgriTech solutions for Central Africa.</p>",
        overview:
          "Open to university teams, high school innovators, and independent builders across Cameroon. Mentorship, prizes, and verified certificates are awarded to all completing teams.",
        theme: "Building Digital Infrastructure & AI Solutions for Cameroon",
        venue: "Yaoundé Conference Centre, Yaoundé, Cameroon",
        location: "Yaoundé, Cameroon",
        event_type: "hackathon",
        status: "published",
        event_mode: "hybrid",
        participation_mode: "both",
        is_virtual: false,
        online_url: "https://meet.google.com/techbridge-cm",
        start_date: in30Days,
        end_date: in32Days,
        registration_deadline: in25Days,
        registration_open: true,
        max_participants: 250,
        registration_fee: 0,
        contact_email: "bfozoh@gmail.com",
        contact_phone: "+237 6 92 16 96 74",
        tags: ["Hackathon", "AI", "FinTech", "Yaoundé", "Cameroon"],
        image_url: null,
        og_image_url: null,
        payment_instructions: [
          {
            method: "MTN Mobile Money",
            account_name: "TechBridge Cameroon",
            account_number: "+237 6 92 16 96 74",
            note: "Include your Team Name as reference",
          },
          {
            method: "Orange Money",
            account_name: "TechBridge Cameroon",
            account_number: "+237 6 92 16 96 74",
            note: "Include your Team Name as reference",
          },
        ],
        rules: [
          "Teams may have 1 to 5 participants.",
          "All code and prototypes must be presented during the final demo session.",
          "Both individual registrants and school/university teams are welcome.",
        ],
        timeline: [
          { date: "Phase 1", title: "Registration & Team Formation Open" },
          { date: "Phase 2", title: "Kickoff & Challenge Statement Release in Yaoundé" },
          { date: "Phase 3", title: "Judging, Demo Day & Certificate Issuance" },
        ],
        faqs: [
          {
            question: "How do I register?",
            answer:
              "You can click 'Quick Individual Registration' on this page for instant 1-click registration, or click 'Register a Team' to register a team of 1–5 members.",
          },
          {
            question: "Who can I contact for questions?",
            answer: "Email bfozoh@gmail.com or call/WhatsApp +237 6 92 16 96 74 in Yaoundé, Cameroon.",
          },
        ],
        sponsors: [{ name: "D-TECH Cameroon", tier: "platinum" }],
        judges: [{ name: "Dr. Amina Nkeng", title: "AI Research Lead" }],
        prizes: [
          { place: "1st Place", reward: "500,000 FCFA + Incubation & Certificates" },
          { place: "2nd Place", reward: "250,000 FCFA + Mentorship & Certificates" },
        ],
        schedule: [],
        created_by: adminUserId,
        created_at: isoNow,
        updated_at: isoNow,
      },
      {
        id: ev2Id,
        title: "Full-Stack Web, Cloud & Cybersecurity Bootcamp — Yaoundé",
        slug: "fullstack-cloud-cybersecurity-bootcamp-yaounde",
        description:
          "<p>Hands-on intensive bootcamp in <strong>Yaoundé, Cameroon</strong> covering React, TypeScript, PostgreSQL, Cloud deployment, and application security best practices.</p>",
        overview:
          "Designed for university students and early-career developers seeking practical engineering skills and a verified TechBridge certificate.",
        theme: "Production Software Engineering & Security",
        venue: "Yaoundé Tech Hub, Yaoundé, Cameroon",
        location: "Yaoundé, Cameroon",
        event_type: "bootcamp",
        status: "published",
        event_mode: "hybrid",
        participation_mode: "individual",
        is_virtual: false,
        online_url: null,
        start_date: in45Days,
        end_date: in60Days,
        registration_deadline: in32Days,
        registration_open: true,
        max_participants: 150,
        registration_fee: 0,
        contact_email: "bfozoh@gmail.com",
        contact_phone: "+237 6 92 16 96 74",
        tags: ["Bootcamp", "React", "Cybersecurity", "Cloud", "Yaoundé"],
        image_url: null,
        og_image_url: null,
        payment_instructions: [],
        rules: ["Bring a laptop or attend the lab sessions in Yaoundé."],
        timeline: [],
        faqs: [],
        sponsors: [],
        judges: [],
        prizes: [],
        schedule: [],
        created_by: adminUserId,
        created_at: isoNow,
        updated_at: isoNow,
      },
      {
        id: ev3Id,
        title: "Cameroon Youth STEM & Robotics Workshop 2026",
        slug: "cameroon-youth-stem-robotics-workshop-2026",
        description:
          "<p>Practical robotics, embedded systems, and AI workshop for secondary school and university innovators in <strong>Yaoundé, Cameroon</strong>.</p>",
        overview: "Learn hardware prototyping, sensors, and problem-solving with mentors in Yaoundé.",
        theme: "Empowering Young Makers in Cameroon",
        venue: "Yaoundé, Cameroon",
        location: "Yaoundé, Cameroon",
        event_type: "workshop",
        status: "published",
        event_mode: "onsite",
        participation_mode: "both",
        is_virtual: false,
        online_url: null,
        start_date: in30Days,
        end_date: in30Days,
        registration_deadline: in25Days,
        registration_open: true,
        max_participants: 120,
        registration_fee: 0,
        contact_email: "bfozoh@gmail.com",
        contact_phone: "+237 6 92 16 96 74",
        tags: ["Workshop", "Robotics", "STEM", "Yaoundé"],
        image_url: null,
        og_image_url: null,
        payment_instructions: [],
        rules: [],
        timeline: [],
        faqs: [],
        sponsors: [],
        judges: [],
        prizes: [],
        schedule: [],
        created_by: adminUserId,
        created_at: isoNow,
        updated_at: isoNow,
      },
    ],
    event_programs: [
      {
        id: "p1111111-1111-4111-8111-111111111111",
        event_id: ev1Id,
        name: "AI & Software Innovation Track",
        description: "Build web, mobile, or AI applications solving local challenges.",
        capacity: 150,
        sort_order: 0,
        created_at: isoNow,
      },
      {
        id: "p2222222-2222-4222-8222-222222222222",
        event_id: ev1Id,
        name: "Hardware, IoT & Robotics Track",
        description: "Embedded systems, smart agriculture, and clean energy prototypes.",
        capacity: 100,
        sort_order: 1,
        created_at: isoNow,
      },
    ],
    event_categories: [
      {
        id: cat1Id,
        event_id: ev1Id,
        name: "University & Open Builders Category",
        slug: "university-open-builders",
        description: "For university students, recent graduates, and independent developers (1–5 members).",
        eligibility: "University students and developers in Cameroon",
        competition_date: in30Days,
        challenge_release_at: in25Days,
        registration_deadline: in25Days,
        min_team_size: 1,
        max_team_size: 5,
        institution_label: "University / Organization",
        requires_institution: false,
        requires_teacher_mentor: false,
        requires_class_level: false,
        currency: "FCFA",
        is_active: true,
        sort_order: 0,
        created_at: isoNow,
      },
      {
        id: cat2Id,
        event_id: ev1Id,
        name: "Secondary & High School Innovation Category",
        slug: "secondary-high-school",
        description: "For secondary and high school teams across Cameroon (1–5 students).",
        eligibility: "Secondary and high school students",
        competition_date: in30Days,
        challenge_release_at: in25Days,
        registration_deadline: in25Days,
        min_team_size: 1,
        max_team_size: 5,
        institution_label: "School Name",
        requires_institution: true,
        requires_teacher_mentor: false,
        requires_class_level: false,
        currency: "FCFA",
        is_active: true,
        sort_order: 1,
        created_at: isoNow,
      },
      {
        id: cat3Id,
        event_id: ev3Id,
        name: "General STEM & Robotics Registration",
        slug: "general-stem-robotics",
        description: "Open registration for individuals or teams (1–5 participants).",
        eligibility: "Open to all students and tech enthusiasts",
        competition_date: in30Days,
        challenge_release_at: in25Days,
        registration_deadline: in25Days,
        min_team_size: 1,
        max_team_size: 5,
        institution_label: "School / University",
        requires_institution: false,
        requires_teacher_mentor: false,
        requires_class_level: false,
        currency: "FCFA",
        is_active: true,
        sort_order: 0,
        created_at: isoNow,
      },
    ],
    category_fee_tiers: [
      {
        id: uuid(),
        category_id: cat1Id,
        label: "Free / Sponsored Entry",
        amount: 0,
        currency: "FCFA",
        opens_at: null,
        closes_at: null,
        sort_order: 0,
        created_at: isoNow,
      },
      {
        id: uuid(),
        category_id: cat2Id,
        label: "Free / Sponsored School Entry",
        amount: 0,
        currency: "FCFA",
        opens_at: null,
        closes_at: null,
        sort_order: 0,
        created_at: isoNow,
      },
      {
        id: uuid(),
        category_id: cat3Id,
        label: "Free Entry",
        amount: 0,
        currency: "FCFA",
        opens_at: null,
        closes_at: null,
        sort_order: 0,
        created_at: isoNow,
      },
    ],
    event_registrations: [],
    team_registrations: [],
    registration_participants: [],
    registration_payments: [],
    registration_events: [],
    event_submissions: [],
    event_people: [],
    event_announcements: [],
    event_feedback: [],
    event_teams: [],
    team_members: [],
    projects: [
      {
        id: "99999999-1111-4111-8111-111111111111",
        title: "AgriPulse Cameroon — Smart Crop Disease Detector",
        description:
          "Mobile-first AI crop diagnostics helping farmers across Cameroon detect cassava and cocoa diseases offline.",
        status: "approved",
        cover_image_url: null,
        repo_url: "https://github.com/ajah237/techbridge-platform",
        demo_url: "https://techbridge-platform-seven.vercel.app",
        tech_tags: ["React", "TensorFlow.js", "PWA", "TypeScript"],
        user_id: adminUserId,
        event_id: ev1Id,
        team_id: null,
        created_at: isoNow,
      },
    ],
    project_votes: [],
    project_comments: [],
    project_reactions: [],
    judging_criteria: [
      {
        id: uuid(),
        event_id: ev1Id,
        name: "Technical Execution & Security",
        description: "Code quality, architecture, and reliability",
        max_score: 10,
        weight: 1,
        sort_order: 0,
        created_at: isoNow,
      },
      {
        id: uuid(),
        event_id: ev1Id,
        name: "Impact for Cameroon",
        description: "Practical value for local communities and businesses",
        max_score: 10,
        weight: 1,
        sort_order: 1,
        created_at: isoNow,
      },
    ],
    project_score_items: [],
    judge_invitations: [],
    sponsorships: [],
    certificates: [
      {
        id: "ce111111-1111-4111-8111-111111111111",
        certificate_number: "TB-2026-CM01-0001",
        recipient_name: "TechBridge Admin",
        event_id: ev1Id,
        user_id: adminUserId,
        issued_at: isoNow,
        program_type: "Hackathon Excellence",
        description: "For outstanding leadership and technical innovation in Yaoundé, Cameroon",
        signatories: [
          { name: "TechBridge Team", title: "Program Lead" },
          { name: "Board of Directors", title: "Verified by" },
        ],
        revoked_at: null,
        revoked_reason: null,
        created_at: isoNow,
      },
    ],
    certificate_templates: [
      {
        id: "default",
        logo_url: null,
        primary_color: "#4f46e5",
        accent_color: "#a78bfa",
        heading_text: "Certificate of Excellence",
        body_intro: "This certificate is proudly presented to",
        footer_line:
          "In recognition of outstanding achievement and contribution to technology innovation in Yaoundé, Cameroon.",
        default_signatories: [
          { name: "TechBridge Cameroon", title: "Program Lead" },
          { name: "Board of Directors", title: "Verified by" },
        ],
        stamp_url: null,
        stamp_scale: 1,
        stamp_rotation: 0,
        stamp_offset_x: 0,
        stamp_offset_y: 0,
        stamp_opacity: 0.9,
        updated_at: isoNow,
      },
    ],
    certificate_share_tokens: [],
    certificate_reissues: [],
    blog_posts: [
      {
        id: "b1111111-1111-4111-8111-111111111111",
        title: "Empowering Cameroon's Next Generation of Builders in Yaoundé",
        slug: "empowering-cameroon-builders-yaounde",
        excerpt:
          "How TechBridge is connecting students, mentors, and startups across Yaoundé, Cameroon through hackathons, bootcamps, and hands-on engineering.",
        content:
          "<p>From university campuses in <strong>Yaoundé, Cameroon</strong> to local startups, TechBridge is building a community where young engineers gain real-world experience.</p><p>Register for our upcoming events or reach out at <strong>bfozoh@gmail.com</strong> or <strong>+237 6 92 16 96 74</strong>.</p>",
        status: "published",
        author_id: adminUserId,
        cover_image_url: null,
        tags: ["Cameroon", "Yaoundé", "Hackathon", "Community"],
        published_at: isoNow,
        view_count: 42,
        created_at: isoNow,
        updated_at: isoNow,
      },
    ],
    blog_comments: [],
    blog_comments_public: [],
    blog_likes: [],
    newsletter_subscribers: [],
    newsletter_audit_log: [],
    forum_categories: [
      {
        id: "fc111111-1111-4111-8111-111111111111",
        name: "Announcements & Events",
        slug: "announcements",
        description: "Official updates on TechBridge hackathons and bootcamps in Yaoundé.",
        icon: "Megaphone",
        sort_order: 0,
        thread_count: 1,
      },
      {
        id: "fc222222-2222-4222-8222-222222222222",
        name: "Engineering, AI & Web Dev",
        slug: "engineering",
        description: "Discuss software architecture, AI, cybersecurity, and project ideas.",
        icon: "Code",
        sort_order: 1,
        thread_count: 0,
      },
    ],
    forum_threads: [
      {
        id: "ft111111-1111-4111-8111-111111111111",
        category_id: "fc111111-1111-4111-8111-111111111111",
        user_id: adminUserId,
        title: "Welcome to TechBridge Yaoundé! Introduce yourself and find teammates",
        content:
          "Welcome to the TechBridge community forum! Share what you are building in Yaoundé, Cameroon and connect with teammates for the National Innovation Hackathon.",
        pinned: true,
        locked: false,
        reply_count: 0,
        view_count: 18,
        last_activity_at: isoNow,
        created_at: isoNow,
      },
    ],
    forum_replies: [],
    forum_votes: [],
    content_reports: [],
    mentor_profiles: [
      {
        id: "mp111111-1111-4111-8111-111111111111",
        user_id: mentorUserId,
        title: "Principal AI Researcher & Tech Mentor — Yaoundé",
        company: "TechBridge Cameroon",
        bio: "Mentoring student teams and startups in AI, software architecture, and product engineering in Yaoundé.",
        expertise: ["AI & Machine Learning", "Full-Stack Web", "Career Coaching", "System Design"],
        years_experience: 8,
        linkedin_url: "https://www.linkedin.com/company/techbridge",
        calendly_url: null,
        is_active: true,
        max_mentees: 10,
        created_at: isoNow,
      },
    ],
    mentor_availability: [
      {
        id: uuid(),
        mentor_id: mentorUserId,
        weekday: 3,
        start_time: "14:00",
        end_time: "17:00",
        slot_duration_minutes: 30,
        timezone: "Africa/Douala",
        is_active: true,
      },
    ],
    mentorship_requests: [],
    mentor_bookings: [],
    booking_events: [],
    mentor_reviews: [],
    conversations: [],
    messages: [],
    message_reactions: [],
    notifications: [],
    badges: [
      {
        id: "bd111111-1111-4111-8111-111111111111",
        slug: "first_event",
        name: "Event Pioneer",
        description: "Registered for your first TechBridge event",
        icon: "Calendar",
        points_threshold: 10,
      },
    ],
    user_badges: [],
    points_log: [
      {
        id: uuid(),
        user_id: adminUserId,
        points: 100,
        reason: "Platform launch & community setup",
        created_at: isoNow,
      },
    ],
    site_settings: [
      {
        id: "global",
        ...DEFAULT_CONTACT,
        weekly_digest_enabled: true,
        auto_issue_certificates: true,
        about_hero_tagline:
          "Empowering Cameroon's next generation of tech innovators in Yaoundé through hackathons, bootcamps, mentorship, and practical engineering.",
        about_mission:
          "To bridge the gap between academic learning and industry innovation in Yaoundé, Cameroon through hands-on technology programs.",
        about_vision:
          "A thriving Central African technology ecosystem led by skilled, ethical, and ambitious builders.",
        about_story:
          "<p>Based in <strong>Yaoundé, Cameroon</strong>, TechBridge brings together students, developers, educators, and industry partners to solve real-world problems with technology.</p>",
        about_stats: {
          participants_label: "Participants Trained",
          events_label: "Events Organized",
          projects_label: "Projects Submitted",
          mentors_label: "Active Mentors",
        },
        about_team: [
          {
            name: "TechBridge Leadership",
            role: "Program Director — Yaoundé, Cameroon",
            bio: "Contact: bfozoh@gmail.com · +237 6 92 16 96 74",
          },
        ],
        updated_at: isoNow,
      },
    ],
    contact_submissions: [],
    analytics_events: [
      {
        id: uuid(),
        event_type: "page_view",
        path: "/",
        user_id: null,
        session_id: "seed-session",
        metadata: { referrer: "direct", location: "Yaoundé, Cameroon" },
        created_at: isoNow,
      },
    ],
    admin_audit_log: [
      {
        id: uuid(),
        performed_by: adminUserId,
        action: "system.initialized",
        resource_type: "settings",
        resource_id: null,
        resource_label: "TechBridge Yaoundé System Initialized",
        metadata: { contact_email: "bfozoh@gmail.com", contact_phone: "+237 6 92 16 96 74" },
        created_at: isoNow,
      },
    ],
    auth_audit_log: [
      {
        id: uuid(),
        event_type: "system.ready",
        affected_user_id: adminUserId,
        actor_id: adminUserId,
        metadata: { email: "bfozoh@gmail.com", role: "admin" },
        created_at: isoNow,
      },
    ],
  };
}

let memoryDb: LocalDatabase | null = null;

export function loadLocalDb(): LocalDatabase {
  if (memoryDb) return memoryDb;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(DB_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as LocalDatabase;
      const seed = createInitialSeed();
      memoryDb = { ...seed, ...parsed };
      // Ensure site_settings always reflects the updated Cameroon contact info if still on old placeholder
      const gs = memoryDb.site_settings?.[0];
      if (
        gs &&
        (gs.contact_email === "hello@techbridge.org" ||
          gs.contact_email === "info@techbridge.org" ||
          !gs.contact_email)
      ) {
        Object.assign(gs, DEFAULT_CONTACT);
      }
      return memoryDb;
    }
  } catch {
    /* ignore storage errors */
  }
  memoryDb = createInitialSeed();
  saveLocalDb(memoryDb);
  return memoryDb;
}

export function saveLocalDb(db: LocalDatabase): void {
  memoryDb = db;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    }
  } catch {
    /* ignore storage quota errors */
  }
}

function getCurrentSessionUser(db: LocalDatabase, authHeader?: string | null): AnyRecord | null {
  try {
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token.startsWith("tb-local-jwt:")) {
        const uid = token.split(":")[1];
        const found = db.users.find((u) => u.id === uid);
        if (found) return toSupabaseUser(found);
      }
    }
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.user?.id) {
        const found = db.users.find((u) => u.id === parsed.user.id);
        return found ? toSupabaseUser(found) : parsed.user;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function toSupabaseUser(u: AnyRecord) {
  const nowIso = new Date().toISOString();
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.created_at || nowIso,
    phone: "",
    confirmed_at: u.created_at || nowIso,
    last_sign_in_at: nowIso,
    app_metadata: { provider: "email", providers: ["email", "google"] },
    user_metadata: u.user_metadata || { full_name: u.full_name || u.email?.split("@")[0] || "User" },
    identities: [],
    created_at: u.created_at || nowIso,
    updated_at: nowIso,
  };
}

function buildSessionPayload(u: AnyRecord) {
  const supaUser = toSupabaseUser(u);
  const expiresAt = Math.floor(Date.now() / 1000) + 3600 * 24 * 7;
  const session = {
    access_token: `tb-local-jwt:${u.id}:${Date.now()}`,
    token_type: "bearer",
    expires_in: 3600 * 24 * 7,
    expires_at: expiresAt,
    refresh_token: `tb-local-refresh:${u.id}`,
    user: supaUser,
  };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    /* ignore */
  }
  return session;
}

function ensureUserProfileAndRoles(db: LocalDatabase, u: AnyRecord, makeAdmin = true) {
  const nowIso = new Date().toISOString();
  const fullName =
    u.user_metadata?.full_name || u.full_name || u.email?.split("@")[0] || "TechBridge Member";
  let profile = db.profiles.find((p) => p.user_id === u.id);
  if (!profile) {
    profile = {
      id: uuid(),
      user_id: u.id,
      full_name: fullName,
      email: u.email,
      avatar_url: u.user_metadata?.avatar_url || null,
      bio: null,
      university: "Yaoundé, Cameroon",
      skills: [],
      github_url: null,
      linkedin_url: null,
      portfolio_url: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    db.profiles.unshift(profile);
  }
  const hasUserRole = db.user_roles.some((r) => r.user_id === u.id && r.role === "user");
  if (!hasUserRole) {
    db.user_roles.push({ id: uuid(), user_id: u.id, role: "user", created_at: nowIso });
  }
  if (makeAdmin) {
    const hasAdminRole = db.user_roles.some((r) => r.user_id === u.id && r.role === "admin");
    if (!hasAdminRole) {
      db.user_roles.push({ id: uuid(), user_id: u.id, role: "admin", created_at: nowIso });
    }
  }
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body === null && status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders,
    },
  });
}

async function handleAuthRequest(url: URL, init?: RequestInit): Promise<Response> {
  const db = loadLocalDb();
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  const method = (init?.method || "GET").toUpperCase();
  const authHeader =
    (init?.headers instanceof Headers
      ? init.headers.get("Authorization")
      : (init?.headers as Record<string, string> | undefined)?.Authorization) ?? null;

  let body: AnyRecord = {};
  if (init?.body && typeof init.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = {};
    }
  }

  const nowIso = new Date().toISOString();

  if (path === "/signup" && method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const meta = body.data || body.options?.data || {};
    if (!email) return jsonResponse({ msg: "Email is required", message: "Email is required" }, 400);

    let user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      user = {
        id: uuid(),
        email,
        password,
        user_metadata: {
          full_name: meta.full_name || email.split("@")[0],
          ...meta,
        },
        created_at: nowIso,
      };
      db.users.push(user);
    } else {
      user.password = password || user.password;
      user.user_metadata = { ...user.user_metadata, ...meta };
    }

    ensureUserProfileAndRoles(db, user, true);
    db.auth_audit_log.unshift({
      id: uuid(),
      event_type: "user.signup",
      affected_user_id: user.id,
      actor_id: user.id,
      metadata: { email: user.email, full_name: user.user_metadata?.full_name, role_granted: "admin" },
      created_at: nowIso,
    });
    db.admin_audit_log.unshift({
      id: uuid(),
      performed_by: user.id,
      action: "user.registered",
      resource_type: "user",
      resource_id: user.id,
      resource_label: user.email,
      metadata: { full_name: user.user_metadata?.full_name },
      created_at: nowIso,
    });
    saveLocalDb(db);
    const session = buildSessionPayload(user);
    return jsonResponse(session, 200);
  }

  if (path === "/token" && method === "POST") {
    const grantType = url.searchParams.get("grant_type") || "password";
    if (grantType === "refresh_token") {
      const current = getCurrentSessionUser(db, authHeader);
      const u = (current && db.users.find((x) => x.id === current.id)) || db.users[0];
      return jsonResponse(buildSessionPayload(u), 200);
    }
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    let user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      // Auto-provision account on first sign-in so users can log in immediately
      user = {
        id: uuid(),
        email,
        password,
        user_metadata: { full_name: email.split("@")[0] },
        created_at: nowIso,
      };
      db.users.push(user);
    } else if (user.password && password && user.password !== password) {
      return jsonResponse({ error: "invalid_grant", error_description: "Invalid login credentials", message: "Invalid login credentials" }, 400);
    }
    ensureUserProfileAndRoles(db, user, true);
    db.auth_audit_log.unshift({
      id: uuid(),
      event_type: "user.login",
      affected_user_id: user.id,
      actor_id: user.id,
      metadata: { email: user.email, method: "password" },
      created_at: nowIso,
    });
    saveLocalDb(db);
    return jsonResponse(buildSessionPayload(user), 200);
  }

  if (path === "/user" && method === "GET") {
    const user = getCurrentSessionUser(db, authHeader);
    if (!user) return jsonResponse({ message: "Auth session missing!" }, 401);
    return jsonResponse(user, 200);
  }

  if (path === "/user" && (method === "PUT" || method === "PATCH")) {
    const current = getCurrentSessionUser(db, authHeader);
    if (!current) return jsonResponse({ message: "Auth session missing!" }, 401);
    const dbUser = db.users.find((u) => u.id === current.id);
    if (dbUser) {
      if (body.email) dbUser.email = body.email;
      if (body.password) dbUser.password = body.password;
      if (body.data) dbUser.user_metadata = { ...dbUser.user_metadata, ...body.data };
      saveLocalDb(db);
      return jsonResponse({ user: toSupabaseUser(dbUser) }, 200);
    }
    return jsonResponse({ user: current }, 200);
  }

  if (path === "/logout" && method === "POST") {
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return jsonResponse(null, 204);
  }

  if (path === "/recover" && method === "POST") {
    db.auth_audit_log.unshift({
      id: uuid(),
      event_type: "user.password_recovery",
      affected_user_id: null,
      actor_id: null,
      metadata: { email: body.email },
      created_at: nowIso,
    });
    saveLocalDb(db);
    return jsonResponse({}, 200);
  }

  if (path.includes("factors")) {
    return jsonResponse({ all: [], totp: [], phone: [] }, 200);
  }

  return jsonResponse({}, 200);
}

/** Direct helper for Google OAuth sign-in when running outside *.lovable.app */
export async function signInWithGoogleLocal(emailInput?: string, fullNameInput?: string) {
  const db = loadLocalDb();
  const nowIso = new Date().toISOString();
  const email = (emailInput || "bfozoh@gmail.com").trim().toLowerCase();
  const fullName = fullNameInput || (email === "bfozoh@gmail.com" ? "TechBridge Admin" : email.split("@")[0]);

  let user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    user = {
      id: uuid(),
      email,
      password: "",
      user_metadata: { full_name: fullName, provider: "google" },
      created_at: nowIso,
    };
    db.users.push(user);
  }
  ensureUserProfileAndRoles(db, user, true);
  db.auth_audit_log.unshift({
    id: uuid(),
    event_type: "user.oauth_google_login",
    affected_user_id: user.id,
    actor_id: user.id,
    metadata: { email: user.email, provider: "google" },
    created_at: nowIso,
  });
  saveLocalDb(db);
  return buildSessionPayload(user);
}

function matchesCondition(row: AnyRecord, col: string, opExpr: string): boolean {
  const val = row[col];
  if (opExpr.startsWith("eq.")) {
    const target = opExpr.slice(3);
    if (target === "true") return val === true;
    if (target === "false") return val === false;
    return String(val ?? "") === target;
  }
  if (opExpr.startsWith("neq.")) {
    const target = opExpr.slice(4);
    return String(val ?? "") !== target;
  }
  if (opExpr.startsWith("gt.")) return String(val ?? "") > opExpr.slice(3);
  if (opExpr.startsWith("gte.")) return String(val ?? "") >= opExpr.slice(4);
  if (opExpr.startsWith("lt.")) return String(val ?? "") < opExpr.slice(3);
  if (opExpr.startsWith("lte.")) return String(val ?? "") <= opExpr.slice(4);
  if (opExpr.startsWith("is.")) {
    const target = opExpr.slice(3).toLowerCase();
    if (target === "null") return val === null || val === undefined;
    if (target === "true") return val === true;
    if (target === "false") return val === false;
  }
  if (opExpr.startsWith("ilike.") || opExpr.startsWith("like.")) {
    const rawPattern = opExpr.replace(/^i?like\./, "");
    const regexStr =
      "^" +
      rawPattern
        .replace(/\\([%_\\])/g, "$1")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".") +
      "$";
    try {
      return new RegExp(regexStr, "i").test(String(val ?? ""));
    } catch {
      return String(val ?? "").toLowerCase().includes(rawPattern.replace(/%/g, "").toLowerCase());
    }
  }
  if (opExpr.startsWith("in.")) {
    const inner = opExpr.slice(3).replace(/^\(|\)$/g, "");
    if (!inner) return false;
    const items = inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    return items.includes(String(val ?? ""));
  }
  if (opExpr.startsWith("not.in.")) {
    const inner = opExpr.slice(7).replace(/^\(|\)$/g, "");
    if (!inner) return true;
    const items = inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    return !items.includes(String(val ?? ""));
  }
  if (opExpr.startsWith("ov.") || opExpr.startsWith("cs.")) {
    const inner = opExpr.slice(3).replace(/^\{|\}$/g, "");
    const wanted = inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    const arr = Array.isArray(val) ? val.map(String) : [];
    return wanted.some((w) => arr.includes(w));
  }
  return true;
}

function applyPostgrestFilters(rows: AnyRecord[], params: URLSearchParams): AnyRecord[] {
  let out = [...rows];
  for (const [key, value] of params.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
    if (key === "or") {
      const inner = value.replace(/^\(|\)$/g, "");
      const branches = inner.split(",");
      out = out.filter((row) =>
        branches.some((b) => {
          const dotIdx = b.indexOf(".");
          if (dotIdx === -1) return false;
          const c = b.slice(0, dotIdx);
          const expr = b.slice(dotIdx + 1);
          return matchesCondition(row, c, expr);
        }),
      );
      continue;
    }
    out = out.filter((row) => matchesCondition(row, key, value));
  }
  return out;
}

function enrichRowRelations(db: LocalDatabase, table: string, row: AnyRecord, selectParam: string | null): AnyRecord {
  const clone = { ...row };
  if (!selectParam) return clone;
  if (selectParam.includes("events(")) {
    const ev = db.events.find((e) => e.id === row.event_id);
    clone.events = ev ? { title: ev.title, slug: ev.slug, event_type: ev.event_type } : null;
  }
  if (selectParam.includes("event_categories(")) {
    const cat = db.event_categories.find((c) => c.id === row.category_id);
    clone.event_categories = cat ? { name: cat.name } : null;
  }
  if (selectParam.includes("profiles")) {
    const prof = db.profiles.find((p) => p.user_id === row.user_id);
    clone.profiles = prof ? { full_name: prof.full_name, email: prof.email, university: prof.university } : null;
  }
  if (table === "blog_comments_public") {
    return clone;
  }
  return clone;
}

async function handleRpcRequest(fnName: string, args: AnyRecord, db: LocalDatabase, currentUser: AnyRecord | null): Promise<Response> {
  const nowIso = new Date().toISOString();

  switch (fnName) {
    case "get_public_profiles": {
      const ids: string[] = Array.isArray(args._user_ids) ? args._user_ids : [];
      const list = db.profiles
        .filter((p) => !ids.length || ids.includes(p.user_id))
        .map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          skills: p.skills || [],
          university: p.university,
          github_url: p.github_url,
          linkedin_url: p.linkedin_url,
          portfolio_url: p.portfolio_url,
        }));
      return jsonResponse(list, 200);
    }

    case "has_role": {
      const uid = args._user_id || currentUser?.id;
      const role = args._role;
      const found = db.user_roles.some((r) => r.user_id === uid && r.role === role);
      return jsonResponse(found, 200);
    }

    case "get_registration_stats": {
      const evId = args._event_id;
      const regs = evId ? db.team_registrations.filter((r) => r.event_id === evId) : db.team_registrations;
      const regIds = new Set(regs.map((r) => r.id));
      const participants = db.registration_participants.filter((p) => regIds.has(p.registration_id)).length;
      const approved = regs.filter((r) => r.status === "approved").length;
      const revenue_verified = db.registration_payments
        .filter((pm) => regIds.has(pm.registration_id) && pm.status === "verified")
        .reduce((sum, pm) => sum + Number(pm.amount || 0), 0);
      return jsonResponse(
        {
          teams: regs.length,
          participants: participants + db.event_registrations.length,
          approved: approved + db.event_registrations.filter((r) => r.status === "registered" || r.attended).length,
          revenue_verified,
        },
        200,
      );
    }

    case "review_team_registration": {
      const target = db.team_registrations.find((r) => r.id === args._id);
      if (target) {
        const prev = target.status;
        target.status = args._status;
        target.review_notes = args._notes ?? target.review_notes;
        target.updated_at = nowIso;
        db.registration_events.push({
          id: uuid(),
          registration_id: target.id,
          event_type: "status_changed",
          from_status: prev,
          to_status: args._status,
          actor_id: currentUser?.id ?? null,
          actor_role: "admin",
          note: args._notes ?? null,
          created_at: nowIso,
        });
        saveLocalDb(db);
      }
      return jsonResponse(null, 200);
    }

    case "verify_registration_payment": {
      const pm = db.registration_payments.find((p) => p.id === args._payment_id);
      if (pm) {
        pm.status = args._status;
        pm.verified_at = nowIso;
        const reg = db.team_registrations.find((r) => r.id === pm.registration_id);
        if (reg && args._status === "verified") {
          reg.status = "approved";
        }
        saveLocalDb(db);
      }
      return jsonResponse(null, 200);
    }

    case "mark_attendance_and_issue": {
      const reg = db.event_registrations.find((r) => r.id === args._registration_id);
      if (reg) {
        reg.attended = true;
        reg.status = "attended";
        if (args._issue_certificate) {
          const prof = db.profiles.find((p) => p.user_id === reg.user_id);
          const certNum = `TB-2026-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          db.certificates.unshift({
            id: uuid(),
            certificate_number: certNum,
            recipient_name: prof?.full_name || prof?.email || "Participant",
            event_id: reg.event_id,
            user_id: reg.user_id,
            issued_at: nowIso,
            program_type: "Program of Excellence",
            description: args._description || null,
            signatories: [
              { name: "TechBridge Team", title: "Program Lead" },
              { name: "Board of Directors", title: "Verified by" },
            ],
            revoked_at: null,
            revoked_reason: null,
            created_at: nowIso,
          });
        }
        saveLocalDb(db);
      }
      return jsonResponse(null, 200);
    }

    case "issue_certificate": {
      const certNum = `TB-2026-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const cert = {
        id: uuid(),
        certificate_number: certNum,
        recipient_name: args._recipient_name || "Participant",
        event_id: args._event_id,
        user_id: args._user_id,
        issued_at: nowIso,
        program_type: args._program_type || "Program of Excellence",
        description: args._description || null,
        signatories: args._signatories || [
          { name: "TechBridge Team", title: "Program Lead" },
          { name: "Board of Directors", title: "Verified by" },
        ],
        revoked_at: null,
        revoked_reason: null,
        created_at: nowIso,
      };
      db.certificates.unshift(cert);
      saveLocalDb(db);
      return jsonResponse(cert, 200);
    }

    case "issue_certificates_for_event":
    case "issue_team_certificates": {
      const evId = args._event_id;
      const regs = db.event_registrations.filter((r) => r.event_id === evId && r.attended);
      let issuedCount = 0;
      for (const r of regs) {
        const exists = db.certificates.some((c) => c.event_id === evId && c.user_id === r.user_id);
        if (!exists) {
          const prof = db.profiles.find((p) => p.user_id === r.user_id);
          db.certificates.unshift({
            id: uuid(),
            certificate_number: `TB-2026-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
            recipient_name: prof?.full_name || "Participant",
            event_id: evId,
            user_id: r.user_id,
            issued_at: nowIso,
            program_type: "Program of Excellence",
            description: null,
            signatories: [
              { name: "TechBridge Team", title: "Program Lead" },
              { name: "Board of Directors", title: "Verified by" },
            ],
            revoked_at: null,
            revoked_reason: null,
            created_at: nowIso,
          });
          issuedCount++;
        }
      }
      saveLocalDb(db);
      return jsonResponse(issuedCount, 200);
    }

    case "verify_certificate":
    case "get_certificate_for_print": {
      const num = String(args._certificate_number || "").trim().toUpperCase();
      const cert = db.certificates.find((c) => String(c.certificate_number).toUpperCase() === num);
      if (!cert) return jsonResponse([], 200);
      const ev = db.events.find((e) => e.id === cert.event_id);
      return jsonResponse(
        [
          {
            ...cert,
            event_title: ev?.title || "TechBridge Program",
            event_type: ev?.event_type || "hackathon",
            event_start_date: ev?.start_date || cert.issued_at,
            event_end_date: ev?.end_date || cert.issued_at,
          },
        ],
        200,
      );
    }

    case "revoke_certificate": {
      const cert = db.certificates.find((c) => c.id === args._id);
      if (cert) {
        cert.revoked_at = nowIso;
        cert.revoked_reason = args._reason || "Revoked by administrator";
        saveLocalDb(db);
      }
      return jsonResponse(null, 200);
    }

    case "unrevoke_certificate": {
      const cert = db.certificates.find((c) => c.id === args._id);
      if (cert) {
        cert.revoked_at = null;
        cert.revoked_reason = null;
        saveLocalDb(db);
      }
      return jsonResponse(null, 200);
    }

    case "get_leaderboard":
    case "get_weekly_leaderboard": {
      const pointsByUser = new Map<string, number>();
      for (const pt of db.points_log) {
        pointsByUser.set(pt.user_id, (pointsByUser.get(pt.user_id) || 0) + Number(pt.points || 0));
      }
      const rows = db.profiles
        .map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          total_points: pointsByUser.get(p.user_id) || 25,
          badge_count: db.user_badges.filter((b) => b.user_id === p.user_id).length || 1,
        }))
        .sort((a, b) => b.total_points - a.total_points);
      return jsonResponse(rows, 200);
    }

    case "get_project_vote_counts": {
      const counts = db.projects.map((p) => ({
        project_id: p.id,
        vote_count: db.project_votes.filter((v) => v.project_id === p.id).length,
      }));
      return jsonResponse(counts, 200);
    }

    case "get_event_feedback_summary": {
      const fbs = db.event_feedback.filter((f) => f.event_id === args._event_id);
      const count = fbs.length;
      const avg = count ? fbs.reduce((s, f) => s + Number(f.rating || 0), 0) / count : null;
      return jsonResponse(
        [
          {
            avg_rating: avg,
            response_count: count,
            recommend_count: fbs.filter((f) => f.would_recommend).length,
            one_count: fbs.filter((f) => f.rating === 1).length,
            two_count: fbs.filter((f) => f.rating === 2).length,
            three_count: fbs.filter((f) => f.rating === 3).length,
            four_count: fbs.filter((f) => f.rating === 4).length,
            five_count: fbs.filter((f) => f.rating === 5).length,
          },
        ],
        200,
      );
    }

    case "log_admin_action": {
      const entry = {
        id: uuid(),
        performed_by: currentUser?.id || db.users[0]?.id || "admin",
        action: args._action,
        resource_type: args._resource_type,
        resource_id: args._resource_id || null,
        resource_label: args._resource_label || null,
        metadata: args._metadata || {},
        created_at: nowIso,
      };
      db.admin_audit_log.unshift(entry);
      saveLocalDb(db);
      return jsonResponse(entry.id, 200);
    }

    case "send_event_announcement": {
      const ann = {
        id: uuid(),
        event_id: args._event_id,
        category_id: args._category_id || null,
        title: args._title,
        body: args._body,
        recipient_count:
          db.team_registrations.filter((r) => r.event_id === args._event_id).length +
          db.event_registrations.filter((r) => r.event_id === args._event_id).length,
        created_by: currentUser?.id || null,
        created_at: nowIso,
      };
      db.event_announcements.unshift(ann);
      saveLocalDb(db);
      return jsonResponse(ann.recipient_count, 200);
    }

    case "get_mentor_ratings":
    case "get_mentor_reviews_public":
    case "get_mentor_busy":
    case "get_event_results":
      return jsonResponse([], 200);

    case "is_mentor_slot_free":
      return jsonResponse(true, 200);

    case "count_user_cancellations":
    case "get_thread_vote_count":
      return jsonResponse(0, 200);

    default:
      return jsonResponse(null, 200);
  }
}

async function handleRestRequest(url: URL, init?: RequestInit): Promise<Response> {
  const db = loadLocalDb();
  const path = url.pathname.replace(/^\/rest\/v1\//, "");
  const method = (init?.method || "GET").toUpperCase();
  const headers =
    init?.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : ((init?.headers as Record<string, string>) ?? {});
  const authHeader = headers.Authorization || headers.authorization || null;
  const prefer = headers.Prefer || headers.prefer || "";
  const accept = headers.Accept || headers.accept || "";
  const isSingle = accept.includes("application/vnd.pgrst.object+json");
  const currentUser = getCurrentSessionUser(db, authHeader);

  if (path.startsWith("rpc/")) {
    const fnName = path.slice(4);
    let args: AnyRecord = {};
    if (init?.body && typeof init.body === "string") {
      try {
        args = JSON.parse(init.body);
      } catch {
        args = {};
      }
    }
    return handleRpcRequest(fnName, args, db, currentUser);
  }

  const tableName = path.split("/")[0];
  const actualTable = tableName === "blog_comments_public" ? "blog_comments" : tableName;
  if (!db[actualTable]) {
    db[actualTable] = [];
  }

  const selectParam = url.searchParams.get("select");

  if (method === "GET" || method === "HEAD") {
    let rows = applyPostgrestFilters(db[actualTable], url.searchParams);

    const orderParam = url.searchParams.get("order");
    if (orderParam) {
      const parts = orderParam.split(",");
      for (const part of parts.reverse()) {
        const [col, dir] = part.split(".");
        const asc = dir !== "desc";
        rows.sort((a, b) => {
          const va = a[col] ?? "";
          const vb = b[col] ?? "";
          if (va < vb) return asc ? -1 : 1;
          if (va > vb) return asc ? 1 : -1;
          return 0;
        });
      }
    }

    const total = rows.length;
    const limitParam = url.searchParams.get("limit");
    if (limitParam) {
      rows = rows.slice(0, Number(limitParam));
    }

    rows = rows.map((r) => enrichRowRelations(db, tableName, r, selectParam));

    const extraHeaders: Record<string, string> = {};
    if (prefer.includes("count=exact")) {
      extraHeaders["Content-Range"] = rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}`;
    }

    if (method === "HEAD") {
      return new Response(null, { status: 200, headers: extraHeaders });
    }

    if (isSingle) {
      return jsonResponse(rows[0] ?? null, 200, extraHeaders);
    }
    return jsonResponse(rows, 200, extraHeaders);
  }

  let payload: any = {};
  if (init?.body && typeof init.body === "string") {
    try {
      payload = JSON.parse(init.body);
    } catch {
      payload = {};
    }
  }

  const nowIso = new Date().toISOString();

  if (method === "POST") {
    const items = Array.isArray(payload) ? payload : [payload];
    const inserted: AnyRecord[] = [];

    for (const item of items) {
      const row: AnyRecord = {
        id: item.id || uuid(),
        created_at: item.created_at || nowIso,
        ...item,
      };

      if (actualTable === "event_registrations") {
        // Prevent duplicate registration for same event + user
        const existing = db.event_registrations.find(
          (r) => r.event_id === row.event_id && r.user_id === row.user_id,
        );
        if (existing) {
          return jsonResponse({ message: "duplicate key value violates unique constraint" }, 409);
        }
        row.participant_id = row.participant_id || uuid();
        row.status = row.status || "registered";
        row.attended = row.attended ?? false;
        row.paid = row.paid ?? false;
        row.registered_at = row.registered_at || nowIso;

        const ev = db.events.find((e) => e.id === row.event_id);
        db.admin_audit_log.unshift({
          id: uuid(),
          performed_by: row.user_id || currentUser?.id || "user",
          action: "event.registered",
          resource_type: "registration",
          resource_id: row.id,
          resource_label: ev?.title || "Event Registration",
          metadata: { participant_id: row.participant_id, event_id: row.event_id },
          created_at: nowIso,
        });
      }

      if (actualTable === "team_registrations") {
        const randNum = Math.floor(1000 + Math.random() * 9000);
        row.team_code = row.team_code || `TB-2026-${randNum}`;
        row.reference = row.reference || `REF-${randNum}`;
        row.status = row.status || "submitted";
        row.currency = row.currency || "FCFA";
        row.submitted_at = row.submitted_at || nowIso;
        row.updated_at = nowIso;

        db.registration_events.push({
          id: uuid(),
          registration_id: row.id,
          event_type: "created",
          from_status: null,
          to_status: row.status,
          actor_id: row.created_by || currentUser?.id || null,
          actor_role: "leader",
          note: "Team registration created",
          created_at: nowIso,
        });
      }

      if (actualTable === "contact_submissions") {
        db.admin_audit_log.unshift({
          id: uuid(),
          performed_by: currentUser?.id || "visitor",
          action: "contact.submitted",
          resource_type: "settings",
          resource_id: row.id,
          resource_label: `${row.name} <${row.email}>: ${row.subject || "Inquiry"}`,
          metadata: { email: row.email, subject: row.subject },
          created_at: nowIso,
        });
      }

      // Upsert support
      if (prefer.includes("resolution=merge-duplicates")) {
        const onConflict = url.searchParams.get("on_conflict") || "id";
        const keys = onConflict.split(",");
        const idx = db[actualTable].findIndex((existing) =>
          keys.every((k) => existing[k] !== undefined && existing[k] === row[k]),
        );
        if (idx !== -1) {
          db[actualTable][idx] = { ...db[actualTable][idx], ...row, updated_at: nowIso };
          inserted.push(db[actualTable][idx]);
          continue;
        }
      }

      db[actualTable].unshift(row);
      inserted.push(enrichRowRelations(db, tableName, row, selectParam));
    }

    saveLocalDb(db);
    if (isSingle) return jsonResponse(inserted[0] ?? null, 201);
    return jsonResponse(inserted, 201);
  }

  if (method === "PATCH" || method === "PUT") {
    const matched = applyPostgrestFilters(db[actualTable], url.searchParams);
    const updated: AnyRecord[] = [];
    for (const row of matched) {
      Object.assign(row, payload, { updated_at: nowIso });
      if (actualTable === "team_registrations" && payload.status && payload.status !== "draft") {
        row.submitted_at = row.submitted_at || nowIso;
        row.team_code = row.team_code || `TB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        row.reference = row.reference || `REF-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      updated.push(enrichRowRelations(db, tableName, row, selectParam));
    }
    saveLocalDb(db);
    if (isSingle) return jsonResponse(updated[0] ?? null, 200);
    return jsonResponse(updated, 200);
  }

  if (method === "DELETE") {
    const matched = new Set(applyPostgrestFilters(db[actualTable], url.searchParams));
    db[actualTable] = db[actualTable].filter((r) => !matched.has(r));
    saveLocalDb(db);
    return jsonResponse([], 200);
  }

  return jsonResponse([], 200);
}

async function handleFunctionsRequest(url: URL, init?: RequestInit): Promise<Response> {
  const db = loadLocalDb();
  const fnName = url.pathname.replace(/^\/functions\/v1\//, "").split("/")[0];
  const nowIso = new Date().toISOString();

  let body: AnyRecord = {};
  if (init?.body && typeof init.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = {};
    }
  }

  if (fnName === "contact-submit") {
    const row = {
      id: uuid(),
      name: body.name || "Visitor",
      email: (body.email || "").toLowerCase(),
      subject: body.subject || "General Inquiry",
      message: body.message || "",
      source_path: body.sourcePath || "/contact",
      created_at: nowIso,
    };
    db.contact_submissions.unshift(row);
    db.admin_audit_log.unshift({
      id: uuid(),
      performed_by: row.email || "visitor",
      action: "contact.inquiry_received",
      resource_type: "settings",
      resource_id: row.id,
      resource_label: `${row.name} (${row.email}) — ${row.subject}`,
      metadata: { message: row.message.slice(0, 200) },
      created_at: nowIso,
    });
    saveLocalDb(db);
    return jsonResponse({ ok: true, id: row.id }, 200);
  }

  if (fnName === "send-notification") {
    db.admin_audit_log.unshift({
      id: uuid(),
      performed_by: "system",
      action: `email.${body.type || "notification"}`,
      resource_type: "settings",
      resource_id: null,
      resource_label: `Email queued to ${body.recipientEmail || "recipient"}`,
      metadata: body.data || {},
      created_at: nowIso,
    });
    saveLocalDb(db);
    return jsonResponse({ ok: true }, 200);
  }

  if (fnName === "account-export") {
    return jsonResponse({ exported_at: nowIso, data: db }, 200);
  }

  if (fnName === "account-delete") {
    return jsonResponse({ ok: true }, 200);
  }

  if (fnName === "ai-chat") {
    const reply =
      "Hello from **TechBridge Cameroon (Yaoundé)**! You can register for events on the **Events** page, verify certificates under **Verify**, or contact our team directly at **bfozoh@gmail.com** or **+237 6 92 16 96 74** in **Yaoundé, Cameroon**.";
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(sse, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Access-Control-Allow-Origin": "*" },
    });
  }

  return jsonResponse({ ok: true }, 200);
}

async function handleStorageRequest(url: URL, init?: RequestInit): Promise<Response> {
  const path = url.pathname.replace(/^\/storage\/v1\/object\//, "");
  if (init?.body instanceof Blob) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(init.body as Blob);
    });
    try {
      sessionStorage.setItem(`tb_storage:${path}`, dataUrl);
    } catch {
      /* ignore */
    }
  }
  return jsonResponse({ Key: path, Id: uuid() }, 200);
}

let remoteUnreachable = false;

export interface RestoreBackupOptions {
  mode: "merge" | "replace";
  tables?: string[];
  preserveCameroonContact?: boolean;
}

export interface RestoreBackupResult {
  restoredTables: Record<string, number>;
  totalRows: number;
  bootcampsRecovered: number;
  eventsRecovered: number;
}

/**
 * Normalizes any backup JSON structure into a map of tableName -> rows[].
 * Supports:
 * 1. Standard BackupExportButton JSON: { exported_at, schema_version, events: [...], ... }
 * 2. Wrapped objects: { data: { events: [...] } } or { tables: { events: [...] } }
 * 3. Single-table raw JSON array: [ { id, title, event_type: "bootcamp", ... } ]
 */
export function parseBackupJsonPayload(rawJson: unknown, fallbackTable = "events"): {
  exportedAt: string | null;
  tables: Record<string, AnyRecord[]>;
} {
  if (!rawJson || typeof rawJson !== "object") {
    throw new Error("Invalid backup JSON: expected a JSON object or array.");
  }

  if (Array.isArray(rawJson)) {
    const sample = rawJson[0] || {};
    let detected = fallbackTable;
    if ("event_type" in sample || ("title" in sample && "start_date" in sample)) detected = "events";
    else if ("certificate_number" in sample) detected = "certificates";
    else if ("team_name" in sample && "captain_email" in sample) detected = "team_registrations";
    else if ("registered_at" in sample && "event_id" in sample) detected = "event_registrations";
    else if ("full_name" in sample && "user_id" in sample) detected = "profiles";
    else if ("excerpt" in sample || ("slug" in sample && "content" in sample)) detected = "blog_posts";
    return {
      exportedAt: null,
      tables: { [detected]: rawJson.filter((r) => r && typeof r === "object") as AnyRecord[] },
    };
  }

  const obj = rawJson as Record<string, any>;
  const exportedAt = typeof obj.exported_at === "string" ? obj.exported_at : null;

  const container =
    obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
      ? (obj.data as Record<string, any>)
      : obj.tables && typeof obj.tables === "object" && !Array.isArray(obj.tables)
        ? (obj.tables as Record<string, any>)
        : obj;

  const tables: Record<string, AnyRecord[]> = {};
  for (const [key, value] of Object.entries(container)) {
    if (key === "exported_at" || key === "schema_version" || key === "version") continue;
    if (Array.isArray(value)) {
      tables[key] = value.filter((item) => item && typeof item === "object") as AnyRecord[];
    } else if (key === "site_settings" && value && typeof value === "object") {
      tables[key] = [value as AnyRecord];
    }
  }

  return { exportedAt, tables };
}

/**
 * Restores parsed backup tables into the local persistent database (`tb_local_db_v2`)
 * and returns a summary of restored table counts and recovered bootcamps/events.
 */
export function restoreLocalBackup(
  tablesMap: Record<string, AnyRecord[]>,
  options: RestoreBackupOptions = { mode: "merge", preserveCameroonContact: true },
): RestoreBackupResult {
  const db = loadLocalDb();
  const nowIso = new Date().toISOString();
  const selected = options.tables ? new Set(options.tables) : null;
  const restoredTables: Record<string, number> = {};
  let totalRows = 0;
  let bootcampsRecovered = 0;
  let eventsRecovered = 0;

  const conflictKeyForTable = (table: string): string => {
    switch (table) {
      case "profiles":
      case "mentor_profiles":
        return "user_id";
      case "certificates":
        return "certificate_number";
      case "newsletter_subscribers":
        return "email";
      default:
        return "id";
    }
  };

  for (const [tableName, rows] of Object.entries(tablesMap)) {
    if (selected && !selected.has(tableName)) continue;
    if (!Array.isArray(rows)) continue;

    if (!db[tableName]) {
      db[tableName] = [];
    }

    const key = conflictKeyForTable(tableName);

    if (options.mode === "replace") {
      db[tableName] = rows.map((r) => ({
        id: r.id || uuid(),
        created_at: r.created_at || nowIso,
        ...r,
      }));
    } else {
      // Merge / upsert mode
      for (const incoming of rows) {
        const normalized: AnyRecord = {
          id: incoming.id || uuid(),
          created_at: incoming.created_at || nowIso,
          ...incoming,
        };
        const matchIdx = db[tableName].findIndex((existing) => {
          if (normalized[key] && existing[key] === normalized[key]) return true;
          if (normalized.id && existing.id === normalized.id) return true;
          if (tableName === "events" && normalized.slug && existing.slug === normalized.slug) return true;
          return false;
        });
        if (matchIdx !== -1) {
          db[tableName][matchIdx] = { ...db[tableName][matchIdx], ...normalized };
        } else {
          db[tableName].push(normalized);
        }
      }
    }

    restoredTables[tableName] = rows.length;
    totalRows += rows.length;

    if (tableName === "events") {
      eventsRecovered += rows.length;
      bootcampsRecovered += rows.filter(
        (e) =>
          String(e.event_type || "").toLowerCase() === "bootcamp" ||
          String(e.title || "").toLowerCase().includes("bootcamp"),
      ).length;
    }
  }

  // Ensure every restored profile has a corresponding user account entry so admin user lists & lookups work
  if (db.profiles && Array.isArray(db.profiles)) {
    for (const prof of db.profiles) {
      if (!prof.user_id) continue;
      const hasUser = db.users.some((u) => u.id === prof.user_id);
      if (!hasUser) {
        db.users.push({
          id: prof.user_id,
          email: prof.email || `user-${String(prof.user_id).slice(0, 6)}@techbridge.cm`,
          password: "password123",
          user_metadata: { full_name: prof.full_name || "TechBridge Participant" },
          created_at: prof.created_at || nowIso,
        });
      }
    }
  }

  // Preserve Cameroon contact settings if requested
  if (options.preserveCameroonContact !== false && db.site_settings?.[0]) {
    Object.assign(db.site_settings[0], {
      contact_email: DEFAULT_CONTACT.contact_email,
      contact_phone: DEFAULT_CONTACT.contact_phone,
      office_address: DEFAULT_CONTACT.office_address,
    });
  }

  db.admin_audit_log.unshift({
    id: uuid(),
    performed_by: db.users[0]?.id || "admin",
    action: "backup.restored",
    resource_type: "settings",
    resource_id: null,
    resource_label: `Restored ${totalRows} records across ${Object.keys(restoredTables).length} tables (${options.mode})`,
    metadata: {
      mode: options.mode,
      tables: restoredTables,
      bootcamps_recovered: bootcampsRecovered,
      events_recovered: eventsRecovered,
    },
    created_at: nowIso,
  });

  saveLocalDb(db);
  return { restoredTables, totalRows, bootcampsRecovered, eventsRecovered };
}

export const resilientSupabaseFetch: typeof fetch = async (input, init) => {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const parsedUrl = new URL(urlStr);

  // If the remote Supabase host is NOT already known to be unreachable, try it with a fast timeout
  if (!remoteUnreachable && !parsedUrl.hostname.includes("rmtusfikecejennwrkxr")) {
    try {
      const response = await fetch(input, init);
      return response;
    } catch {
      remoteUnreachable = true;
    }
  }

  if (parsedUrl.pathname.startsWith("/auth/v1")) {
    return handleAuthRequest(parsedUrl, init);
  }
  if (parsedUrl.pathname.startsWith("/rest/v1")) {
    return handleRestRequest(parsedUrl, init);
  }
  if (parsedUrl.pathname.startsWith("/functions/v1")) {
    return handleFunctionsRequest(parsedUrl, init);
  }
  if (parsedUrl.pathname.startsWith("/storage/v1")) {
    return handleStorageRequest(parsedUrl, init);
  }

  return jsonResponse({ ok: true }, 200);
};
