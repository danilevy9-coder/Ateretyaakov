'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { hanhala } from '@/data/hanhala';
import { staffBios } from '@/lib/yd/dict';
import { useLang } from '@/lib/yd/lang';
import { G, PageHero, Portrait, useMotion, useSharedMotion, useStaffName } from '@/components/yd/core';

function Bio({ paras, more, less }: { paras: string[]; more: string; less: string }) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = paras;
  return (
    <div className="yd-bio">
      <p>{first}</p>
      {rest.length > 0 && (
        <>
          <div className={`yd-bio-more ${open ? 'is-open' : ''}`}>
            <div>
              {rest.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <button type="button" className="yd-bio-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? less : more} <span aria-hidden="true">{open ? '−' : '+'}</span>
          </button>
        </>
      )}
    </div>
  );
}

export default function StaffPage() {
  const { t, lang, rtl } = useLang();
  const staffName = useStaffName();
  const rootRef = useRef<HTMLDivElement>(null);
  const motion = useMotion();
  useSharedMotion(rootRef, motion);
  const roles = t.hanhala.roles;

  return (
    <div ref={rootRef} className="yd-page yd-staff">
      <PageHero
        kicker={t.hanhala.pageK}
        title={t.hanhala.pageH}
        accent={t.hanhala.pageAccent}
        intro={t.hanhala.pageIntro}
        src={G + 'photo-12.png'}
        pos="45% 50%"
      />

      <section className="yd-people" aria-label={t.hanhala.pageH}>
        {hanhala.map((m, i) => {
          const bio = staffBios[m.slug];
          const alt = rtl ? m.name : m.hebrewName;
          return (
            <article key={m.slug} id={m.slug} className="yd-person">
              <div className="yd-person-pic" data-speed="0.08">
                <Portrait m={m} size="lg" />
              </div>
              <div className="yd-person-text" data-rise>
                <p className="yd-person-num">
                  {String(i + 1).padStart(2, '0')}
                  <small>/{String(hanhala.length).padStart(2, '0')}</small>
                </p>
                <p className="yd-role">{roles[m.role] || m.role}</p>
                <h2 className="yd-person-name">{staffName(m)}</h2>
                {alt ? <p className="yd-person-alt">{alt}</p> : null}
                {rtl && !m.hebrewName ? <p className="yd-ph-chip">{t.hanhala.hebrewNameToCome}</p> : null}
                {bio ? (
                  <Bio paras={bio[lang]} more={t.hanhala.readMore} less={t.hanhala.readLess} />
                ) : (
                  <p className="yd-placeholder yd-bio-ph">{t.hanhala.bioToCome}</p>
                )}
                {bio && bio.focus[lang].length > 0 && (
                  <ul className="yd-chips" aria-label={t.hanhala.focus}>
                    {bio.focus[lang].map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="yd-endband">
        <Link href="/gallery" className="yd-endlink" data-rise>
          <span className="yd-endlink-k">{t.nav.gallery}</span>
          <span className="yd-endlink-v">{t.home.lifeH}</span>
          <span className="yd-arrow yd-arr" aria-hidden="true">→</span>
        </Link>
        <Link href="/support" className="yd-endlink" data-rise>
          <span className="yd-endlink-k">{t.nav.support}</span>
          <span className="yd-endlink-v">{t.home.supportH}</span>
          <span className="yd-arrow yd-arr" aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}
