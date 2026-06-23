import { NextResponse } from "next/server"
import { Resend } from "resend"
import sanitizeHtml from "sanitize-html"
import { sanitise as sanitise } from "./sanitised"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  
  try {
  const { name, email, phone, message, service } = await req.json()

  if (!name || !email || !message || !phone || !service) {
    return NextResponse.json(
      { message: "All fields are required." },
      { status: 400 }
    );
  }

  // strips all html
  const safeName = sanitizeHtml(sanitise(name))
  const safeEmail = sanitizeHtml(sanitise(email))
  const safeMessage = sanitizeHtml(message)
  const safeService = sanitizeHtml(service)

    await resend.emails.send({
      from: safeName + " <onboarding@resend.dev>", 
      to: process.env.RECIPIENT_EMAIL!,
      replyTo: safeEmail,
      subject: `New message from ${safeName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Interested in:</strong> ${safeService}</p>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
    });

    return NextResponse.json(
      { message: "Email sent successfully." }, 
      { status: 200 }
    )
    } catch (error) {
      console.error("Email error:", error)
      return NextResponse.json(
        {message: "Failed to send email."},
        {status: 500}
      )
    }
  }