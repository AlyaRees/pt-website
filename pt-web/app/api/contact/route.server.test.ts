import { POST } from "./route";

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
};

const api = "http://localhost:3000/api/contact";

// request object
const request = (body: object) =>
  new Request(api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("Testing the POST api", () => {
  beforeEach(() => {
    getMockSend().mockClear();
  });
  it("should return 200 when all fields are valid.", async () => {
    const response = await POST(
      request({
        name: "TestUser",
        email: "testuser@test.com",
        message: "hi there.",
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
      }),
    );

    const resolvedResponse = await response.json();

    expect(response.status).toBe(400);
    expect(resolvedResponse.message).toBe("All fields are required.");
  });

  it("should gracefully return 500 when the body is completely empty", async () => {
    const req = new Request(api, {
      method: "POST",
    });

    const res = await POST(req);
    const resolvedResponse = await res.json();

    expect(res.status).toBe(500);
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
          message: "Hello",
        }),
      );
      expect(res.status).toBe(200);
      // Confirm the script tag was stripped — resend mock should have been called with clean data
      const callArg = getMockSend().mock.calls[0][0]
      console.log(callArg)
      expect(callArg.html).not.toContain("<script>")
      expect(callArg.from).not.toContain("<script>")
      expect(callArg.subject).not.toContain("<script>")
    })
    // add test for email field sanitisation here ->
  })
})
