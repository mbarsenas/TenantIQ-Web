import { redirect } from 'next/navigation';
import TenantIQAppNav from '../../../components/TenantIQAppNav';
import { requireTenantIQEntitlement } from '../../../lib/tenantiq-entitlement';

const controls = [
  ['ENTRA-GOV-001','Access Reviews','Identity Governance','Periodic access review governance and lifecycle validation.'],
  ['ENTRA-GOV-002','Administrative Units','Identity Governance','Delegated administrative scope and governance boundaries.'],
  ['ENTRA-APP-001','Admin Consent Request Policy','Applications','Application consent request governance and approval controls.'],
  ['ENTRA-APP-002','Admin Consent Workflow','Applications','Administrative consent workflow configuration and oversight.'],
  ['ENTRA-APP-003','App Registrations','Applications','Application registration inventory, governance, and exposure.'],
  ['ENTRA-APP-004','Application Credentials','Applications','Application secrets and certificate credential lifecycle.'],
  ['ENTRA-APP-006','Application Proxy','Applications','Published application exposure and proxy configuration.'],
  ['ENTRA-CA-001','Authentication Context','Conditional Access','Authentication context configuration used by Conditional Access.'],
] as const;

const groups = [
  ['Authentication & MFA','Authentication methods, MFA registration, passwordless readiness, and authentication policy posture.'],
  ['Conditional Access','Policy coverage, authentication context, exclusions, and access enforcement posture.'],
  ['Identity Governance','Access reviews, privileged access, administrative scope, and lifecycle governance.'],
  ['Applications','App registrations, consent, ownership, credentials, and application exposure.'],
] as const;

export default async function EntraKnowledgePage() {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  return <main style={{minHeight:'100vh',background:'linear-gradient(180deg,#07111f 0%,#0d1321 100%)',color:'#f3f6fb'}}>
    <TenantIQAppNav active="knowledge" />
    <div style={{width:'min(1100px,100%)',margin:'0 auto',padding:'38px 20px 72px'}}>
      <a href="/knowledge" style={{color:'#78b8ff',textDecoration:'none',fontWeight:800,fontSize:13}}>← Knowledge base</a>
      <header style={{margin:'24px 0 28px'}}>
        <div style={{color:'#6eb5ff',fontSize:12,fontWeight:900,letterSpacing:'.08em',textTransform:'uppercase'}}>Entra ID knowledge</div>
        <h1 style={{fontSize:'clamp(38px,6vw,58px)',lineHeight:1.03,margin:'10px 0 14px'}}>Identity and access guidance.</h1>
        <p style={{margin:0,color:'#aeb8c8',fontSize:16,lineHeight:1.65,maxWidth:820}}>TenantIQ uses Entra ID guidance to interpret identity, authentication, Conditional Access, application, and governance findings while keeping recommendations grounded in assessment evidence.</p>
      </header>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14,marginBottom:28}}>
        {groups.map(([name,description])=><article key={name} style={{border:'1px solid rgba(86,160,255,.2)',borderRadius:16,background:'rgba(8,22,40,.68)',padding:20}}><div style={{color:'#6eb5ff',fontSize:11,fontWeight:900,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:8}}>Guidance area</div><h2 style={{fontSize:19,margin:'0 0 9px'}}>{name}</h2><p style={{margin:0,color:'#9fb0c2',fontSize:13,lineHeight:1.6}}>{description}</p></article>)}
      </section>

      <section style={{border:'1px solid rgba(86,160,255,.2)',borderRadius:16,background:'rgba(8,22,40,.68)',padding:22}}>
        <div style={{color:'#6eb5ff',fontSize:11,fontWeight:900,letterSpacing:'.06em',textTransform:'uppercase'}}>Assessment controls</div>
        <h2 style={{margin:'8px 0 8px',fontSize:27}}>Entra ID guidance library</h2>
        <p style={{margin:'0 0 20px',color:'#9fb0c2',lineHeight:1.6,fontSize:14,maxWidth:800}}>Start with the control areas currently represented in the TenantIQ knowledge repository. Each control can be sent directly to the Knowledge Assistant for assessment-specific interpretation.</p>
        <div style={{display:'grid',gap:0}}>{controls.map(([id,title,category,description])=><div key={id} style={{display:'grid',gridTemplateColumns:'minmax(120px,.8fr) minmax(180px,1.3fr) minmax(140px,1fr) minmax(220px,1.8fr) auto',gap:14,alignItems:'center',borderTop:'1px solid rgba(86,160,255,.13)',padding:'14px 4px'}}><div style={{color:'#79baff',fontSize:12,fontWeight:900}}>{id}</div><div style={{fontSize:14,fontWeight:800}}>{title}</div><div style={{color:'#8fa4ba',fontSize:12}}>{category}</div><div style={{color:'#9fb0c2',fontSize:12,lineHeight:1.45}}>{description}</div><a href={`/assistant?finding=${encodeURIComponent(id)}`} style={{color:'#78b8ff',fontSize:12,fontWeight:850,textDecoration:'none',whiteSpace:'nowrap'}}>Ask Assistant →</a></div>)}</div>
      </section>

      <section style={{marginTop:20,border:'1px solid rgba(255,196,64,.22)',borderRadius:16,background:'rgba(255,196,64,.04)',padding:22}}><div style={{color:'#ffd35a',fontSize:11,fontWeight:900,letterSpacing:'.06em',textTransform:'uppercase'}}>Evidence guardrail</div><h2 style={{margin:'8px 0 8px',fontSize:23}}>Identity guidance must stay tenant-specific.</h2><p style={{margin:0,color:'#b4c1cf',lineHeight:1.65,fontSize:14}}>TenantIQ should use the selected assessment evidence for counts, users, policies, applications, configuration state, and severity. Knowledge guidance explains the control and remediation intent; it must not invent Entra ID configuration that the assessment did not observe.</p></section>
    </div>
  </main>;
}
