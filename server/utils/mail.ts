/**
 * Outbound mail — one message, one shape: the login link.
 *
 * Deliberately a bare fetch rather than a provider SDK. The body below is
 * the whole integration, so swapping Resend for Postmark, SES or a plain
 * SMTP relay on the eventual VPS is a change to one function.
 *
 * With no RESEND_API_KEY set, the link is written to the log instead of
 * sent. That is what makes `npm run dev` work with no accounts anywhere,
 * and it is why the caller must never echo the link back in an HTTP
 * response — see server/api/auth/request.post.ts.
 */
export interface Mail {
  to: string
  subject: string
  text: string
}

export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY
  /**
   * ASCII only in the address itself.
   *
   * The default used to be `kiriş@yalp.uz`. An email local part has to be
   * ASCII unless every hop speaks SMTPUTF8, which no provider promises —
   * so that address was rejected by anyone who tried to send from it, and
   * the site's own alphabet rule had quietly produced an invalid one.
   * The display name beside it may be anything.
   */
  const from = process.env.MAIL_FROM || 'yalp.uz <kirish@yalp.uz>'

  if (!key) {
    // Development. Printing beats failing: the flow stays walkable
    // end to end without a mail provider.
    console.info(`\n[mail:dev] to ${mail.to}\n${mail.text}\n`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
  })

  if (!res.ok) {
    // The provider's message is for the log, never for the visitor: it
    // can carry account details, and there is nothing they could do with
    // it anyway.
    const detail = await res.text().catch(() => '')
    console.error(`[mail] ${res.status} from=${from} ${detail}`)
    /**
     * A 403 from Resend means the sending domain is not verified — the
     * one failure here that is a setup step rather than a fault, and the
     * one worth naming, because "could not send" sends somebody looking
     * in the code for something that is in a dashboard.
     */
    throw createError({
      statusCode: 502,
      statusMessage: res.status === 403
        ? 'Poçta xizmati domenni tasdiqlamagan — MAIL_FROM sozlamasini tekşiring'
        : 'Xat yuborib bölmadi',
    })
  }
}

export function loginMail(to: string, link: string, ttlMin: number): Mail {
  return {
    to,
    subject: 'yalp.uz — kiriş havolasi',
    text: [
      'Salom!',
      '',
      'yalp.uz saytiga kiriş uçun quyidagi havolani bosing:',
      link,
      '',
      `Havola ${ttlMin} daqiqa amal qiladi va faqat bir marta işlaydi.`,
      'Agar siz bu sörovni yubormagan bölsangiz, bu xatni eʼtiborsiz qoldiring.',
      '',
      'yalp.uz — Toşkent joylari',
    ].join('\n'),
  }
}
