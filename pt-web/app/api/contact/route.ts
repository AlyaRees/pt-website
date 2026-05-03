import { NextResponse } from "next/server";
import { Resend } from "resend"
import sanitizeHtml from "sanitize-html"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  
  try {
  const { name, email, message } = await req.json()

  if (!name || !email || !message) {
    return NextResponse.json(
      { message: "All fields are required." },
      { status: 400 }
    );
  }

  // strips all html
  const safeName = sanitizeHtml(name, { allowedTags: []})

    await resend.emails.send({
      from: safeName + " <onboarding@resend.dev>", 
      to: process.env.RECIPIENT_EMAIL!,
      replyTo: email,
      subject: `New message from ${safeName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
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