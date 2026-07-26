"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/Card";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/TextArea";
import { Calendar, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "./ui/Button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/Select"
import { Label } from "./ui/Label"
import { isValidEmail } from "../app/api/contact/securityFunctions";

export function Booking() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    service: ""
  });
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    setStatus("loading");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", phone: "", message: "", service: ""});
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("Could not send data. Error: " + error);
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="py-20 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          <div className="space-y-8">
            <div>
              <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-2">
                Book a Session
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-balance">
                Ready to Start Your Transformation?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Take the first step toward a healthier, stronger you. Fill out
                the form to book a free consultation and discover how
                personalized training can help you achieve your goals.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Free Consultation</h3>
                  <p className="text-sm text-muted-foreground">
                    30-minute consultation to discuss your goals and create a
                    plan.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Call or Text</h3>
                  <p className="text-sm text-muted-foreground">
                    (555) 123-4567
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Email</h3>
                  <p className="text-sm text-muted-foreground">
                    alex@alexcarterfit.com
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Location</h3>
                  <p className="text-sm text-muted-foreground">
                    FitPro Gym, 123 Fitness Ave       
                    Los Angeles, CA 90001
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Request a Session</CardTitle>
              <CardDescription>
                Fill out the form below and I&apos;ll get back to you within 24
                hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <div>Full Name</div>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    maxLength={100}
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div>Email</div>
                    <Input
                      id="email"
                      type="email"
                      maxLength={254}
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => {
                        if (!isValidEmail(e.target.value)) {
                          setStatus('error')
                          return
                        }
                        setFormData({ ...formData, email: e.target.value })
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div>Phone</div>
                    <Input
                      id="phone"
                      type="phone"
                      maxLength={11}
                      placeholder="+44"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service">Interested In</Label>
                  <Select
                    value={formData.service}
                    onValueChange={(value) => {setFormData({ ...formData, service: value})}}
                  >
                    <SelectTrigger id="service">
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Personal Training">Personal Training</SelectItem>
                      <SelectItem value="Group Training">Group Training</SelectItem>
                      <SelectItem value="Online Coaching">Online Coaching</SelectItem>
                      <SelectItem value="Nutrition Coaching">Nutrition Coaching</SelectItem>
                      <SelectItem value="Transformation Package">Transformation Package</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div>Tell me about your goals</div>
                  <Textarea
                    id="message"
                    placeholder="What are you hoping to achieve?"
                    rows={4}
                    value={formData.message}
                    maxLength={2000}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                  />
                </div>

                <Button
                  size="lg"
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full p-4"
                >
                  {status === "loading" ? "Sending..." : "Send"}
                </Button>
              </form>
              {status === "success" && (
                <p style={{ color: "green" }}>Message sent successfully!</p>
              )}
              {status === "error" && (
                <p style={{ color: "red" }}>
                  Something went wrong. Please try again.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}