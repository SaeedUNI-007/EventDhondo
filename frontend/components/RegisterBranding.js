import { CalendarDays, Compass, Sparkles, Trophy, Users } from 'lucide-react';

function FeatureChip({ icon: Icon, title, copy, tint, shift = '' }) {
  return (
    <div className={`glass group flex items-center gap-3 rounded-2xl p-3 transition-transform duration-200 hover:-translate-y-0.5 ${shift}`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-lg ${tint}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</p>
        <p className="text-sm font-semibold text-[var(--brand-strong)]">{copy}</p>
      </div>
    </div>
  );
}

export default function RegisterBranding() {
  return (
    <section className="hidden lg:flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[linear-gradient(165deg,#ffffff_0%,#eef6f6_58%,#fde7bf_140%)] p-8 shadow-[0_16px_34px_rgba(9,32,32,0.09)] reveal-up">
      <div>
        <p className="inline-block rounded-full bg-white/80 px-3 py-1 text-xs font-bold tracking-wide text-[var(--brand-strong)] border border-[var(--stroke)]">
          NEW HERE
        </p>
        <h2 className="mt-4 text-4xl font-extrabold leading-tight text-slate-900">
          Build Your Campus
          <span className="block text-[var(--brand)]">Event Identity</span>
        </h2>
        <p className="mt-4 max-w-md text-slate-600">
          Discover communities, join competitions, and turn participation into a visible portfolio that grows with every semester.
        </p>
      </div>

      <div className="relative mt-7 h-[360px] rounded-2xl border border-white/70 bg-white/55 p-5 backdrop-blur-md overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,143,138,0.14),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(244,180,64,0.16),transparent_34%)]" />

        <svg viewBox="0 0 420 320" xmlns="http://www.w3.org/2000/svg" className="relative z-10 h-full w-full">
          <defs>
            <filter id="boardShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#092020" floodOpacity="0.1" />
            </filter>
            <linearGradient id="boardGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f8fafc" />
            </linearGradient>
          </defs>

          {/* 1. CENTERED ENHANCED EVENT BOARD */}
          <g filter="url(#boardShadow)">
            <rect x="90" y="75" width="240" height="170" rx="24" fill="url(#boardGrad)" stroke="#e2e8f0" strokeWidth="1" />
            <rect x="90" y="75" width="240" height="30" rx="15" fill="#f1f5f9" />
            <circle cx="110" cy="90" r="4" fill="#ff5f56" />
            <circle cx="122" cy="90" r="4" fill="#ffbd2e" />
            <circle cx="134" cy="90" r="4" fill="#27c93f" />
            <rect x="160" y="85" width="100" height="10" rx="5" fill="#cbd5e1" opacity="0.5" />
            <rect x="105" y="120" width="210" height="110" rx="16" fill="white" stroke="#f1f5f9" strokeWidth="2" />
            <rect x="120" y="140" width="120" height="12" rx="6" fill="#0e8f8a" fillOpacity="0.25" />
            <rect x="120" y="160" width="80" height="8" rx="4" fill="#94a3b8" fillOpacity="0.3" />
            <circle cx="130" cy="195" r="10" fill="#f6d8bf" stroke="white" strokeWidth="2" />
            <circle cx="145" cy="195" r="10" fill="#cbd5e1" stroke="white" strokeWidth="2" />
            <rect x="235" y="185" width="65" height="26" rx="13" fill="#0e8f8a" />
            <rect x="248" y="194" width="38" height="8" rx="4" fill="white" fillOpacity="0.9" />
            <rect x="250" y="135" width="50" height="18" rx="9" fill="#fef3c7" />
          </g>

          {/* 2. PATH: LAPTOP -> BOARD TOP */}
          <path 
            d="M 50 45 C 80 10, 160 20, 210 75" 
            stroke="#0e8f8a" 
            strokeOpacity="0.3" 
            strokeWidth="3" 
            strokeDasharray="6 6" 
            fill="none" 
            className="animate-pulse"
          />

          {/* 3. PATH: BOARD BOTTOM -> CUP */}
          <path 
            d="M 210 245 C 260 280, 310 290, 345 255" 
            stroke="#f4b440" 
            strokeOpacity="0.4" 
            strokeWidth="3" 
            strokeDasharray="6 6" 
            fill="none" 
            className="animate-pulse"
          />

          {/* STUDENT 1: HIGHER POSITION */}
          <g transform="translate(30 10)">
            <animateTransform attributeName="transform" type="translate" values="30 10; 30 5; 30 10" dur="4s" repeatCount="indefinite" />
            <circle cx="0" cy="18" r="14" fill="#f6d8bf" />
            <rect x="-14" y="32" width="28" height="26" rx="8" fill="#0e8f8a" />
            <rect x="15" y="8" width="55" height="34" rx="7" fill="#1f2937" />
            <rect x="19" y="12" width="47" height="22" rx="4" fill="#67e8f9" fillOpacity="0.3" />
            <path d="M12 42h60l-7 10H19z" fill="#334155" />
          </g>

          {/* STUDENT 2: MOVED LEFT */}
          <g transform="translate(345 230)">
            <animateTransform attributeName="transform" type="translate" values="345 230; 345 220; 345 230" dur="3.5s" repeatCount="indefinite" />
            <circle cx="0" cy="18" r="14" fill="#f6d8bf" />
            <rect x="-14" y="32" width="28" height="26" rx="8" fill="#f4b440" />
            <path d="M26 8h16v12c0 6-5.5 11-11 11s-11-5-11-11V8h6" fill="#f4b440" stroke="#d49a2d" strokeWidth="1" />
            <rect x="29" y="31" width="4" height="7" fill="#f4b440" />
            <rect x="25" y="38" width="12" height="3" rx="1" fill="#f4b440" />
            <path d="M18 13h-4M42 13h4" stroke="#d49a2d" strokeWidth="1.2" strokeLinecap="round" />
          </g>

          {/* Interaction Nodes
          <circle cx="50" cy="45" r="5" fill="#0e8f8a" />
          <circle cx="345" cy="255" r="5" fill="#f4b440" /> */}
        </svg>
      </div>

      <div className="mt-6 space-y-3">
        <FeatureChip
          icon={Compass}
          title="Discovery"
          copy="Find events worth joining"
          tint="bg-[var(--brand)]"
        />
        <FeatureChip
          icon={Users}
          title="Collaboration"
          copy="Build strong competition teams"
          tint="bg-[var(--accent)]"
          shift="translate-x-5"
        />
        <FeatureChip
          icon={Trophy}
          title="Recognition"
          copy="Show verified achievements"
          tint="bg-[var(--brand-strong)]"
        />
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 font-medium">
          <CalendarDays className="h-4 w-4 text-[var(--brand)]" />
          <span>Workshops, hackathons, sports, societies</span>
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
        </div>
      </div>
    </section>
  );
}