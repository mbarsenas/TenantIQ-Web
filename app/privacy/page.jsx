export const metadata = { title: "Privacy Policy | TenantIQ" };
const page={minHeight:"100vh",background:"linear-gradient(180deg,#07111f 0%,#0d1321 100%)",color:"#e8eef7",fontFamily:"Inter,Arial,sans-serif"};
const wrap={maxWidth:860,margin:"0 auto",padding:"52px 24px 96px",lineHeight:1.72};
const muted={color:"#a7b4c5"};
export default function PrivacyPage(){return <main style={page}><article style={wrap}>
<a href="/" style={{color:"#78b8ff",textDecoration:"none",fontWeight:700}}>← TenantIQ</a>
<div style={{color:"#6eb5ff",fontSize:12,fontWeight:800,letterSpacing:".08em",textTransform:"uppercase",marginTop:34}}>Legal</div>
<h1 style={{fontSize:"clamp(36px,6vw,54px)",margin:"8px 0 8px"}}>Privacy Policy</h1><p style={muted}><strong>Last updated:</strong> August 14, 2026</p>
<p>TenantIQ processes information needed to provide the website, customer account, subscription, assessment workspace, Knowledge Assistant, and related support services.</p>
<h2>Information you provide</h2><p style={muted}>This may include your name, email address, organization information, account credentials, purchase and license information, support communications, and information you submit through TenantIQ forms.</p>
<h2>Assessment data</h2><p style={muted}>When you upload a TenantIQ assessment, the service stores the assessment and its findings so they can be displayed in your workspace, analyzed by the Knowledge Assistant, and used by Workflow. Assessment content can include Microsoft 365 configuration evidence produced by the TenantIQ assessment process.</p>
<h2>How information is used</h2><p style={muted}>We use information to authenticate users, verify subscriptions and licenses, provide requested product functionality, store assessment history and workflow state, deliver transactional email, support customers, maintain security, and improve TenantIQ.</p>
<h2>Service providers</h2><p style={muted}>TenantIQ uses third-party providers for services such as hosting, database infrastructure, payments, email delivery, and AI-assisted analysis. Information is shared with providers only as needed to operate those services. TenantIQ does not sell personal information.</p>
<h2>AI-assisted analysis</h2><p style={muted}>The Knowledge Assistant uses the assessment selected by the user together with TenantIQ knowledge content to generate read-only guidance. Customers should avoid uploading information that is not necessary for the assessment and should review generated guidance before acting on it.</p>
<h2>Retention and deletion</h2><p style={muted}>Information is retained as reasonably necessary to provide the service, maintain customer records, satisfy legal or security requirements, and support the licensed workspace. Deletion requests may be submitted through TenantIQ support.</p>
<h2>Security</h2><p style={muted}>TenantIQ applies technical and operational safeguards appropriate to the service. No online service can guarantee absolute security. Additional product security information is available on the <a href="/security" style={{color:"#78b8ff"}}>Security page</a>.</p>
<h2>Changes</h2><p style={muted}>This policy may be updated as TenantIQ evolves. Material revisions will be reflected by the updated date on this page.</p>
<div style={{marginTop:38,paddingTop:18,borderTop:"1px solid rgba(86,160,255,.18)",display:"flex",gap:18,flexWrap:"wrap"}}><a href="/terms" style={{color:"#78b8ff"}}>Terms</a><a href="/security" style={{color:"#78b8ff"}}>Security</a><a href="/pricing" style={{color:"#78b8ff"}}>Pricing</a></div>
</article></main>;}