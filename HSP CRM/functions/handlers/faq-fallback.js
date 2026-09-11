function includesAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function getFaqResponse(message, serviceInfo) {
  const normalized = String(message || "").toLowerCase();
  const { business, websitePlan, additionalWork, socialMedia, virtualAssistance, paymentMethods } = serviceInfo;

  if (includesAny(normalized, ["price", "pricing", "cost", "website plan", "per month", "monthly"])) {
    return `${websitePlan.name} is ${websitePlan.price}, month-to-month. It includes up to ${websitePlan.includedHours} hours each month, with no separate website build fee. Additional approved work is ${additionalWork.range}.`;
  }
  if (includesAny(normalized, ["five hours", "5 hours", "included hours", "roll over", "unused hours", "timeline"])) {
    return `The website plan includes up to ${websitePlan.includedHours} hours each month. New websites are completed progressively through those hours. Unused hours expire, and unfinished approved work can continue with the next month's allocation.`;
  }
  if (includesAny(normalized, ["social media", "facebook", "instagram", "posting"])) {
    return `Social media management starts at ${socialMedia.startingPrice}. ${socialMedia.rule}`;
  }
  if (includesAny(normalized, ["payment", "pay", "venmo", "cash app", "zelle", "wire", "check"])) {
    return `HSST accepts ${paymentMethods.join(", ")}. Private account or banking details are shared only after the method is agreed.`;
  }
  if (includesAny(normalized, ["virtual assistant", "virtual assistance", " va ", "admin help"])) {
    return `${virtualAssistance.summary} ${virtualAssistance.pricing}`;
  }
  if (includesAny(normalized, ["contact", "phone", "email", "call", "reach you"])) {
    return `You can reach ${business.owner} at ${business.phone} or ${business.email}, or use the contact form on this website.`;
  }
  if (includesAny(normalized, ["service", "what do you do", "help with", "offer"])) {
    return `HSST provides website care and progressive builds, virtual assistance, SEO, automation, social media support, and practical technology consultation for small businesses and nonprofits.`;
  }

  return null;
}

function getEscalationResponse(serviceInfo) {
  return `I do not have a confirmed answer for that and will not guess. Please contact ${serviceInfo.business.owner} at ${serviceInfo.business.phone} or ${serviceInfo.business.email}.`;
}

module.exports = { getFaqResponse, getEscalationResponse };
