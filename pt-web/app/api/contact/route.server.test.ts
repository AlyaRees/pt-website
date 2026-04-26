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

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({success: true})
    })
})