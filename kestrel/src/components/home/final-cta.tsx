import { Search } from "lucide-react";
import { AuroraBackdrop } from "@/components/art";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/shell/footer";
import { FlapOnView } from "./flap-on-view";
import { Container } from "./home-section";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <>
      <section className="aurora-bg relative overflow-hidden border-t border-panel-border">
        <AuroraBackdrop intensity={0.7} />
        <Container className="relative py-24 text-center sm:py-32">
          <Reveal>
            <div className="flex justify-center">
              <FlapOnView text={"SEE EVERY\nSEAT"} size="lg" tone="signal" align="center" />
            </div>
            <h2 className="mx-auto mt-10 max-w-3xl font-display text-3xl leading-[1.05] tracking-tight text-fg sm:text-5xl balance-text">
              Your next seat is already out there.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-fg-muted pretty-text sm:text-lg">
              Search is free, every data source is labelled, and the transfer math is done for you. Start with a route
              or a sentence.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button href="/search" size="lg" leading={<Search />}>
                Search award seats
              </Button>
              <Button href="/pricing" variant="ghost" size="lg">
                Compare plans
              </Button>
            </div>
          </Reveal>
        </Container>
      </section>
      <Footer />
    </>
  );
}
