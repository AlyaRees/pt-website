export function sanitisedEmail(email :string) {
    return email.replace(/[\r\n\t]/g, "") // strip newlines and tabs
    .replace(/[^\x20-\x7E]/g, "") // strip non-printable ASCII
    .trim()
}