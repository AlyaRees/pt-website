"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card"
import { Input } from "./ui/Input"
import { Textarea } from "./ui/TextArea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/Select"
import { Calendar, Mail, Phone, MapPin } from "lucide-react"
import { Label } from "./ui/Label"

export function Booking() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    service: "",
    message: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    console.log("Form submitted:", formData)
    alert("Thank you for your inquiry! I will get back to you within 24 hours.")
    setFormData({ name: "", email: "", phone: "", service: "", message: "" })
  }

  return (
    <section id="booking" className="py-20 lg:py-32">
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
                Take the first step toward a healthier, stronger you. Fill out the form 
                to book a free consultation and discover how personalized training can 
                help you achieve your goals.
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
                    30-minute consultation to discuss your goals and create a plan.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Call or Text</h3>
                  <p className="text-sm text-muted-foreground">(555) 123-4567</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Email</h3>
                  <p className="text-sm text-muted-foreground">alex@alexcarterfit.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Location</h3>
                  <p className="text-sm text-muted-foreground">
                    FitPro Gym, 123 Fitness Ave<br />
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
                Fill out the form below and I&apos;ll get back to you within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <div>Full Name</div>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div>Email</div>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  </div>
                  <div className="space-y-2">
                    <div>Phone<div/>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service">Interested In</Label>
                  <Select
                    value={formData.service}
                    onValueChange={(value) => setFormData({ ...formData, service: value })}
                  >
                    <SelectTrigger id="service">
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal-training">Personal Training</SelectItem>
                      <SelectItem value="group-training">Group Training</SelectItem>
                      <SelectItem value="online-coaching">Online Coaching</SelectItem>
                      <SelectItem value="nutrition-coaching">Nutrition Coaching</SelectItem>
                      <SelectItem value="transformation-package">Transformation Package</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div >Tell me about your goals</div>
                  <Textarea
                    id="message"
                    placeholder="What are you hoping to achieve?"
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <button type="submit" className="w-full border rounded-xl p-4">
                  Book Free Consultation
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
