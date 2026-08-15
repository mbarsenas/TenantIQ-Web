export const metadata = { title: "Security | TenantIQ" };
const page={minHeight:"100vh",background:"linear-gradient(180deg,#07111f 0%,#0d1321 100%)",color:"#e8eef7",fontFamily:"Inter,Arial,sans-serif"};
const wrap={maxWidth:860,margin:"0 auto",padding:"52px 24px 96px",lineHeight:1.72};
const muted={color:"#a7b4c5"};
export default function SecurityPage(){return <main style={page}><article style={wrap}>
<a href="/" style={{color:"#78b8ff",textDecoration:"none",fontWeight:700}}>← TenantIQ</a>
<div style={{color:"#6eb5ff",fontSize:12,fontWeight:800,letterSpacing:".08em",textTransform:"uppercase",marginTop:34}}>Trust</div>
<h1 style={{fontSize:"clamp(36px,6vw,54px)",margin:"8px 0 12px"}}>TenantIQ Security</h1>
<p>TenantIQ is designed around a simple operating principle: assess Microsoft 365 configuration without silently changing it.</p>
<h2>Read-only assessment</h2><p style={muted}>Supported TenantIQ assessment workflows use read-only permissions intended to collect the Microsoft 365 configuration and security information required by registered checks. The assessment engine does not perform automatic remediation.</p>
<h2>Evidence-grounded findings</h2><p style={muted}>TenantIQ associates findings with observed assessment evidence. The Knowledge Assistant is designed to use the selected assessment together with TenantIQ knowledge content so tenant-specific configuration is not invented when it was not observed.</p>
<h2>Licensed workspace controls</h2><p style={muted}>Customer workspace features, including stored assessments, Knowledge Assistant access, Knowledge, and Workflow, require authentication and an active TenantIQ entitlement.</p>
<h2>Account and data security</h2><p style={muted}>TenantIQ uses authenticated accounts, email verification for native accounts, subscription entitlement checks, server-side storage for workspace workflow state, and service-provider security controls for hosting, databases, payment processing, and transactional email.</p>
<h2>Customer responsibility</h2><p style={muted}>Customers should protect TenantIQ credentials and exported assessment files, grant only required Microsoft 365 permissions, validate findings before remediation, and follow their own change-management and security procedures.</p>
<h2>Security limitations</h2><p style={muted}>No software or hosted service can guarantee absolute security. TenantIQ does not represent that use of the product alone establishes compliance, eliminates risk, or replaces an organization’s security program.</p>
<h2>Reporting concerns</h2><p style={muted}>If you identify a suspected security issue involving TenantIQ, contact TenantIQ support with enough information to reproduce and investigate the issue. Do not include unnecessary tenant secrets, passwords, or access tokens.</p>
<div style={{marginTop:38,paddingTop:18,borderTop:"1px solid rgba(86,160,255,.18)",display:"flex",gap:18,flexWrap:"wrap"}}><a href="/privacy" style={{color:"#78b8ff"}}>Privacy</a><a href="/terms" style={{color:"#78b8ff"}}>Terms</a><a href="/pricing" style={{color:"#78b8ff"}}>Pricing</a></div>
</article></main>;}