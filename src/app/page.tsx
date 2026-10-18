import { DriverCta } from '@/components/landing/DriverCta';
import { Faq } from '@/components/landing/Faq';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { FinalCta } from '@/components/landing/FinalCta';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Navbar } from '@/components/landing/Navbar';
import { SafetySection } from '@/components/landing/SafetySection';
import { VehicleShowcase } from '@/components/landing/VehicleShowcase';
import { Footer } from '@/components/layout/Footer';
import { dashboardPathForRole } from '@/lib/roles';
import { getCurrentUser } from '@/lib/auth';

/**
 * Public landing page (Server Component). The only dynamic bit is the CTA target: signed-in
 * visitors get "Open dashboard" instead of "Get started".
 */
export default async function LandingPage() {
  const user = await getCurrentUser();
  const dashboardHref = user ? dashboardPathForRole(user.role) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar dashboardHref={dashboardHref} />
      <main className="flex-1">
        <Hero />
        <VehicleShowcase />
        <FeatureGrid />
        <HowItWorks />
        <SafetySection />
        <DriverCta />
        <Faq />
        <FinalCta dashboardHref={dashboardHref} />
      </main>
      <Footer />
    </div>
  );
}
