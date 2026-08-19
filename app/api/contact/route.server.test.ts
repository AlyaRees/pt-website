import { POST } from "./route"
import { NextRequest } from "next/server";

// Resend mocked -> (so no real emails are sent)

jest.mock("resend", () => {
  const mockSend = jest.fn().mockResolvedValue({ id: "test-email-id" });
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
  };
});

// Now grab a reference to it for use in your tests
const getMockSend = () => {
  const { Resend } = require("resend");
  return new Resend().emails.send;
}

// __tests__/contact.test.ts
jest.mock("../../../lib/ratelimit", () => ({
  ratelimit: {
    limit: jest.fn().mockResolvedValue({ success: true }),
  },
}));

const api = "http://localhost:3000/api/contact";

// request object
const request = (body: object) =>
  new NextRequest(api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("Testing the POST api", () => {
  beforeEach(() => {
    getMockSend().mockClear();
  });
  it("should return 200 when all fields are valid.", async () => {
    const response = await POST(
      request({
        name: "TestUser",
        email: "testuser@test.com",
        phone: "+15555555555",
        message: "hi there.",
        service: "helo"
      }),
    );

    const resolvedResponse = await response.json();

    expect(response.status).toBe(200);
    expect(resolvedResponse.message).toBe("Email sent successfully.");
  });

  it("should return 400 when submitting an empty name field", async () => {
    const response = await POST(
      request({
        name: "",
        email: "testuser1@test.com",
        message: "hello",
        service: "-"
      }),
    );

    const resolvedResponse = await response.json();

    expect(response.status).toBe(400);
    expect(resolvedResponse.message).toBe("All fields are required.");
  });

  it("should return 400 when submitting an empty email field", async () => {
    const response = await POST(
      request({
        name: "rob roberts",
        email: "",
        message: "hello there.",
        service: "-"
      }),
    );

    const resolvedResponse = await response.json();

    expect(response.status).toBe(400);
    expect(resolvedResponse.message).toBe("All fields are required.");
  });

  it("should return 400 when submitting an empty message field", async () => {
    const response = await POST(
      request({
        name: "julia",
        email: "testuser123@test.com",
        message: "",
        service: "-"
      }),
    );

    const resolvedResponse = await response.json();

    expect(response.status).toBe(400);
    expect(resolvedResponse.message).toBe("All fields are required.");
  });

  it("should return 400 when all fields are left empty and user hits submit", async () => {
    const response = await POST(
      request({
        name: "",
        email: "",
        message: "",
        service: "-"
      }),
    );

    const resolvedResponse = await response.json();

    expect(response.status).toBe(400);
    expect(resolvedResponse.message).toBe("All fields are required.");
  });

  it("should gracefully return 500 when the body is completely empty", async () => {

    const request = new NextRequest(api, {
      method: "POST"
    })

    const response = await POST(request)

    const resolvedResponse = await response.json()

    expect(response.status).toBe(500);
    expect(resolvedResponse.message).toBe("Failed to send email.");
    expect(resolvedResponse.message).not.toContain("Cannot read properties");
    expect(resolvedResponse.message).not.toContain("undefined");
  });

  describe("Contact form input sanitisation", () => {
    it("should strip all script tags from the html from the name field", async () => {
      const res = await POST(
        request({
          name: "<script>alert('xss')</script>Jane",
          email: "jane@example.com",
          phone: "09876543234",
          message: "Hello",
          service: "-"
        })
      );
      expect(res.status).toBe(200);
      // Confirm the script tag was stripped — resend mock should have been called with clean data
      const callArg = getMockSend().mock.calls[0][0]
      expect(callArg.html).not.toContain("<script>")
      expect(callArg.from).not.toContain("<script>")
      expect(callArg.subject).not.toContain("<script>")
    })

    it("should remove all newline characters from the name input field", async () => {

      const response = await POST(request({
        name: "Charlie\r\nBCC: spam@evil.com",
        email: "cupcakes@gmail.com",
        phone: "07987123765",
        message: "hi",
        service: "-"
      }))

      expect(response.status).toBe(200);

      const callArg = getMockSend().mock.calls[0][0]
      expect(callArg.from).not.toMatch(/\r|\n/)
      expect(callArg.html).not.toMatch(/\r\nBCC :/)
      expect(callArg.subject).not.toMatch(/\r|\n/)
    })

    it("should strip all script tags and malicious characters from the message input field", async () => {
      const response = await POST(
        request({
          name: "Fiona",
          email: "gremlin@cave.com",
          phone: "07541236987",
          message: "<script>alert('xss')</script>Hello",
          service: "-"
        })
      )

      expect(response.status).toBe(200)

      const callArg = getMockSend().mock.calls[0][0]
      expect(callArg.html).not.toContain("<script>alert('xss')</script>")
    })
  })
})

/*

  Write a test that validates email addresses by trying to send emails to them.
  Perhaps by seeing the API response from send an email to an address?

*/