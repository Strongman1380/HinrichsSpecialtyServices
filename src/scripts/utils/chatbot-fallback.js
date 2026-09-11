export function getChatbotFallback(question, serviceInfo) {
  const text = String(question || "").toLowerCase();
  const info = serviceInfo || {};
  const website = info.websitePlan || {};
  const additional = info.additionalWork || {};
  const social = info.socialMedia || {};
  const virtualAssistance = info.virtualAssistance || {};
  const business = info.business || {};
  const methods = Array.isArray(info.paymentMethods) ? info.paymentMethods : [];

  if (/price|pricing|cost|website|build fee|monthly/.test(text) && website.price) {
    return `${website.name} is ${website.price} with no separate build fee. It includes up to ${website.includedHours} hours each month for progressive website development, hosting, maintenance, security updates, routine content updates, basic SEO, and Google Search Console monitoring.`;
  }
  if (/hour|roll over|rollover|faster|timeline|overage|extra work/.test(text) && website.includedHours) {
    return `The plan includes ${website.includedHours} hours each month. Unused hours do not roll over, unfinished work can continue with the next month, and extra work requires advance approval at ${additional.range}.`;
  }
  if (/social|facebook|instagram|posting/.test(text) && social.startingPrice) {
    return `Social media management starts at ${social.startingPrice}. ${social.rule}`;
  }
  if (/payment|venmo|cash app|zelle|check|wire|cash/.test(text) && methods.length) {
    return `HSST accepts ${methods.join(", ")}. Contact Brandon for the correct payment instructions.`;
  }
  if (/virtual assistant|virtual assistance|admin|research|organize/.test(text) && virtualAssistance.summary) {
    return `${virtualAssistance.summary} ${virtualAssistance.pricing}`;
  }
  if (/contact|phone|email|brandon/.test(text) && (business.phone || business.email)) {
    return `You can reach Brandon at ${business.phone} or ${business.email}, or use the website contact form.`;
  }
  return `I can explain website services, included monthly hours, social media management, virtual assistant support, payment options, or how to contact Brandon. You can also call ${business.phone || "(402) 759-2210"}.`;
}
