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
  const from = process.env.MAIL_FROM || 'yalp.uz <kiriş@yalp.uz>'

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
    console.error(`[mail] ${res.status} ${await res.text().catch(() => '')}`)
    throw createError({ statusCode: 502, statusMessage: 'Xat yuborib boʻlmadi' })
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
      'Agar siz bu soʻrovni yubormagan boʻlsangiz, bu xatni eʼtiborsiz qoldiring.',
      '',
      'yalp.uz — Toşkent joylari',
    ].join('\n'),
  }
}
