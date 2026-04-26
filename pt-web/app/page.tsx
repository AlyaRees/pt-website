import { Header } from "../components/Header"
import { Hero } from "../components/Hero"
import { About } from "../components/About"
import { Services } from "../components/Services"
import { Pricing } from "../components/Pricing"
import { Packages } from "../components/Packages"
import { Scheduling } from "../components/Scheduling"
import { Testimonials } from "../components/Testimonials"
import { Blog } from "../components/Blog"
import { Booking } from "../components/Booking"
import { Footer } from "../components/Footer"

export default function Home() {
  return (
    <main>
    <Header />
    <Hero />
    <About />
    <Services />
    <Pricing />
    <Packages />
    <Scheduling />
    <Testimonials />
    <Blog />
    <Booking />
    <Footer />
    </main>
  )
}