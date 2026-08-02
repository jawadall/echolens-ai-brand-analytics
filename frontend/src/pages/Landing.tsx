import Navbar from '../components/landing/Navbar'
import HeroSection from '../components/landing/HeroSection'
import FeaturesSection from '../components/landing/FeaturesSection'
import PlatformsSection from '../components/landing/PlatformsSection'
import HowItWorksSection from '../components/landing/HowItWorksSection'
import PricingSection from '../components/landing/PricingSection'
import TeamSection from '../components/landing/TeamSection'
import { CTASection, Footer } from '../components/landing/CTAFooter'

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#0a0a12', color: '#e2e8f0' }}>
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <PlatformsSection />
      <HowItWorksSection />
      <PricingSection />
      <TeamSection />
      <CTASection />
      <Footer />
    </div>
  )
}
