import { Hero } from "../components/Hero";
import { Marquee } from "../components/Marquee";
import {
  About,
  AiSection,
  Contact,
  Intro,
  Pricing,
  Process,
  Services,
} from "../components/Sections";
import { Footer } from "../components/Footer";

export function Home() {
  return (
    <div className="px-4 pt-4 md:px-8 md:pt-8">
      <Hero />
      <Marquee />
      <Intro />
      <Services />
      <AiSection />
      <Process />
      <About />
      <Pricing />
      <Contact />
      <Footer />
    </div>
  );
}
