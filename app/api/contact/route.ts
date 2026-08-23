import { NextRequest, NextResponse } from "next/server"
import { ratelimit } from "../../../lib/ratelimit"
import { Resend } from "resend"
import { stripField } from "./validation/securityFunctions"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"

  const { success, limit, remaining } = await ratelimit.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later."},
      {status: 429}
    )
  }

  try {
  const { name, email, phone, message, service } = await req.json()

  const strippedName = stripField(name)

  if (!strippedName || !email || !message || !phone || !service) {
    return NextResponse.json(
      { message: "All fields are required." },
      { status: 400 }
    );
  }

  // the test request tests the rate limiter
  const isTestRequest = req.headers.get("x-test-mode") === "true"

  if (!isTestRequest) {
    await resend.emails.send({
      from: "Name <contact@clientdomain.com>", 
      to: process.env.RECIPIENT_EMAIL!,
      replyTo: email,
      subject: `New booking request from ${strippedName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Interested in:</strong> ${service}</p>
        <p><strong>Name:</strong> ${strippedName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    })
  }

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