/*
 * Where support messages go.
 *
 * The chat box sends to this number as a text message: the visitor writes in
 * the panel, and Send opens their own messaging app with the message filled in
 * and addressed here. There is no server in the middle, so nothing is stored
 * and there is no third-party chat service to pay for or keep signed in — the
 * conversation simply continues in the studio's messages.
 *
 * Change the number here and every link follows.
 */

export const SUPPORT_PHONE = {
  /* E.164, for sms: and tel: links. */
  e164: "+14703444864",
  /* How it reads on the page. */
  display: "(470) 344-4864",
};

/* What people can ask about. The chosen topic leads the message, so the first
   line of the text says what the conversation is for. */
export const SUPPORT_TOPICS = ["InDesign automation", "Data merge", "Microsoft Publisher"];

/*
 * The text message the visitor's app opens with.
 *
 * `?&body=` rather than `?body=`: iOS long read the body after `&` and Android
 * after `?`, and this form is accepted by both.
 */
export function smsHref({ topic, message }) {
  const lines = [];
  if (topic) lines.push(`${topic} project`);
  if (message.trim()) lines.push(message.trim());
  lines.push("(via pressmark.studio)");
  return `sms:${SUPPORT_PHONE.e164}?&body=${encodeURIComponent(lines.join("\n"))}`;
}

export const telHref = () => `tel:${SUPPORT_PHONE.e164}`;
