interface Props {
  badge?: string;
  title: string;
  description?: string;
  center?: boolean;
  headingId?: string;
}

const SectionHeading = ({ badge, title, description, center = true, headingId }: Props) => (
  <div className={`mb-12 ${center ? "text-center" : ""}`}>
    {badge && (
      <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-primary/10 text-primary mb-4">
        {badge}
      </span>
    )}
    <h2 id={headingId} className="text-3xl md:text-4xl font-heading font-bold text-foreground">
      {title}
    </h2>
    {description && (
      <p className="mt-4 text-muted-foreground max-w-2xl mx-auto leading-relaxed">{description}</p>
    )}
  </div>
);

export default SectionHeading;
