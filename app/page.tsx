'use client';

import TenantIQPageShell from "../components/TenantIQPageShell";

export default function Page() {
  return (
    <>
      <style jsx global>{`
        #top { min-height: 0 !important; padding-bottom: 0 !important; }
        #top .hero-grid { max-width: 1280px !important; gap: 58px !important; }
        .home-enhancements { height: 340px !important; }
        .home-enhancements-inner { width: min(1280px, calc(100% - 80px)) !important; }
        .trust-stat-row { width: 650px !important; top: 6px !important; }
        .home-network { inset: 55px 0 92px !important; opacity: .9 !important; }
        .network-lines { stroke: rgba(42, 126, 255, .46) !important; stroke-width: 1.15 !important; }
        .network-nodes { fill: #35a8ff !important; filter: drop-shadow(0 0 10px rgba(53,168,255,.95)) !important; }
        .network-badge { font-size: 0 !important; width: 50px !important; height: 50px !important; border-color: rgba(50,140,255,.72) !important; background: rgba(4,18,38,.86) !important; }
        .network-badge::after { content: ""; width: 18px; height: 18px; display: block; border: 2px solid #4c9cff; border-radius: 5px; opacity: .9; }
        .network-badge.badge-shield::after { border-radius: 50% 50% 44% 44%; transform: rotate(45deg); }
        .network-badge.badge-lock::after { border-radius: 4px; }
        .workload-strip-wrap { bottom: 10px !important; padding-top: 18px !important; }
        .workload-strip-title { top: -30px !important; font-size: 12px !important; font-weight: 700 !important; letter-spacing: .035em !important; text-transform: none !important; }
        .workload-strip { display: grid !important; grid-template-columns: repeat(8, minmax(92px, 1fr)) !important; gap: 18px !important; align-items: start !important; margin-top: -8px !important; }
        .workload-item { display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: flex-start !important; gap: 10px !important; min-width: 0 !important; white-space: nowrap !important; }
        .workload-logo { width: 46px !important; height: 46px !important; display: flex !important; align-items: center !important; justify-content: center !important; transform: none !important; }
        .workload-logo svg { width: 46px !important; height: 46px !important; display: block !important; transform: none !important; }
        .workload-name { font-size: 12px !important; line-height: 1.15 !important; color: #f3f6fb !important; overflow: visible !important; max-width: none !important; }
        @media (max-width:1100px){.home-enhancements{height:430px!important}.workload-strip{grid-template-columns:repeat(4,minmax(110px,1fr))!important;row-gap:20px!important}}
        @media (max-width:620px){.home-enhancements{height:610px!important}.home-enhancements-inner{width:calc(100% - 30px)!important}.trust-stat-row{width:100%!important}.workload-strip{grid-template-columns:repeat(2,minmax(110px,1fr))!important}}
      `}</style>
      <TenantIQPageShell mode="home" />
    </>
  );
}
