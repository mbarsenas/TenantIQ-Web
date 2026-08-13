export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return ["", "/pricing", "/privacy", "/terms", "/security"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/pricing" ? "weekly" : path ? "monthly" : "weekly",
    priority: path === "/pricing" ? 0.9 : path ? 0.5 : 1,
  }));
}
