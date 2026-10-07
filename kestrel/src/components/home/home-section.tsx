import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Section, type SectionProps } from "@/components/ui/panel";
import { Reveal } from "./reveal";

/** The landing page's content column: 7xl, 16px gutters on phones. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6", className)}>{children}</div>;
}

export interface HomeSectionProps
  extends Pick<SectionProps, "eyebrow" | "title" | "description" | "actions" | "align" | "size"> {
  id?: string;
  className?: string;
  children?: ReactNode;
}

/** A full-width landing section: generous vertical rhythm, editorial header that rises into view. */
export function HomeSection({
  id,
  className,
  eyebrow,
  title,
  description,
  actions,
  align = "left",
  size = "lg",
  children,
}: HomeSectionProps) {
  return (
    <section id={id} className={cn("py-20 sm:py-28", className)}>
      <Container>
        <Reveal>
          <Section
            as="div"
            eyebrow={eyebrow}
            title={title}
            description={description}
            actions={actions}
            align={align}
            size={size}
          />
        </Reveal>
        {children && <div className="mt-10 sm:mt-14">{children}</div>}
      </Container>
    </section>
  );
}

/** Italic Fraunces accent inside a display title. */
export function Accent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("italic", className)} style={{ fontVariationSettings: '"SOFT" 80, "WONK" 1' }}>
      {children}
    </span>
  );
}
