import type { LabSettings, MilestoneTemplate, SiteContent } from "../types";

// Neutral starting values. Everything here is editable in Settings; nothing is institution-specific.
export const DEFAULT_SETTINGS: LabSettings = {
  labName: "Research Lab",
  institution: "",
  department: "",
  supervisorName: "",
  tagline: "",
  accent: "#0f766e",
  timezone: "Asia/Kolkata",
  programmes: [
    { id: "phd", name: "PhD", level: "phd" },
    { id: "master", name: "Master (M.Tech / M.Sc)", level: "master" },
    { id: "bachelor", name: "Bachelor (B.Tech / B.Sc)", level: "bachelor" },
  ],
  leaveTypes: [
    { id: "casual", name: "Casual leave", yearlyQuota: 8 },
    { id: "medical", name: "Medical leave", yearlyQuota: 0 },
    { id: "duty", name: "Duty / conference", yearlyQuota: 0 },
    { id: "vacation", name: "Vacation", yearlyQuota: 0 },
  ],
  holidays: [],
  weekendDays: [0],
  mentorCanApproveLeave: false,
  mentorCanCorrectPresence: true,
  geofence: { enabled: false, lat: 0, lng: 0, radiusM: 500 },
  idleMinutes: 30,
  statuses: ["Active", "On extension", "Thesis submitted", "Awarded", "Discontinued"],
};

export const DEFAULT_TEMPLATES: MilestoneTemplate[] = [
  {
    programmeId: "phd",
    items: [
      { key: "coursework", title: "Coursework completed", weight: 10, offsetMonths: 6 },
      { key: "committee", title: "Research committee formed", weight: 5, offsetMonths: 6 },
      { key: "proposal", title: "Research proposal approved", weight: 10, offsetMonths: 12 },
      { key: "review", title: "Six-monthly progress review", weight: 4, offsetMonths: 12, repeatEveryMonths: 6, repeatCount: 6 },
      { key: "comprehensive", title: "Comprehensive / pre-PhD examination", weight: 10, offsetMonths: 18 },
      { key: "presubmission", title: "Pre-submission seminar", weight: 10, offsetMonths: 42 },
      { key: "plagiarism", title: "Similarity check cleared", weight: 5, offsetMonths: 44 },
      { key: "thesis", title: "Thesis submitted", weight: 15, offsetMonths: 45 },
      { key: "viva", title: "Viva-voce", weight: 6, offsetMonths: 50 },
      { key: "award", title: "Degree awarded", weight: 5, offsetMonths: 52 },
    ],
  },
  {
    programmeId: "master",
    items: [
      { key: "topic", title: "Topic allotment", weight: 10, offsetMonths: 0 },
      { key: "litreview", title: "Literature review submitted", weight: 15, offsetMonths: 2 },
      { key: "midterm", title: "Mid-term review", weight: 20, offsetMonths: 5 },
      { key: "prototype", title: "Prototype / experiments complete", weight: 20, offsetMonths: 8 },
      { key: "draft", title: "Dissertation draft", weight: 15, offsetMonths: 9 },
      { key: "final", title: "Final submission", weight: 10, offsetMonths: 10 },
      { key: "viva", title: "Viva / result", weight: 10, offsetMonths: 11 },
    ],
  },
  {
    programmeId: "bachelor",
    items: [
      { key: "topic", title: "Topic allotment", weight: 15, offsetMonths: 0 },
      { key: "review1", title: "Review 1", weight: 20, offsetMonths: 1 },
      { key: "review2", title: "Review 2", weight: 25, offsetMonths: 2 },
      { key: "demo", title: "Final demo", weight: 20, offsetMonths: 3 },
      { key: "report", title: "Report submitted", weight: 20, offsetMonths: 4 },
    ],
  },
];

export const DEFAULT_SITE: SiteContent = {
  about: "",
  themes: [],
  piTitle: "",
  piBio: "",
  links: { website: "", orcid: "", scholar: "", scopus: "", linkedin: "" },
  contactEmail: "",
  contactPhone: "",
  address: "",
  autoPublishNews: false,
  completionStatuses: ["Awarded"],
};
