// Israel's numbering plan, as much of it as decides whether a number can ring.
//
// Its own module because two things need it and neither can own it: the phone
// normaliser, which must refuse a number no telephone will answer, and the
// unreachable sweep, which must explain in words why a queued Lead is hopeless.
// Putting it in `phone.ts` would make `unreachable.ts` import the normaliser to
// borrow a rule; putting it in `unreachable.ts` would make `phone.ts` — the
// oldest safety-critical function here — depend on a reporting module.

/**
 * The fault in an E.164 number, or null when the plan has nothing against it.
 * `e164` is what the normaliser has already shaped, so it is +CC then digits;
 * only Israeli numbers are judged — a foreign number is somebody else's plan
 * and is left alone rather than guessed at.
 *
 *   05X / 07X       mobile and VoIP — nine digits after 972
 *   02 03 04 08 09  landline        — eight digits after 972
 *   1XX             service numbers — never a Lead's own telephone
 */
export function israeliPlanFault(e164: string): string | null {
  if (!e164.startsWith('+972')) return null;
  const rest = e164.slice(4);
  const head = rest[0] ?? '';
  if (head === '5' || head === '7') {
    if (rest.length === 9) return null;
    return `0${head}X mobile needs 9 digits after 972, this has ${rest.length}`;
  }
  if ('23489'.includes(head)) {
    if (rest.length === 8) return null;
    return `0${head} landline needs 8 digits after 972, this has ${rest.length}`;
  }
  if (head === '1') return 'a 1XX service number, not a personal telephone';
  return `no Israeli area or mobile prefix begins with ${head || '(nothing)'}`;
}

