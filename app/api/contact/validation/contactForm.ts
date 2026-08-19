import { z } from "zod"

export const contactFormSchema = z.object({

    name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name is too long."),

    email: z
    .email()
    .max(255, "Email is too long"),

    phone: z
    .e164(),

    message: z
    .string()
    .trim()
    .max(2000, "Message too long."),

    service: z
    .string()
    .trim()
    .max(100)

    // add honeypot feild.
})

export type ContactFormData = z.infer<typeof contactFormSchema>