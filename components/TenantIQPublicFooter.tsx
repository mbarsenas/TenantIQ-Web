export default function TenantIQPublicFooter() {
  const year = new Date().getFullYear();

  return (
    <div
      role="contentinfo"
      aria-label="TenantIQ site footer"
      style={{
        borderTop: '1px solid rgba(76,141,255,.18)',
        background: '#07111f',
        color: '#8fa2b8',
      }}
    >
      <div
        style={{
          width: 'min(1200px, calc(100% - 40px))',
          margin: '0 auto',
          padding: '22px 0 26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          <strong style={{ color: '#f3f6fb', letterSpacing: '.08em' }}>TENANTIQ</strong>
          <span style={{ marginLeft: 10 }}>© {year} TenantIQ. Microsoft 365 tenant intelligence.</span>
        </div>

        <nav
          aria-label="TenantIQ legal and account links"
          style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
        >
          <a href="/privacy" style={linkStyle}>Privacy</a>
          <a href="/terms" style={linkStyle}>Terms</a>
          <a href="/security" style={linkStyle}>Security</a>
          <a href="/signin" style={{ ...linkStyle, color: '#bad8f8', fontWeight: 800 }}>Sign in</a>
        </nav>
      </div>
    </div>
  );
}

const linkStyle = {
  color: '#8fa2b8',
  fontSize: 12,
  textDecoration: 'none',
} as const;
