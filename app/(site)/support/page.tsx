'use client';

import { useRef } from 'react';
import CdnImage from '@/components/yd/CdnImage';
import { impacts, tiers } from '@/lib/yd/dict';
import { useLang } from '@/lib/yd/lang';
import { CHARITY_EXTRA, DONATE, EMAIL, G, NEDARIM_DONATE, PageHero, SOCIAL, STRIPE_DONATE, useMagnetic, useMotion, useSharedMotion } from '@/components/yd/core';

export default function SupportPage() {
  const { t, lang } = useLang();
  const rootRef = useRef<HTMLDivElement>(null);
  const motion = useMotion();
  const orbRef = useMagnetic<HTMLAnchorElement>(0.4);
  useSharedMotion(rootRef, motion);

  return (
    <div ref={rootRef} className="yd-page yd-supportpage">
      <PageHero kicker={t.support.k} pre={t.support.h[0]} title={t.support.h[1]} intro={t.support.intro} src={G + 'photo-14.png'} pos="50% 40%" />

      {/* Platforms */}
      <section className="yd-give-sec">
        <p className="yd-kicker" data-rise>
          <span>(01)</span> {t.support.platformsK}
        </p>
        <div className="yd-give-grid">
          <a ref={orbRef} href={DONATE} target="_blank" rel="noopener noreferrer" className="yd-give-orb yd-give-orb-xl" data-cursor={t.give.donate}>
            <span data-magnet-inner>
              {t.give.donate}
              <small>CauseMatch ↗</small>
            </span>
          </a>
          <div className="yd-platforms">
            <a href={DONATE} target="_blank" rel="noopener noreferrer" className="yd-platform" data-rise>
              <span className="yd-platform-k">CauseMatch</span>
              <span className="yd-platform-d">{t.support.causeMatchD}</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
            <a href={CHARITY_EXTRA} target="_blank" rel="noopener noreferrer" className="yd-platform" data-rise>
              <span className="yd-platform-k">CharityExtra <small>UK · Gift Aid</small></span>
              <span className="yd-platform-d">{t.support.charityExtraD}</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
            <a href={NEDARIM_DONATE} target="_blank" rel="noopener noreferrer" className="yd-platform" data-rise>
              <span className="yd-platform-k">Nedarim Plus <small>Israel · ₪ · הוראת קבע</small></span>
              <span className="yd-platform-d">{t.support.nedarimD}</span>
              <span className="yd-arrow" aria-hidden="true">↗</span>
            </a>
            {STRIPE_DONATE && (
              <a href={STRIPE_DONATE} target="_blank" rel="noopener noreferrer" className="yd-platform" data-rise>
                <span className="yd-platform-k">Stripe <small>$ · £ · €</small></span>
                <span className="yd-platform-d">{t.support.stripeD}</span>
                <span className="yd-arrow" aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="yd-tiers-sec">
        <p className="yd-kicker yd-kicker-light" data-rise>
          <span>(02)</span> {t.support.tiersK}
        </p>
        <ol className="yd-tiers">
          {tiers.map((tier, i) => (
            <li key={tier.amount} data-rise>
              <a href={DONATE} target="_blank" rel="noopener noreferrer" className={`yd-tier ${i === 2 ? 'is-hl' : ''}`}>
                <span className="yd-tier-amt" dir="ltr">${tier.amount.toLocaleString('en-US')}</span>
                <span className="yd-tier-l">{tier[lang].label}</span>
                <span className="yd-tier-d">{tier[lang].d}</span>
                <span className="yd-arrow" aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ol>
        <p className="yd-tiers-note" data-rise>{t.support.tiersNote}</p>
      </section>

      {/* Where it goes */}
      <section className="yd-impact-sec">
        <p className="yd-kicker" data-rise>
          <span>(03)</span> {t.support.impactK}
        </p>
        <div className="yd-impact-grid">
          <figure className="yd-impact-fig">
            <div className="yd-unmask yd-grade">
              <CdnImage src={G + 'photo-6.png'} alt="" fill quality={68} sizes="(max-width: 900px) 100vw, 45vw" />
            </div>
          </figure>
          <ol className="yd-impacts">
            {impacts.map((im, i) => (
              <li key={i} data-rise>
                <span className="yd-impact-n">{String(i + 1).padStart(2, '0')}</span>
                <h3>{im[lang][0]}</h3>
                <p>{im[lang][1]}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Questions */}
      <section className="yd-endband yd-endband-dark">
        <h2 className="yd-h2" data-rise>{t.support.questionsH}</h2>
        <p className="yd-endnote" data-rise>{t.support.questions}</p>
        <a href={`mailto:${EMAIL}`} className="yd-endlink" data-rise>
          <span className="yd-endlink-k">Email</span>
          <span className="yd-endlink-v" dir="ltr">{EMAIL}</span>
          <span className="yd-arrow" aria-hidden="true">↗</span>
        </a>
        <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" className="yd-endlink" data-rise>
          <span className="yd-endlink-k">Instagram</span>
          <span className="yd-endlink-v" dir="ltr">@liffs_yeshiva</span>
          <span className="yd-arrow" aria-hidden="true">↗</span>
        </a>
      </section>
    </div>
  );
}
