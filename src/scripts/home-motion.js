// Hero entrances are CSS; load scroll choreography only on capable desktop views.
const eligible = window.matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)');
let active, revision = 0;
async function syncMotion() {
  const current = ++revision;
  active?.revert(); active = null;
  if (!eligible.matches) return;
  let modules;
  try { modules = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]); } catch { return; }
  if (!eligible.matches || current !== revision) return;
  const [{ gsap }, { ScrollTrigger }] = modules;
  gsap.registerPlugin(ScrollTrigger);
  active = gsap.context(() => {
    gsap.to('.hero-tech-image', { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 } });
    const cards = gsap.utils.toArray('.service-stack-card');
    cards.slice(0,-1).forEach((card,index) => {
      ScrollTrigger.create({ trigger: card, start: 'top top+=92', endTrigger: cards.at(-1), end: 'top top+=92', pin: true, pinSpacing: false });
      gsap.to(card, { scale: .97, opacity: .65, ease: 'none', scrollTrigger: { trigger: cards[index+1], start: 'top bottom', end: 'top top+=92', scrub: true } });
    });
  });
}
eligible.addEventListener('change', syncMotion);
window.addEventListener('pagehide', () => { revision++; active?.revert(); active = null; });
window.addEventListener('pageshow', event => { if (event.persisted) syncMotion(); });
if ('requestIdleCallback' in window) window.requestIdleCallback(syncMotion, { timeout: 2000 });
else window.setTimeout(syncMotion, 100);
