import { NextRequest, NextResponse } from "next/server"
import { ratelimit } from "../../../lib/ratelimit"
import { Resend } from "resend"
import { stripField } from "./validation/securityFunctions"
import validator from "validator"

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
  const strippedEmail = stripField(email)
  const strippedPhone = stripField(phone)
  const strippedMessage = stripField(message)
  const strippedService = stripField(service)
  const sanitisedName = validator.stripLow(strippedName)

  if (!strippedName || !sanitisedName || !strippedEmail || !strippedMessage || !strippedPhone || !strippedService) {
    return NextResponse.json(
      { message: "All fields are required." },
      { status: 400 }
    );
  }

  const isEmailSanitised = validator.isEmail(strippedEmail)
  const isPhoneNumber = validator.isMobilePhone(strippedPhone)

  if (!isEmailSanitised || !isPhoneNumber) {
    return NextResponse.json(
      {message : "Invalid input."},
      {status : 400}
    )
  }

  // the test request tests the rate limiter
  const isTestRequest = req.headers.get("x-test-mode") === "true"

  if (!isTestRequest) {
    await resend.emails.send({
      from: "Name <contact@clientdomain.com>", 
      to: process.env.RECIPIENT_EMAIL!,
      replyTo: strippedEmail,
      subject: `New booking request from ${sanitisedName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Interested in:</strong> ${strippedService}</p>
        <p><strong>Name:</strong> ${sanitisedName}</p>
        <p><strong>Email:</strong> ${strippedEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${strippedMessage}</p>
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

