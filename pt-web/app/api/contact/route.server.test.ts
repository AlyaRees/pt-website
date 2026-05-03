import { POST } from "./route"

// Resend mocked -> (so no real emails are sent)
jest.mock(`resend`, () => ({
    Resend: jest.fn().mockImplementation(() => ({
        emails: {
            send: jest.fn().mockResolvedValue({ id : "test-email-id"})
        }
    }))
}))

// request object
const request = (body :object) => new Request("http://localhost:3000/api/contact", {
    method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
})

describe("Testing the POST api", () => {
    it("should return 200 when all feilds are valid.", async () => {
        const response = await POST(request({
            name: "TestUser",
            email: "testuser@test.com",
            message: "hi there."
        }))

        const resolvedResponse = await response.json()
        
        expect(response.status).toBe(200)
        expect(resolvedResponse.message).toBe("Email sent successfully.")
    })

    it("should return 400 when submitting an empty feild", async () => {
        const response = await POST(request({
            name: "",
            email: "testuser1@test.com",
            message: "hello"
        }))

        const resolvedResponse = await response.json()

        expect(response.status).toBe(400)
        expect(resolvedResponse.message).toBe("All fields are required.")
    })
})