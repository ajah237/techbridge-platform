import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { z } from 'https://esm.sh/zod@3.23.8'
import { Pingram } from 'npm:pingram'
import {
  getCorsHeaders,
  resolveAllowedSiteOrigin,
  resolveSafeAppUrl,
} from '../_shared/cors.ts'

// Pingram sender configuration. Override via PINGRAM_FROM_EMAIL / PINGRAM_FROM_NAME
// once you've verified your sender domain in Pingram.
const FROM_EMAIL = Deno.env.get('PINGRAM_FROM_EMAIL') ?? 'noreply@pingram.io'
const FROM_NAME = Deno.env.get('PINGRAM_FROM_NAME') ?? 'TechBridge'

const BodySchema = z.object({
  type: z.enum(['event_registration', 'certificate_issued', 'certificate_download', 'team_registration']),
  recipientEmail: z.string().trim().email().max(255).optional(),
  recipientName: z.string().trim().min(1).max(200).optional(),
  data: z.record(z.any()).optional(),
})

// Per-user email rate limit (max 10 emails per minute per user)
const EMAIL_RL_MAX = 10
const EMAIL_RL_WINDOW_MS = 60_000
const emailBuckets = new Map<string, { count: number; reset: number }>()

function allowEmail(userId: string): boolean {
  const now = Date.now()
  if (emailBuckets.size > 500) {
    for (const [k, v] of emailBuckets) {
      if (now > v.reset) emailBuckets.delete(k)
    }
  }
  const b = emailBuckets.get(userId)
  if (!b || now > b.reset) {
    emailBuckets.set(userId, { count: 1, reset: now + EMAIL_RL_WINDOW_MS })
    return true
  }
  if (b.count >= EMAIL_RL_MAX) return false
  b.count++
  return true
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify the caller's JWT before doing anything
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: adminRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle()
    const isAdmin = !!adminRow

    if (!isAdmin && !allowEmail(userData.user.id)) {
      return new Response(JSON.stringify({ error: 'Too many notification requests. Please wait a minute.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.json().catch(() => null)
    const parsed = BodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let { type, recipientEmail, recipientName, data } = parsed.data as any

    // Certificate emails can only be triggered by admins to prevent self-forged official certificate emails
    if ((type === 'certificate_issued' || type === 'certificate_download') && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: only admins can dispatch certificate emails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Team registration status emails: recipient and details come from the database, never the caller.
    let teamReg: any = null
    if (type === 'team_registration') {
      const regId = z.string().uuid().safeParse(data?.registrationId)
      if (!regId.success) {
        return new Response(JSON.stringify({ error: 'registrationId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: reg } = await supabase
        .from('team_registrations')
        .select('id, created_by, team_name, team_code, reference, status, fee_amount, currency, fee_tier_label, review_notes, events(title, slug), event_categories(name)')
        .eq('id', regId.data)
        .maybeSingle()
      if (!reg) {
        return new Response(JSON.stringify({ error: 'Registration not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (reg.created_by !== userData.user.id && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: owner } = await supabase.auth.admin.getUserById(reg.created_by)
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', reg.created_by)
        .maybeSingle()
      recipientEmail = owner?.user?.email
      recipientName = prof?.full_name || 'Team leader'
      if (!recipientEmail) {
        return new Response(JSON.stringify({ error: 'Registrant has no email' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      teamReg = reg
    } else if (!recipientEmail || !recipientName) {
      return new Response(JSON.stringify({ error: 'recipientEmail and recipientName required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Authorization: only allow sending to the caller's own email unless caller is an admin
    const callerEmail = userData.user.email?.toLowerCase() ?? ''
    const isSelf = !!teamReg || (callerEmail && callerEmail === recipientEmail.toLowerCase())
    if (!isSelf && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: can only send to your own email' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const PINGRAM_API_KEY = Deno.env.get('PINGRAM_API_KEY')
    if (!PINGRAM_API_KEY) {
      return new Response(JSON.stringify({ error: 'PINGRAM_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build branded email content
    let subject = ''
    let html = ''
    let text = ''

    if (type === 'event_registration') {
      const eventTitle = String(data?.eventTitle || 'an event').slice(0, 200)
      const eventDate = String(data?.eventDate || '').slice(0, 100)
      const eventLocation = String(data?.eventLocation || '').slice(0, 200)
      const participantId = String(data?.participantId || '').slice(0, 100)
      const isVirtual = !!data?.isVirtual
      const eventUrl = resolveSafeAppUrl(data?.eventUrl) ?? ''
      subject = sanitizeSubject(`Registration Confirmed: ${eventTitle}`)
      text = `Hi ${recipientName},\n\nYou are registered for ${eventTitle}.${participantId ? `\nParticipant ID: ${participantId}` : ''}${eventDate ? `\nDate: ${eventDate}` : ''}${eventLocation ? `\nLocation: ${isVirtual ? 'Virtual — ' : ''}${eventLocation}` : isVirtual ? '\nLocation: Virtual' : ''}${eventUrl ? `\nEvent page: ${eventUrl}` : ''}\n\nPlease keep your Participant ID for check-in.\n\nSee you there!\n— TechBridge`
      html = baseTemplate(`
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a">You're registered 🎉</h1>
        <p>Hi ${escape(recipientName)},</p>
        <p>You're confirmed for <strong>${escape(eventTitle)}</strong>.</p>
        ${participantId ? `<div style="margin:16px 0;padding:14px 16px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#4338ca;font-weight:600">Participant ID</div><div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:16px;color:#1e1b4b;margin-top:4px;word-break:break-all">${escape(participantId)}</div><div style="font-size:12px;color:#64748b;margin-top:6px">Please present this ID at check-in.</div></div>` : ''}
        ${eventDate ? `<p><strong>Date:</strong> ${escape(eventDate)}</p>` : ''}
        ${eventLocation ? `<p><strong>Location:</strong> ${isVirtual ? 'Virtual — ' : ''}${escape(eventLocation)}</p>` : isVirtual ? `<p><strong>Location:</strong> Virtual</p>` : ''}
        ${eventUrl ? `<p><a href="${escape(eventUrl)}" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none">View event details</a></p>` : ''}
        <p>We look forward to seeing you.</p>
      `)
    } else if (type === 'certificate_issued') {
      const eventTitle = String(data?.eventTitle || 'an event').slice(0, 200)
      const certNumber = String(data?.certificateNumber || '').slice(0, 64)
      const verifyUrl = resolveSafeAppUrl(data?.verifyUrl) ?? ''
      subject = `Your TechBridge Certificate is Ready 🎓`
      text = `Hi ${recipientName},\n\nYour certificate for ${eventTitle} has been issued.\nCertificate Number: ${certNumber}${verifyUrl ? `\nVerify: ${verifyUrl}` : ''}\n\n— TechBridge`
      html = baseTemplate(`
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a">Your certificate is ready 🎓</h1>
        <p>Hi ${escape(recipientName)},</p>
        <p>Congratulations! Your certificate for <strong>${escape(eventTitle)}</strong> has been issued.</p>
        <p><strong>Certificate Number:</strong> <code>${escape(certNumber)}</code></p>
        ${verifyUrl ? `<p><a href="${escape(verifyUrl)}" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none">Verify certificate</a></p>` : ''}
      `)
    } else if (type === 'certificate_download') {
      const eventTitle = String(data?.eventTitle || 'your program').slice(0, 200)
      const certNumber = String(data?.certificateNumber || '').slice(0, 64)
      const downloadUrl = resolveSafeAppUrl(data?.downloadUrl) ?? ''
      const verifyUrl = resolveSafeAppUrl(data?.verifyUrl) ?? ''
      const expiresAt = String(data?.expiresAt || '').slice(0, 100)
      subject = `Download your TechBridge certificate 🎓`
      text = `Hi ${recipientName},\n\nYour certificate for ${eventTitle} is ready to download.\nCertificate Number: ${certNumber}\nSecure download link: ${downloadUrl}${expiresAt ? `\nThis link expires on ${expiresAt}.` : ''}${verifyUrl ? `\nVerify anytime: ${verifyUrl}` : ''}\n\nDo not share this link — it is unique to you.\n\n— TechBridge`
      html = baseTemplate(`
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a">Download your certificate 🎓</h1>
        <p>Hi ${escape(recipientName)},</p>
        <p>Your certificate for <strong>${escape(eventTitle)}</strong> is ready. It includes the official TechBridge seal and our D-TECH partner mark, in print-ready A4 landscape.</p>
        <p><strong>Certificate Number:</strong> <code>${escape(certNumber)}</code></p>
        ${downloadUrl ? `<p><a href="${escape(downloadUrl)}" style="display:inline-block;padding:12px 22px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open &amp; download PDF</a></p>` : ''}
        <p style="font-size:12px;color:#64748b">This is a private link unique to you — please don't forward it.${expiresAt ? ` It expires on ${escape(expiresAt)}.` : ''}</p>
        ${verifyUrl ? `<p style="font-size:12px;color:#64748b">Anyone can confirm authenticity at <a href="${escape(verifyUrl)}">${escape(verifyUrl)}</a>.</p>` : ''}
      `)
    }

    if (type === 'team_registration' && teamReg) {
      const STATUS: Record<string, [string, string]> = {
        submitted: ['Registration received', 'We have received your team registration. Please complete payment so we can review it.'],
        payment_pending: ['Payment pending', 'Your registration is waiting for payment. Send the fee using the accounts on the registration page, then add your transaction details.'],
        payment_verification: ['Payment received — being verified', 'Thank you! The organisers are checking your payment. You will get another email once it is confirmed.'],
        approved: ['Your team is approved 🎉', 'Your payment is verified and your team is officially approved. You can now submit your project from the Team Portal when submissions open.'],
        rejected: ['Registration needs attention', 'Unfortunately your registration was not approved. See the organiser note below and contact us if you have questions.'],
        withdrawn: ['Registration withdrawn', 'Your registration has been withdrawn.'],
        draft: ['Corrections requested', 'The organisers have asked for changes to your registration. Please open it, update the details and resubmit.'],
      }
      const [headline, body] = STATUS[teamReg.status] ?? ['Registration update', 'Your registration status has changed.']
      const ev = teamReg.events?.title ?? 'the event'
      const origin = resolveAllowedSiteOrigin(data?.origin)
      const portal = `${origin}/team-portal`
      const fee = teamReg.fee_amount != null ? `${Number(teamReg.fee_amount).toLocaleString('en')} ${teamReg.currency ?? ''}`.trim() : ''
      subject = sanitizeSubject(`${headline} — ${ev}`)
      const row = (k: string, v: string) =>
        v ? `<tr><td style="padding:6px 0;color:#64748b">${escape(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600">${escape(v)}</td></tr>` : ''
      html = baseTemplate(`
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a">${escape(headline)}</h1>
        <p>Hi ${escape(recipientName)},</p>
        <p>${escape(body)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;border-top:1px solid #e2e8f0">
          ${row('Event', ev)}${row('Category', teamReg.event_categories?.name ?? '')}${row('Team', teamReg.team_name ?? '')}
          ${row('Team ID', teamReg.team_code ?? '')}${row('Reference', teamReg.reference ?? '')}${row('Fee', fee ? `${teamReg.fee_tier_label ?? ''} ${fee}`.trim() : '')}
        </table>
        ${teamReg.review_notes ? `<p style="padding:12px;background:#fef9c3;border-radius:8px"><strong>Organiser note:</strong> ${escape(teamReg.review_notes)}</p>` : ''}
        <p><a href="${escape(portal)}" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none">Open Team Portal</a></p>
      `)
    }

    try {
      const pingram = new Pingram({ apiKey: PINGRAM_API_KEY })
      const sendData: any = await pingram.send({
        type: 'email_compose_preview',
        to: { email: recipientEmail },
        email: {
          subject,
          html,
          senderName: FROM_NAME,
          senderEmail: FROM_EMAIL,
        },
      })
      return new Response(
        JSON.stringify({ success: true, id: sendData?.id ?? sendData?.messageId ?? null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    } catch (sendErr) {
      console.error('Pingram send failed', sendErr)
      return new Response(
        JSON.stringify({ error: 'Email delivery service failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  } catch (error) {
    console.error('Notification error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function sanitizeSubject(s: string) {
  return String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200)
}

function escape(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

function baseTemplate(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
        ${inner}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#64748b;margin:0">TechBridge — empowering the next generation of tech leaders.</p>
      </div>
    </div>
  </body></html>`
}
