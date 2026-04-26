import { Clock } from "lucide-react"

const schedule = [
  {
    day: "Monday",
    slots: [
      { time: "6:00 AM - 8:00 AM", type: "Early Bird Sessions" },
      { time: "12:00 PM - 2:00 PM", type: "Lunch Hour Training" },
      { time: "5:00 PM - 8:00 PM", type: "Evening Sessions" },
    ],
  },
  {
    day: "Tuesday",
    slots: [
      { time: "6:00 AM - 8:00 AM", type: "Early Bird Sessions" },
      { time: "10:00 AM - 12:00 PM", type: "Group Training" },
      { time: "5:00 PM - 8:00 PM", type: "Evening Sessions" },
    ],
  },
  {
    day: "Wednesday",
    slots: [
      { time: "6:00 AM - 8:00 AM", type: "Early Bird Sessions" },
      { time: "12:00 PM - 2:00 PM", type: "Lunch Hour Training" },
      { time: "5:00 PM - 8:00 PM", type: "Evening Sessions" },
    ],
  },
  {
    day: "Thursday",
    slots: [
      { time: "6:00 AM - 8:00 AM", type: "Early Bird Sessions" },
      { time: "10:00 AM - 12:00 PM", type: "Group Training" },
      { time: "5:00 PM - 8:00 PM", type: "Evening Sessions" },
    ],
  },
  {
    day: "Friday",
    slots: [
      { time: "6:00 AM - 8:00 AM", type: "Early Bird Sessions" },
      { time: "12:00 PM - 2:00 PM", type: "Lunch Hour Training" },
      { time: "4:00 PM - 7:00 PM", type: "Evening Sessions" },
    ],
  },
  {
    day: "Saturday",
    slots: [
      { time: "8:00 AM - 12:00 PM", type: "Weekend Sessions" },
      { time: "10:00 AM - 11:00 AM", type: "Group Boot Camp" },
    ],
  },
  {
    day: "Sunday",
    slots: [
      { time: "9:00 AM - 12:00 PM", type: "Weekend Sessions" },
    ],
  },
]

export function Scheduling() {
  return (
    <section id="schedule" className="py-20 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-2">
            Schedule
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-balance">
            Training Availability
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Find a time that works for you. Early morning, lunch, or evening sessions available.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {schedule.map((day) => (
            <div
              key={day.day}
              className="bg-background rounded-lg border border-border p-5 hover:border-primary/50 transition-colors"
            >
              <h3 className="font-bold text-lg mb-4 text-primary">{day.day}</h3>
              <div className="space-y-3">
                {day.slots.map((slot, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{slot.time}</p>
                      <p className="text-xs text-muted-foreground">{slot.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          * Additional times may be available upon request. Contact me to discuss your scheduling needs.
        </p>
      </div>
    </section>
  )
}
