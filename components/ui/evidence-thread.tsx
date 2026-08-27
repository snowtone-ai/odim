export type EvidenceThreadStep = Readonly<{
  id: string;
  label: string;
  detail?: string;
  href?: string;
  verified?: boolean;
}>;

type EvidenceThreadProps = Readonly<{
  steps: readonly EvidenceThreadStep[];
  activeId?: string;
  orientation?: "horizontal" | "vertical";
  label?: string;
  className?: string;
}>;

function threadState(step: EvidenceThreadStep, activeId?: string) {
  if (step.id === activeId) return "active";
  if (step.verified) return "verified";
  return "neutral";
}

/**
 * A compact, source-to-action path. It is intentionally semantic markup so
 * the same provenance remains understandable when its visual rail is absent.
 */
export function EvidenceThread({
  steps,
  activeId,
  orientation = "horizontal",
  label = "Evidence path",
  className
}: EvidenceThreadProps) {
  if (steps.length === 0) return null;

  return (
    <ol
      aria-label={label}
      className={[
        "odim-evidence-thread",
        orientation === "vertical" ? "odim-evidence-thread--vertical" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {steps.map((step, index) => {
        const state = threadState(step, activeId);
        const connectorState = state === "active" ? "active" : step.verified ? "verified" : "neutral";
        const content = step.href ? (
          <a
            aria-current={state === "active" ? "step" : undefined}
            className="odim-evidence-thread__label"
            href={step.href}
            title={step.label}
          >
            {step.label}
          </a>
        ) : (
          <span className="odim-evidence-thread__label" title={step.label}>
            {step.label}
          </span>
        );

        return (
          <li className="odim-evidence-thread__item" data-state={state} key={step.id}>
            <span aria-hidden="true" className="odim-evidence-thread__marker" />
            <span className="odim-evidence-thread__content">
              {content}
              {step.detail ? (
                <span className="odim-evidence-thread__detail" title={step.detail}>
                  {step.detail}
                </span>
              ) : null}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="odim-evidence-thread__connector" data-state={connectorState} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
