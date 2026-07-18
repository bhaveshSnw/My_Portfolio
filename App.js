import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const ringPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (dot.current) dot.current.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 4}px)`;
    };
    const enterEl = () => ring.current && ring.current.classList.add('hovered');
    const leaveEl = () => ring.current && ring.current.classList.remove('hovered');
    document.addEventListener('mousemove', move);
    const els = document.querySelectorAll('a,button,.proj-card,.skill-pill,.tl-card,.about-img-wrap');
    els.forEach(el => { el.addEventListener('mouseenter', enterEl); el.addEventListener('mouseleave', leaveEl); });
    let raf;
    const loop = () => {
      ringPos.current.x += (pos.current.x - ringPos.current.x) * 0.1;
      ringPos.current.y += (pos.current.y - ringPos.current.y) * 0.1;
      if (ring.current) ring.current.style.transform = `translate(${ringPos.current.x - 18}px,${ringPos.current.y - 18}px)`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { document.removeEventListener('mousemove', move); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <div className="c-dot" ref={dot}></div>
      <div className="c-ring" ref={ring}></div>
    </>
  );
}

function Particles() {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext('2d');
    let W = c.width = window.innerWidth;
    let H = c.height = window.innerHeight;
    const pts = Array.from({ length: 70 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.2 + 0.4, a: Math.random() * 0.4 + 0.1,
    }));
    const onResize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${p.a})`; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 110) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(124,58,237,${0.07 * (1 - d / 110)})`; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={canvas} className="particle-canvas" />;
}

function TiltCard({ children, className = '', style = {} }) {
  const ref = useRef(null);
  const onMove = useCallback((e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(8px)`;
  }, []);
  const onLeave = useCallback(() => { if (ref.current) ref.current.style.transform = ''; }, []);
  return <div ref={ref} className={className} style={{ transition: 'transform 0.4s ease', ...style }} onMouseMove={onMove} onMouseLeave={onLeave}>{children}</div>;
}

const NAV = ['Home', 'About', 'Skills', 'Experience', 'Projects', 'Contact'];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('Home');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fn = () => {
      setScrolled(window.scrollY > 50);
      [...NAV].reverse().forEach(n => {
        const el = document.getElementById(n.toLowerCase());
        if (el && window.scrollY >= el.offsetTop - 150) setActive(n);
      });
    };
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  const go = (id) => { document.getElementById(id.toLowerCase())?.scrollIntoView({ behavior: 'smooth' }); setOpen(false); };
  return (
    <nav className={`navbar ${scrolled ? 'glass' : ''}`}>
      <div className="nav-logo" onClick={() => go('home')}>
        <span className="logo-box">BS</span>
      </div>
      <ul className={`nav-links ${open ? 'open' : ''}`}>
        {NAV.map(n => (
          <li key={n}><button className={active === n ? 'active' : ''} onClick={() => go(n)}>{n}</button></li>
        ))}
      </ul>
      <a href="mailto:sonawanebhavesh360@gmail.com" className="btn-gold nav-hire">Hire Me</a>
      <button className={`hamburger ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <span /><span /><span />
      </button>
    </nav>
  );
}

function Hero() {
  const [typed, setTyped] = useState('');
  const roleIdx = useRef(0);
  const charIdx = useRef(0);
  const del = useRef(false);
  const roles = ['Backend Software Engineer', 'PHP & Laravel Expert', 'IoT Systems Builder', 'RESTful API Developer'];

  useEffect(() => {
    let timer;
    const tick = () => {
      const cur = roles[roleIdx.current];
      if (!del.current) {
        charIdx.current++;
        setTyped(cur.slice(0, charIdx.current));
        if (charIdx.current === cur.length) { del.current = true; timer = setTimeout(tick, 1800); return; }
      } else {
        charIdx.current--;
        setTyped(cur.slice(0, charIdx.current));
        if (charIdx.current === 0) { del.current = false; roleIdx.current = (roleIdx.current + 1) % roles.length; }
      }
      timer = setTimeout(tick, del.current ? 50 : 95);
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id="home" className="hero">
      <Particles />
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <div className="hero-inner">
        <div className="hero-left">
          <div className="hero-badge"><span className="badge-ping" /><span>Available · Nashik / Pune, Maharashtra</span></div>
          <h1 className="hero-h1">
            <span className="h1-sub">Hello, I'm</span>
            <span className="h1-name">Bhavesh</span>
            <span className="h1-name outline">Sonawane</span>
          </h1>
          <div className="hero-typed">
            <span className="typed-line" />
            <span className="typed-text">{typed}<span className="typed-cursor">|</span></span>
          </div>
          <p className="hero-p">
            Backend-focused engineer with <strong>3+ years</strong> designing scalable ISP and network management platforms.
            Proficient in PHP, Laravel, Node.js and Python — building things that work at scale.
          </p>
          <div className="hero-ctas">
            <button className="btn-gold" onClick={() => document.getElementById('projects').scrollIntoView({ behavior: 'smooth' })}>
              View Projects <span>→</span>
            </button>
            <a href="mailto:sonawanebhavesh360@gmail.com" className="btn-ghost">Let's Talk</a>
          </div>
          <div className="hero-stats">
            {[['3+', 'Years Exp'], ['4', 'Live Systems'], ['12+', 'Tech Stack'], ['100%', 'Committed']].map(([n, l]) => (
              <div className="hs" key={l}><span className="hs-n">{n}</span><span className="hs-l">{l}</span></div>
            ))}
          </div>
        </div>
        <div className="hero-right">
          <div className="photo-wrap">
            <div className="photo-ring r1" /><div className="photo-ring r2" /><div className="photo-ring r3" />
            <div className="photo-frame">
              <img src="./my_image.jpg" alt="Bhavesh Sonawane" />
              <div className="photo-shine" />
            </div>
            <div className="float-chip chip-a">⚡ Full Stack</div>
            <div className="float-chip chip-b">🏆 3+ Years</div>
            <div className="orbit-tag ot-php">PHP</div>
            <div className="orbit-tag ot-react">React</div>
            <div className="orbit-tag ot-node">Laravel</div>
            <div className="orbit-tag ot-sql">MySQL</div>
          </div>
        </div>
      </div>
      <div className="scroll-hint"><div className="scroll-mouse"><div className="scroll-wheel-dot" /></div><span>Scroll</span></div>
    </section>
  );
}

function About() {
  const [ref, inView] = useInView();
  return (
    <section id="about" className="section" ref={ref}>
      <div className={`about-grid ${inView ? 'reveal' : ''}`}>
        <div className="about-img-col">
          <TiltCard className="about-photo-wrap">
            <img src="./1000319782.png" alt="Bhavesh" />
            <div className="about-photo-glow" />
            <div className="about-photo-tag">💼 Software Developer</div>
          </TiltCard>
          <div className="about-float-card">
            <span>🏆</span>
            <div><strong>Active Developer</strong><small>Indio Networks 2023–Now</small></div>
          </div>
        </div>
        <div className="about-text-col">
          <span className="eyebrow">Who I Am</span>
          <h2 className="sec-title">Passionate about building <em className="gold">impactful</em> software</h2>
          <p className="body-p">I'm a backend-focused software engineer based in Nashik / Pune with 3+ years of experience shipping production-grade applications. My expertise spans PHP, Laravel, CodeIgniter 4, Node.js, Python, and database architecture, delivering complete end-to-end backend solutions.</p>
          <p className="body-p">At Indio Networks I've built IoT platforms managing 1,000+ devices, designed real-time dashboards, migrated 11 legacy captive portals, and implemented secure RADIUS auth and 2FA systems used by real customers daily. I care about clean code, performance, and AI-driven development.</p>
          <div className="about-chips">
            {['🔧 Problem Solver', '🤝 Team Player', '⚡ Fast Learner', '🎯 Detail Oriented'].map(t => (
              <span className="a-chip" key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const SKILL_GROUPS = [
  { label: 'Languages', icon: '🧠', color: '#a78bfa', skills: ['PHP', 'Python', 'JavaScript', 'Node.js', 'C', 'C++', 'Shell Script'] },
  { label: 'Frameworks', icon: '⚡', color: '#67e8f9', skills: ['Laravel', 'CodeIgniter 4', 'React.js (basic)', 'Bootstrap'] },
  { label: 'Databases', icon: '🗄️', color: '#059669', skills: ['MySQL', 'PostgreSQL', 'Query Optimization', 'Schema Design', 'Stored Procedures'] },
  { label: 'Tools', icon: '🛠️', color: '#0891b2', skills: ['RESTful API', 'Git / GitHub', 'Postman', 'Burp Suite', 'Jira', 'Phabricator'] },
  { label: 'AI & Data', icon: '🤖', color: '#d97706', skills: ['AIDD', 'Prompt Engineering', 'LLM Workflow', 'Databricks (learning)', 'Apache Kafka (learning)'] },
];

function Skills() {
  const [ref, inView] = useInView();
  const [tab, setTab] = useState(0);
  const bars = [['PHP / Laravel / CI4', 90], ['JavaScript / Node.js', 78], ['MySQL / PostgreSQL', 85], ['Python', 65], ['RESTful APIs', 88]];
  return (
    <section id="skills" className="section alt-bg" ref={ref}>
      <div className={`skills-wrap ${inView ? 'reveal' : ''}`}>
        <div className="sec-head center">
          <span className="eyebrow">What I Know</span>
          <h2 className="sec-title">Technical <em className="gold">Arsenal</em></h2>
          <p className="sec-sub">Tools and technologies I wield to build world-class software</p>
        </div>
        <div className="skill-tabs">
          {SKILL_GROUPS.map((g, i) => (
            <button key={g.label} className={`s-tab ${tab === i ? 'active' : ''}`}
              style={{ '--tc': g.color }} onClick={() => setTab(i)}>
              {g.icon} {g.label}
            </button>
          ))}
        </div>
        <div className="skill-pills">
          {SKILL_GROUPS[tab].skills.map((s, i) => (
            <div className="skill-pill" key={s} style={{ '--i': i, '--c': SKILL_GROUPS[tab].color }}>
              <span className="sp-dot" />{s}
            </div>
          ))}
        </div>
        <div className="skill-bars">
          {bars.map(([name, pct]) => (
            <div className="bar-row" key={name}>
              <span className="bar-label">{name}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: inView ? `${pct}%` : '0%', '--pct': `${pct}%` }} />
              </div>
              <span className="bar-num">{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Experience() {
  const [ref, inView] = useInView();
  return (
    <section id="experience" className="section" ref={ref}>
      <div className={`exp-wrap ${inView ? 'reveal' : ''}`}>
        <div className="sec-head">
          <span className="eyebrow">Career</span>
          <h2 className="sec-title">Work <em className="gold">Experience</em></h2>
        </div>
        <div className="tl">
          <div className="tl-spine" />
          <TiltCard className="tl-card">
            <div className="tl-node" />
            <div className="tl-card-body">
              <div className="tl-header">
                <div className="company-badge">IN</div>
                <div>
                  <h3>Software Developer</h3>
                  <span className="company-name">Indio Networks Pvt Ltd.</span>
                </div>
                <span className="current-tag">● Current</span>
              </div>
              <div className="tl-meta-row">
                <span>📅 Feb 2023 – Present</span>
                <span>📍 Pune, Maharashtra</span>
              </div>
              <p className="tl-desc">Building enterprise-grade IoT management, network access control, and rural internet platforms used by thousands of devices and users across India.</p>
              <div className="tl-ach-grid">
                {[['🔐','2FA & OTP-based secure authentication'],['📡','Real-time IoT monitoring & alert pipelines'],['🎨','11 legacy captive portal migrations'],['📦','Firmware & license management modules'],['📊','SD-WAN graphs & VPN gateway management'],['💰','Revenue reports & transaction modules']].map(([ic, tx]) => (
                  <div className="tl-ach" key={tx}><span>{ic}</span><span>{tx}</span></div>
                ))}
              </div>
              <div className="tl-tags">
                {['PHP', 'Laravel', 'MySQL', 'JavaScript', 'CodeIgniter 4', 'Shell Scripts'].map(t => (
                  <span className="tl-tag" key={t}>{t}</span>
                ))}
              </div>
            </div>
          </TiltCard>
        </div>
        {/* Education inline */}
        <div className="edu-card">
          <span className="edu-icon">🎓</span>
          <div>
            <h3>Bachelor of Computer Science (BCS)</h3>
            <p>MSG College of Arts, Commerce and Science, Malegaon (Nashik)</p>
            <p className="edu-uni">Savitribai Phule Pune University</p>
            <div className="edu-pills">
              <span>📅 2019 – 2022</span>
              <span>⭐ CGPA: 7.43 / 10</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const PROJECTS = [
  { name: 'IoT-Max', sub: 'IoT Device Management System', icon: '📡', color: '#a78bfa', tech: ['PHP', 'MySQL', 'JavaScript', 'Shell Scripts'], desc: 'Enterprise IoT device management platform with real-time dashboards, firmware OTA updates, license tracking, and SD-WAN visualization for 1,000+ devices.', points: ['Real-time device monitoring & alerts', 'OTA firmware management module', 'License lifecycle tracking', 'SD-WAN graphs & VPN gateway', '2FA via email OTP'] },
  { name: 'STMS', sub: 'Smart Tower Monitoring System', icon: '🗼', color: '#67e8f9', tech: ['Laravel', 'MySQL'], desc: 'Cellular tower health & performance monitoring with flexible alerting, email grouping, and configurable real-time notification distribution for ops teams.', points: ['2FA via email OTP for secure access', 'Configurable alerting system', 'Email grouping & notification config', 'Real-time monitoring APIs', 'Alarm distribution workflows'] },
  { name: 'Indio Cloud', sub: 'Network Access Management', icon: '☁️', color: '#7c3aed', tech: ['CodeIgniter 4', 'MySQL', 'JavaScript'], desc: 'Comprehensive network access platform with RADIUS auth, ACL role-based access control, modern UI, and Open Wi-Fi portal integration for ISPs.', points: ['OTP-based auth & password reset', 'ACL / RBAC redesign', '11 legacy portal migrations', 'RADIUS auth module', 'Open Wi-Fi API (CI4)'] },
  { name: 'Indio Connect', sub: 'Rural Internet Distribution', icon: '🌐', color: '#059669', tech: ['PHP', 'MySQL', 'CodeIgniter 4'], desc: 'Multi-tier rural internet distribution platform powering voucher systems, data packs, and revenue reporting for operators, distributors, and retailers.', points: ['Voucher & data pack distribution', 'FundooTV CMS integration', 'Revenue & transaction modules', 'Multi-tier operator hierarchy', 'Session & user portal management'] },
  { name: 'Laravel E-Commerce', sub: 'Personal Project', icon: '🛒', color: '#d97706', tech: ['Laravel', 'PHP', 'MySQL', 'HTML5', 'CSS3'], desc: 'Full-stack e-commerce platform with product catalogue, cart, checkout, order management, admin panel, and role-based authentication.', points: ['Product catalogue & cart system', 'Role-based auth (admin/user)', 'Eloquent ORM & Blade templates', 'Order management panel', 'Checkout & payment flow'] },
  { name: 'College Complaint Portal', sub: 'Personal Project', icon: '🎓', color: '#0891b2', tech: ['PHP', 'MySQL', 'HTML', 'CSS', 'JavaScript'], desc: 'Complaint management CMS bridging students and college administration with real-time status tracking and workflow management.', points: ['Create, update & track complaints', 'Status workflow management', 'Admin & student dashboards', 'Real-time status updates'] },
];

function Projects() {
  const [ref, inView] = useInView();
  const [exp, setExp] = useState(null);
  return (
    <section id="projects" className="section alt-bg" ref={ref}>
      <div className={`proj-wrap ${inView ? 'reveal' : ''}`}>
        <div className="sec-head center">
          <span className="eyebrow">Portfolio</span>
          <h2 className="sec-title">Featured <em className="gold">Projects</em></h2>
          <p className="sec-sub">Production systems & personal builds — click to explore</p>
        </div>
        <div className="proj-grid">
          {PROJECTS.map((p, i) => (
            <div className={`p-card ${exp === i ? 'expanded' : ''}`} key={p.name}
              style={{ '--c': p.color, '--i': i }} onClick={() => setExp(exp === i ? null : i)}>
              <div className="pc-accent" />
              <div className="pc-top">
                <div className="pc-icon-wrap"><span>{p.icon}</span></div>
                <div><h3 className="pc-name">{p.name}</h3><p className="pc-sub">{p.sub}</p></div>
                <span className="pc-toggle">{exp === i ? '−' : '+'}</span>
              </div>
              <p className="pc-desc">{p.desc}</p>
              <div className="pc-tags">
                {p.tech.map(t => <span className="pc-tag" key={t}>{t}</span>)}
              </div>
              {exp === i && (
                <ul className="pc-points">
                  {p.points.map((pt, j) => <li key={j} style={{ '--j': j }}><span className="pp-dot" style={{ background: p.color }} />{pt}</li>)}
                </ul>
              )}
              <div className="pc-glow" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const [ref, inView] = useInView();
  return (
    <section id="contact" className="section" ref={ref}>
      <div className={`contact-wrap ${inView ? 'reveal' : ''}`}>
        <div className="contact-left">
          <span className="eyebrow">Let's Connect</span>
          <h2 className="sec-title">Ready to build something <em className="gold">great?</em></h2>
          <p className="body-p">Whether you have a project, job opportunity, or just want to say hello — my inbox is always open. I respond within 24 hours.</p>
          <div className="ci-list">
            {[
              { ic: '✉️', l: 'Email', v: 'sonawanebhavesh360@gmail.com', h: 'mailto:sonawanebhavesh360@gmail.com' },
              { ic: '📱', l: 'Phone', v: '+91 9172067740', h: 'tel:+919172067740' },
              { ic: '📍', l: 'Location', v: 'Nashik / Pune, Maharashtra', h: null },
              { ic: '💼', l: 'LinkedIn', v: 'Connect with me', h: 'https://linkedin.com' },
            ].map(({ ic, l, v, h }) => {
              const inner = <><span className="ci-ic">{ic}</span><div><span className="ci-l">{l}</span><span className="ci-v">{v}</span></div></>;
              return h ? <a key={l} href={h} className="ci-row" target={h.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{inner}</a>
                : <div key={l} className="ci-row">{inner}</div>;
            })}
          </div>
        </div>
        <TiltCard className="contact-box">
          <div className="cb-shine" />
          <h3>Send a Message</h3>
          <p>I'll reply within 24 hours ✨</p>
          <div className="cb-fields">
            <div className="cb-f"><label>Name</label><input placeholder="Your full name" /></div>
            <div className="cb-f"><label>Email</label><input placeholder="your@email.com" /></div>
            <div className="cb-f"><label>Message</label><textarea rows={4} placeholder="Tell me about your project..." /></div>
            <a href="mailto:sonawanebhavesh360@gmail.com" className="btn-gold" style={{ display: 'flex', justifyContent: 'center' }}>
              Send Message →
            </a>
          </div>
        </TiltCard>
      </div>
    </section>
  );
}

function Footer() {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <footer className="footer">
      <div className="footer-top-glow" />
      <div className="footer-content">
        <div className="footer-logo"><span className="logo-box">BS</span><span>Bhavesh Sonawane</span></div>
        <p className="footer-tag">Building the future, one commit at a time. 🚀</p>
        <div className="footer-nav">
          {['home', 'about', 'skills', 'projects', 'contact'].map(l => (
            <button key={l} onClick={() => go(l)}>{l.charAt(0).toUpperCase() + l.slice(1)}</button>
          ))}
        </div>
        <p className="footer-copy">© 2025 Bhavesh Sonawane · Crafted with React & ❤️ in India</p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="App">
      <Cursor />
      <Navbar />
      <Hero />
      <About />
      <Skills />
      <Experience />
      <Projects />
      <Contact />
      <Footer />
    </div>
  );
}
