import { NextResponse } from "next/server";
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  
  // 1. Parse the request body
  const { name, email, message } = await req.json();

  // 2. Validate inputs
  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "All fields are required." },
      { status: 400 }
    );
  }

  try {
    await resend.emails.send({
      from: "Contact Form <onboarding@resend.dev>", 
      to: process.env.RECIPIENT_EMAIL!,
      replyTo: email,
      subject: `New message from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      console.error("Email error:", error)
      return NextResponse.json(
        {error: "Failed to send email."},
        {status: 500}
      )
    }
  }