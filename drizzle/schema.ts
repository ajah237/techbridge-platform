/**
 * TechBridge Canonical Database Schema (Drizzle ORM)
 *
 * Organized into 8 domain modules:
 *   1. PostgreSQL Enums
 *   2. Identity, Profiles & Access Control
 *   3. Events, Programs, Categories & Team Registrations
 *   4. Projects, Judging, Rubrics & Sponsorships
 *   5. Certificates, Templates, Reissues & Share Tokens
 *   6. Blog, Comments & Newsletter
 *   7. Community Forum & Content Moderation
 *   8. Mentorship, Direct Messaging, Gamification & Audit Logs
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ============================================================================
// 1. POSTGRESQL ENUMS
// ============================================================================

export const appRoleEnum = pgEnum("app_role", ["admin", "moderator", "user"]);

export const eventTypeEnum = pgEnum("event_type", [
  "hackathon",
  "bootcamp",
  "workshop",
  "webinar",
  "conference",
  "meetup",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "ongoing",
  "completed",
  "cancelled",
]);

export const blogStatusEnum = pgEnum("blog_status", [
  "draft",
  "published",
  "archived",
  "scheduled",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "pending",
  "approved",
  "rejected",
]);

export const commentStatusEnum = pgEnum("comment_status", [
  "pending",
  "approved",
  "spam",
  "rejected",
]);

export const reportContentTypeEnum = pgEnum("report_content_type", [
  "forum_thread",
  "forum_reply",
  "blog_comment",
  "project",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "resolved",
  "dismissed",
]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "draft",
  "submitted",
  "payment_pending",
  "payment_verification",
  "approved",
  "rejected",
  "withdrawn",
]);

export const paymentVerificationStatusEnum = pgEnum(
  "payment_verification_status",
  ["unpaid", "pending", "verified", "rejected"],
);

export const participantRoleEnum = pgEnum("participant_role", [
  "leader",
  "member",
  "teacher_mentor",
  "coach",
]);

// ============================================================================
// 2. IDENTITY, PROFILES & ACCESS CONTROL
// ============================================================================

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    fullName: text("full_name"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    skills: text("skills").array(),
    university: text("university"),
    githubUrl: text("github_url"),
    linkedinUrl: text("linkedin_url"),
    portfolioUrl: text("portfolio_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("profiles_user_id_idx").on(t.userId)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    role: appRoleEnum("role").default("user").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("user_roles_user_role_uidx").on(t.userId, t.role)],
);

// ============================================================================
// 3. EVENTS, PROGRAMS, CATEGORIES & TEAM REGISTRATIONS
// ============================================================================

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    shortDescription: text("short_description"),
    eventType: eventTypeEnum("event_type").default("hackathon").notNull(),
    status: eventStatusEnum("status").default("draft").notNull(),
    eventMode: text("event_mode").default("onsite").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
    submissionOpensAt: timestamp("submission_opens_at", { withTimezone: true }),
    submissionDeadline: timestamp("submission_deadline", { withTimezone: true }),
    judgingStartsAt: timestamp("judging_starts_at", { withTimezone: true }),
    judgingEndsAt: timestamp("judging_ends_at", { withTimezone: true }),
    resultsAt: timestamp("results_at", { withTimezone: true }),
    location: text("location"),
    isVirtual: boolean("is_virtual").default(false),
    virtualLink: text("virtual_link"),
    onlineUrl: text("online_url"),
    maxParticipants: integer("max_participants"),
    registrationOpen: boolean("registration_open").default(true).notNull(),
    registrationFee: numeric("registration_fee").default("0").notNull(),
    paymentInstructions: jsonb("payment_instructions").default([]).notNull(),
    bannerUrl: text("banner_url"),
    ogImageUrl: text("og_image_url"),
    prizes: jsonb("prizes").default([]),
    schedule: jsonb("schedule").default([]),
    faqs: jsonb("faqs").default([]),
    sponsors: jsonb("sponsors").default([]),
    judges: jsonb("judges").default([]),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_events_status_start").on(t.status, t.startDate)],
);

export const eventPrograms = pgTable(
  "event_programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    capacity: integer("capacity"),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_event_programs_event").on(t.eventId, t.displayOrder)],
);

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    programId: uuid("program_id").references(() => eventPrograms.id, {
      onDelete: "set null",
    }),
    participantId: uuid("participant_id").defaultRandom().notNull().unique(),
    status: text("status").default("registered").notNull(),
    teamName: text("team_name"),
    notes: text("notes"),
    attended: boolean("attended").default(false).notNull(),
    attendedAt: timestamp("attended_at", { withTimezone: true }),
    paid: boolean("paid").default(false).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("event_registrations_event_user_uidx").on(t.eventId, t.userId),
    index("idx_event_registrations_user").on(t.userId),
  ],
);

export const eventCategories = pgTable(
  "event_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    levelLabel: text("level_label"),
    eligibilityNotes: text("eligibility_notes"),
    minTeamSize: integer("min_team_size").default(1).notNull(),
    maxTeamSize: integer("max_team_size").default(4).notNull(),
    requiresTeacher: boolean("requires_teacher").default(false).notNull(),
    capacityTeams: integer("capacity_teams"),
    currency: text("currency").default("FCFA").notNull(),
    registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }),
    registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),
    submissionDeadline: timestamp("submission_deadline", { withTimezone: true }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("event_categories_event_slug_uidx").on(t.eventId, t.slug)],
);

export const categoryFeeTiers = pgTable(
  "category_fee_tiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => eventCategories.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).default("0").notNull(),
    currency: text("currency").default("FCFA").notNull(),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_category_fee_tiers_cat_sort").on(t.categoryId, t.sortOrder)],
);

export const teamRegistrations = pgTable(
  "team_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull().unique(),
    teamCode: text("team_code").unique(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => eventCategories.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").notNull(),
    teamName: text("team_name").notNull(),
    projectTitle: text("project_title"),
    projectTrack: text("project_track"),
    projectSummary: text("project_summary"),
    institutionName: text("institution_name").notNull(),
    institutionType: text("institution_type"),
    region: text("region"),
    city: text("city"),
    country: text("country").default("Cameroon"),
    teacherName: text("teacher_name"),
    teacherEmail: text("teacher_email"),
    teacherPhone: text("teacher_phone"),
    teacherRole: text("teacher_role"),
    feeTierId: uuid("fee_tier_id").references(() => categoryFeeTiers.id, {
      onDelete: "set null",
    }),
    feeTierLabel: text("fee_tier_label"),
    feeAmount: numeric("fee_amount", { precision: 12, scale: 2 }).default("0").notNull(),
    currency: text("currency").default("FCFA").notNull(),
    status: registrationStatusEnum("status").default("draft").notNull(),
    reviewNotes: text("review_notes"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    declarationsAccepted: boolean("declarations_accepted").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_team_registrations_event_status").on(t.eventId, t.status),
    index("idx_team_registrations_category").on(t.categoryId),
    index("idx_team_registrations_created_by").on(t.createdBy),
  ],
);

export const registrationParticipants = pgTable(
  "registration_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => teamRegistrations.id, { onDelete: "cascade" }),
    role: participantRoleEnum("role").default("member").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    gender: text("gender"),
    dateOfBirth: text("date_of_birth"),
    schoolOrUniversity: text("school_or_university"),
    classOrLevel: text("class_or_level"),
    fieldOfStudy: text("field_of_study"),
    studentIdNumber: text("student_id_number"),
    technicalRole: text("technical_role"),
    tshirtSize: text("tshirt_size"),
    dietaryNotes: text("dietary_notes"),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    consentConfirmed: boolean("consent_confirmed").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_registration_participants_reg").on(t.registrationId)],
);

export const registrationPayments = pgTable(
  "registration_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => teamRegistrations.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).default("0").notNull(),
    currency: text("currency").default("FCFA").notNull(),
    paymentMethod: text("payment_method").notNull(),
    payerName: text("payer_name"),
    payerPhone: text("payer_phone"),
    transactionReference: text("transaction_reference"),
    paymentDate: timestamp("payment_date", { withTimezone: true }),
    proofUrl: text("proof_url"),
    notes: text("notes"),
    status: paymentVerificationStatusEnum("status").default("pending").notNull(),
    verifiedBy: uuid("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_registration_payments_reg_status").on(t.registrationId, t.status)],
);

export const registrationEvents = pgTable(
  "registration_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => teamRegistrations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id"),
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    message: text("message"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_registration_events_reg_created").on(t.registrationId, t.createdAt)],
);

export const eventAnnouncements = pgTable(
  "event_announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    targetAudience: text("target_audience").default("all").notNull(),
    targetCategoryId: uuid("target_category_id").references(() => eventCategories.id, {
      onDelete: "set null",
    }),
    targetStatus: registrationStatusEnum("target_status"),
    recipientCount: integer("recipient_count").default(0).notNull(),
    sentBy: uuid("sent_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_event_announcements_event_created").on(t.eventId, t.createdAt)],
);

export const eventPeople = pgTable(
  "event_people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: text("kind").default("judge").notNull(),
    fullName: text("full_name").notNull(),
    roleTitle: text("role_title"),
    organization: text("organization"),
    email: text("email"),
    phone: text("phone"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    linkedinUrl: text("linkedin_url"),
    websiteUrl: text("website_url"),
    sponsorTier: text("sponsor_tier"),
    assignedTrack: text("assigned_track"),
    notes: text("notes"),
    isPublic: boolean("is_public").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_event_people_event_kind_sort").on(t.eventId, t.kind, t.sortOrder)],
);

export const eventTeams = pgTable(
  "event_teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    lookingFor: text("looking_for").array().default([]).notNull(),
    maxMembers: integer("max_members").default(4).notNull(),
    captainId: uuid("captain_id").notNull(),
    isOpen: boolean("is_open").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_event_teams_event").on(t.eventId)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => eventTeams.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").default("member").notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("team_members_team_user_uidx").on(t.teamId, t.userId),
    index("idx_team_members_user").on(t.userId),
  ],
);

export const eventFeedback = pgTable(
  "event_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    rating: integer("rating").notNull(),
    wouldRecommend: boolean("would_recommend").default(true).notNull(),
    content: text("content"),
    highlights: text("highlights"),
    improvements: text("improvements"),
    anonymous: boolean("anonymous").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("event_feedback_event_user_uidx").on(t.eventId, t.userId),
    index("idx_event_feedback_user").on(t.userId),
  ],
);

// ============================================================================
// 4. PROJECTS, JUDGING, RUBRICS & SPONSORSHIPS
// ============================================================================

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => eventTeams.id, { onDelete: "set null" }),
    registrationId: uuid("registration_id").references(() => teamRegistrations.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    techStack: text("tech_stack").array().default([]).notNull(),
    demoUrl: text("demo_url"),
    repoUrl: text("repo_url"),
    coverImageUrl: text("cover_image_url"),
    status: projectStatusEnum("status").default("pending").notNull(),
    featured: boolean("featured").default(false).notNull(),
    adminNotes: text("admin_notes"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_projects_status_created").on(t.status, t.createdAt),
    index("idx_projects_event_id").on(t.eventId),
    index("projects_registration_idx").on(t.registrationId),
  ],
);

export const projectDocuments = pgTable(
  "project_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by").notNull(),
    filePath: text("file_path").notNull().unique(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_project_documents_project").on(t.projectId)],
);

export const projectVotes = pgTable(
  "project_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("project_votes_project_user_uidx").on(t.projectId, t.userId),
    index("idx_project_votes_user").on(t.userId),
  ],
);

export const projectComments = pgTable(
  "project_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    parentId: uuid("parent_id"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_project_comments_project").on(t.projectId, t.createdAt)],
);

export const projectReactions = pgTable(
  "project_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("project_reactions_project_user_emoji_uidx").on(
      t.projectId,
      t.userId,
      t.emoji,
    ),
  ],
);

export const judgingCriteria = pgTable(
  "judging_criteria",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    weight: numeric("weight").default("1").notNull(),
    maxScore: integer("max_score").default(10).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_judging_criteria_event").on(t.eventId)],
);

export const projectScoreItems = pgTable(
  "project_score_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => judgingCriteria.id, { onDelete: "cascade" }),
    judgeId: uuid("judge_id").notNull(),
    score: numeric("score").notNull(),
    feedback: text("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("project_score_items_proj_crit_judge_uidx").on(
      t.projectId,
      t.criterionId,
      t.judgeId,
    ),
    index("idx_project_score_items_criterion").on(t.criterionId),
  ],
);

export const judgeInvitations = pgTable(
  "judge_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    status: text("status").default("pending").notNull(),
    createdBy: uuid("created_by").notNull(),
    acceptedBy: uuid("accepted_by"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_judge_invitations_email").on(t.email)],
);

export const sponsorships = pgTable(
  "sponsorships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sponsorName: text("sponsor_name").notNull(),
    tier: text("tier").default("partner").notNull(),
    amount: numeric("amount").default("0").notNull(),
    currency: text("currency").default("XAF").notNull(),
    status: text("status").default("prospect").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    sponsorUserId: uuid("sponsor_user_id"),
    logoUrl: text("logo_url"),
    websiteUrl: text("website_url"),
    canReview: boolean("can_review").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_sponsorships_event_sponsor_status").on(
      t.eventId,
      t.sponsorUserId,
      t.status,
    ),
  ],
);

export const sponsorReviews = pgTable(
  "sponsor_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sponsorshipId: uuid("sponsorship_id")
      .notNull()
      .references(() => sponsorships.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").notNull(),
    decision: text("decision").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sponsor_reviews_project_sponsorship_uidx").on(
      t.projectId,
      t.sponsorshipId,
    ),
    index("idx_sponsor_reviews_sponsorship").on(t.sponsorshipId),
  ],
);

// ============================================================================
// 5. CERTIFICATES, TEMPLATES, REISSUES & SHARE TOKENS
// ============================================================================

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    certificateNumber: text("certificate_number").notNull().unique(),
    userId: uuid("user_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull(),
    programType: text("program_type"),
    description: text("description"),
    signatories: jsonb("signatories").default([]).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by"),
    revokeReason: text("revoke_reason"),
  },
  (t) => [
    index("idx_certificates_user_id").on(t.userId),
    index("idx_certificates_event_id").on(t.eventId),
  ],
);

export const certificateTemplates = pgTable("certificate_templates", {
  id: text("id").default("default").primaryKey(),
  organizationName: text("organization_name").default("TechBridge").notNull(),
  subtitle: text("subtitle").default("Certificate of Achievement").notNull(),
  footerText: text("footer_text")
    .default("Verify authenticity at techbridge.dev/verify")
    .notNull(),
  primaryColor: text("primary_color").default("#6366f1").notNull(),
  accentColor: text("accent_color").default("#a855f7").notNull(),
  logoUrl: text("logo_url"),
  stampUrl: text("stamp_url"),
  defaultSignatories: jsonb("default_signatories").default([]).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

export const certificateShareTokens = pgTable(
  "certificate_share_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    token: text("token").notNull().unique(),
    certificateId: uuid("certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    sentBy: uuid("sent_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true }),
    accessCount: integer("access_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_cert_share_cert").on(t.certificateId)],
);

export const certificateReissues = pgTable(
  "certificate_reissues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    oldCertificateId: uuid("old_certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    newCertificateId: uuid("new_certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    oldCertificateNumber: text("old_certificate_number").notNull(),
    newCertificateNumber: text("new_certificate_number").notNull(),
    oldRecipientName: text("old_recipient_name").notNull(),
    newRecipientName: text("new_recipient_name").notNull(),
    reason: text("reason").notNull(),
    reissuedBy: uuid("reissued_by"),
    reissuedAt: timestamp("reissued_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_cert_reissues_old").on(t.oldCertificateId),
    index("idx_cert_reissues_new").on(t.newCertificateId),
  ],
);

// ============================================================================
// 6. BLOG, COMMENTS & NEWSLETTER
// ============================================================================

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    excerpt: text("excerpt"),
    content: text("content"),
    coverImageUrl: text("cover_image_url"),
    status: blogStatusEnum("status").default("draft").notNull(),
    tags: text("tags").array(),
    authorId: uuid("author_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_blog_posts_status_pub").on(t.status, t.publishedAt)],
);

export const blogComments = pgTable(
  "blog_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    authorUserId: uuid("author_user_id"),
    authorName: text("author_name").notNull(),
    authorEmail: text("author_email"),
    content: text("content").notNull(),
    status: commentStatusEnum("status").default("pending").notNull(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_blog_comments_post_status").on(t.postId, t.status, t.createdAt),
    index("idx_blog_comments_author_user").on(t.authorUserId),
  ],
);

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").default("footer"),
  confirmed: boolean("confirmed").default(false).notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  unsubscribeToken: uuid("unsubscribe_token").defaultRandom().notNull().unique(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 7. COMMUNITY FORUM & CONTENT MODERATION
// ============================================================================

export const forumCategories = pgTable("forum_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").default("MessageSquare").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const forumThreads = pgTable(
  "forum_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => forumCategories.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: text("tags").array().default([]).notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    locked: boolean("locked").default(false).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    replyCount: integer("reply_count").default(0).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_forum_threads_cat_act").on(
      t.categoryId,
      t.pinned,
      t.lastActivityAt,
    ),
  ],
);

export const forumReplies = pgTable(
  "forum_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => forumThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    content: text("content").notNull(),
    isSolution: boolean("is_solution").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_forum_replies_thread").on(t.threadId, t.createdAt)],
);

export const forumVotes = pgTable(
  "forum_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => forumThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("forum_votes_thread_user_uidx").on(t.threadId, t.userId),
    index("idx_forum_votes_user").on(t.userId),
  ],
);

export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id"),
    contentType: reportContentTypeEnum("content_type").notNull(),
    contentId: uuid("content_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").default("pending").notNull(),
    resolvedBy: uuid("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_content_reports_status").on(t.status, t.createdAt)],
);

// ============================================================================
// 8. MENTORSHIP, DIRECT MESSAGING, GAMIFICATION & AUDIT LOGS
// ============================================================================

export const mentorProfiles = pgTable("mentor_profiles", {
  userId: uuid("user_id").primaryKey(),
  headline: text("headline").notNull(),
  company: text("company"),
  yearsExperience: integer("years_experience").default(1),
  expertise: text("expertise").array().default([]).notNull(),
  bio: text("bio"),
  calendlyUrl: text("calendly_url"),
  linkedinUrl: text("linkedin_url"),
  isActive: boolean("is_active").default(false).notNull(),
  maxMentees: integer("max_mentees").default(3).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mentorshipRequests = pgTable(
  "mentorship_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mentorId: uuid("mentor_id").notNull(),
    menteeId: uuid("mentee_id").notNull(),
    topic: text("topic").notNull(),
    message: text("message").notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_mentorship_requests_mentor_status").on(t.mentorId, t.status),
    index("idx_mentorship_requests_mentee_status").on(t.menteeId, t.status),
  ],
);

export const mentorAvailability = pgTable(
  "mentor_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mentorId: uuid("mentor_id").notNull(),
    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    slotMinutes: smallint("slot_minutes").default(30).notNull(),
    timezone: text("timezone").default("UTC").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_mentor_availability_mentor").on(t.mentorId)],
);

export const mentorBookings = pgTable(
  "mentor_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mentorId: uuid("mentor_id").notNull(),
    menteeId: uuid("mentee_id").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    topic: text("topic").notNull(),
    notes: text("notes"),
    meetingUrl: text("meeting_url"),
    status: text("status").default("pending").notNull(),
    cancelledBy: uuid("cancelled_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_mentor_bookings_mentor").on(t.mentorId, t.startAt),
    index("idx_mentor_bookings_mentee").on(t.menteeId, t.startAt),
  ],
);

export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => mentorBookings.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    fromStartAt: timestamp("from_start_at", { withTimezone: true }),
    toStartAt: timestamp("to_start_at", { withTimezone: true }),
    fromEndAt: timestamp("from_end_at", { withTimezone: true }),
    toEndAt: timestamp("to_end_at", { withTimezone: true }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_booking_events_booking").on(t.bookingId, t.createdAt)],
);

export const mentorReviews = pgTable(
  "mentor_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mentorId: uuid("mentor_id").notNull(),
    reviewerId: uuid("reviewer_id").notNull(),
    rating: integer("rating").notNull(),
    content: text("content"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("mentor_reviews_mentor_reviewer_uidx").on(
      t.mentorId,
      t.reviewerId,
    ),
    index("idx_mentor_reviews_mentor").on(t.mentorId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userA: uuid("user_a").notNull(),
    userB: uuid("user_b").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("conversations_user_a_user_b_uidx").on(t.userA, t.userB),
    index("idx_conversations_user_a_last_msg").on(t.userA, t.lastMessageAt),
    index("idx_conversations_user_b_last_msg").on(t.userB, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull(),
    content: text("content").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    attachmentPath: text("attachment_path"),
    attachmentName: text("attachment_name"),
    attachmentType: text("attachment_type"),
    attachmentSize: integer("attachment_size"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_messages_conv").on(t.conversationId, t.createdAt)],
);

export const messageEdits = pgTable(
  "message_edits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").notNull(),
    action: text("action").notNull(),
    previousContent: text("previous_content"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_message_edits_msg").on(t.messageId, t.createdAt)],
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("message_reactions_msg_user_emoji_uidx").on(
      t.messageId,
      t.userId,
      t.emoji,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").default("info").notNull(),
    link: text("link"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_notifications_user_read_created").on(
      t.userId,
      t.isRead,
      t.createdAt,
    ),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_push_subscriptions_user").on(t.userId)],
);

export const pointsLog = pgTable(
  "points_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    refId: uuid("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_points_log_user").on(t.userId)],
);

export const badges = pgTable("badges", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").default("Award").notNull(),
  pointsRequired: integer("points_required").default(0).notNull(),
  category: text("category").default("general").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("user_badges_user_badge_uidx").on(t.userId, t.badgeId),
    index("idx_user_badges_user").on(t.userId),
  ],
);

export const siteSettings = pgTable("site_settings", {
  id: text("id").default("global").primaryKey(),
  siteName: text("site_name").default("TechBridge").notNull(),
  tagline: text("tagline")
    .default("Empowering the next generation of tech leaders")
    .notNull(),
  contactEmail: text("contact_email").default("hello@techbridge.org"),
  contactPhone: text("contact_phone"),
  contactAddress: text("contact_address"),
  socialTwitter: text("social_twitter"),
  socialLinkedin: text("social_linkedin"),
  socialGithub: text("social_github"),
  socialInstagram: text("social_instagram"),
  socialYoutube: text("social_youtube"),
  announcementEnabled: boolean("announcement_enabled").default(false).notNull(),
  announcementText: text("announcement_text"),
  announcementLink: text("announcement_link"),
  autoIssueCertificates: boolean("auto_issue_certificates").default(true).notNull(),
  weeklyDigestEnabled: boolean("weekly_digest_enabled").default(false).notNull(),
  aboutHeroTagline: text("about_hero_tagline"),
  aboutStory: text("about_story"),
  aboutMission: text("about_mission"),
  aboutVision: text("about_vision"),
  aboutStatPeopleTrained: integer("about_stat_people_trained"),
  aboutStatEventsHeld: integer("about_stat_events_held"),
  aboutStatPartners: integer("about_stat_partners"),
  aboutStatCountries: integer("about_stat_countries"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
});

export const aboutTeamMembers = pgTable(
  "about_team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    roleTitle: text("role_title").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    linkedinUrl: text("linkedin_url"),
    twitterUrl: text("twitter_url"),
    email: text("email"),
    displayOrder: integer("display_order").default(0).notNull(),
    isPublished: boolean("is_published").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_about_team_order").on(t.displayOrder)],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status").default("new").notNull(),
    sourcePath: text("source_path"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_contact_messages_created_at").on(t.createdAt),
    index("idx_contact_messages_email_created").on(t.email, t.createdAt),
  ],
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    performedBy: uuid("performed_by"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    resourceLabel: text("resource_label"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_admin_audit_created").on(t.createdAt),
    index("idx_admin_audit_resource").on(t.resourceType, t.createdAt),
  ],
);

export const authAuditLog = pgTable(
  "auth_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: text("event_type").notNull(),
    affectedUserId: uuid("affected_user_id"),
    actorId: uuid("actor_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_auth_audit_created").on(t.createdAt),
    index("idx_auth_audit_event").on(t.eventType, t.createdAt),
    index("idx_auth_audit_affected").on(t.affectedUserId, t.createdAt),
  ],
);

export const newsletterAuditLog = pgTable(
  "newsletter_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    action: text("action").notNull(),
    performedBy: uuid("performed_by"),
    subscriberId: uuid("subscriber_id"),
    subscriberEmail: text("subscriber_email"),
    affectedCount: integer("affected_count").default(1).notNull(),
    details: jsonb("details").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_newsletter_audit_created_at").on(t.createdAt)],
);
